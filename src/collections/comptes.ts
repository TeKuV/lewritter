import { APIError, type Access, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook, type CollectionConfig, type FieldAccess } from 'payload'

import { strategieConsole } from '../auth/strategie.js'
import { ROLES } from '../roles.js'

const isAdmin: Access = ({ req }) => req.user?.role === 'admin'
const champAdmin: FieldAccess = ({ req }) => req.user?.role === 'admin'

// Comme dans WordPress, le site garde toujours au moins un administrateur, et personne ne supprime son propre compte.
const administrateurs = (req: Parameters<CollectionBeforeDeleteHook>[0]['req']) =>
  req.payload.count({ collection: 'users' as never, where: { role: { equals: 'admin' } }, overrideAccess: true }).then((x) => x.totalDocs)

const garderUnAdmin: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (operation !== 'update' || !data.role || data.role === originalDoc?.role) return data
  if (String(req.user?.id) === String(originalDoc?.id)) throw new APIError('Vous ne pouvez pas changer votre propre rôle.', 400, undefined, true)
  if (originalDoc?.role === 'admin' && (await administrateurs(req)) <= 1) throw new APIError('Le site doit garder au moins un administrateur.', 400, undefined, true)
  return data
}

const protegerSuppression: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (String(req.user?.id) === String(id)) throw new APIError('Vous ne pouvez pas supprimer votre propre compte.', 400, undefined, true)
  const compte = await req.payload.findByID({ collection: 'users' as never, id, overrideAccess: true, disableErrors: true })
  if ((compte as { role?: string } | null)?.role === 'admin' && (await administrateurs(req)) <= 1)
    throw new APIError('Le site doit garder au moins un administrateur.', 400, undefined, true)
}

// Un compte local par membre autorisé, relié à la console par son e-mail : aucun mot de passe ici. Le rôle fait foi, jamais celui de la console.
// Chacun modifie son profil (« Profil » du menu) ; l'e-mail et le rôle ne changent que par un administrateur.
export const comptes: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Compte', plural: 'Comptes' },
  admin: {
    useAsTitle: 'email',
    hideAPIURL: true,
    defaultColumns: ['email', 'prenom', 'nom', 'role'],
    components: { beforeListTable: ['lewritter/composants/FiltresRole'] },
  },
  auth: {
    disableLocalStrategy: true,
    strategies: [strategieConsole],
    cookies: { sameSite: 'Lax', secure: process.env.SERVER_URL?.startsWith('https:') ?? false },
  },
  access: {
    read: ({ req }) => {
      if (!req.user) return false // sans ce test, { equals: undefined } ne filtre rien : tout le monde verrait les comptes
      // Un éditeur voit les comptes pour choisir l'auteur d'une fiche ; les autres ne voient que le leur.
      return req.user.role === 'admin' || req.user.role === 'editor' ? true : { id: { equals: req.user.id } }
    },
    create: isAdmin,
    update: ({ req }) => {
      if (!req.user) return false
      return req.user.role === 'admin' ? true : { id: { equals: req.user.id } }
    },
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [garderUnAdmin],
    beforeDelete: [protegerSuppression],
    // Se déconnecter invalide tout de suite les jetons déjà émis, sur tous les appareils du compte.
    afterLogout: [
      async ({ req }) => {
        const user = req.user as { id: string; epoque?: number | null } | null
        if (user) await req.payload.update({ collection: 'users', id: user.id, data: { epoque: (user.epoque ?? 0) + 1 } as never, overrideAccess: true, context: { sansPurge: true } })
      },
    ],
  },
  fields: [
    {
      name: 'email',
      label: 'E-mail',
      type: 'email',
      required: true,
      unique: true,
      index: true,
      access: { update: champAdmin },
      admin: { components: { Cell: 'lewritter/composants/CelluleTitre' }, description: 'La personne se connecte avec le compte de la console qui porte cette adresse.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'prenom', label: 'Prénom', type: 'text' },
        { name: 'nom', label: 'Nom', type: 'text' },
      ],
    },
    {
      name: 'role',
      label: 'Rôle',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      access: { update: champAdmin },
      options: ROLES,
    },
    // Glissé dans le jeton de session : un jeton d'une époque passée n'ouvre plus rien.
    { name: 'epoque', type: 'number', defaultValue: 0, hidden: true, saveToJWT: 'ep', access: { update: () => false } },
  ],
}
