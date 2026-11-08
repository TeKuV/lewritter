import type { Access, CollectionConfig } from 'payload'

import { strategieConsole } from '../auth/strategie.js'

const isAdmin: Access = ({ req }) => req.user?.role === 'admin'

// Un compte local par membre autorisé, relié à la console par son e-mail : aucun mot de passe ici. Le rôle fait foi, jamais celui de la console.
export const comptes: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Compte', plural: 'Comptes' },
  admin: { useAsTitle: 'email', hideAPIURL: true },
  auth: {
    disableLocalStrategy: true,
    strategies: [strategieConsole],
    cookies: { sameSite: 'Lax', secure: process.env.SERVER_URL?.startsWith('https:') ?? false },
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false // sans ce test, { equals: undefined } ne filtre rien : tout le monde verrait les comptes
      return req.user.role === 'admin' ? true : { id: { equals: req.user.id } }
    },
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    // Se déconnecter invalide tout de suite les jetons déjà émis, sur tous les appareils du compte.
    afterLogout: [
      async ({ req }) => {
        const user = req.user as { id: string; epoque?: number | null } | null
        if (user) await req.payload.update({ collection: 'users', id: user.id, data: { epoque: (user.epoque ?? 0) + 1 } as never, overrideAccess: true, context: { sansPurge: true } })
      },
    ],
  },
  fields: [
    { name: 'email', label: 'E-mail', type: 'email', required: true, unique: true, index: true },
    {
      name: 'role',
      label: 'Rôle',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [
        { label: 'Administrateur', value: 'admin' },
        { label: 'Éditeur', value: 'editor' },
      ],
    },
    // Glissé dans le jeton de session : un jeton d'une époque passée n'ouvre plus rien.
    { name: 'epoque', type: 'number', defaultValue: 0, hidden: true, saveToJWT: 'ep' },
  ],
}
