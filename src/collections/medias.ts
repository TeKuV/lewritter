import type { CollectionConfig } from 'payload'

import { champAuteur, noterAuteur } from '../hooks.js'
import { restreindre, role } from '../roles.js'

const connecte = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)
// Comme dans WordPress : un contributeur n'envoie pas de fichiers ; un auteur ne modifie ou ne supprime que les siens.
const siens = restreindre(connecte, (req) => (role(req) === 'author' ? { televerse_par: { equals: (req.user as { email?: string }).email } } : false))
const webp = { format: 'webp' as const, options: { quality: 80 } }

/**
 * La médiathèque. Des tailles fixes en WebP sont préparées à l'envoi : personne ne peut demander des milliers de variantes.
 * Pas de SVG : un SVG peut contenir du code, et ces fichiers sont servis depuis le site.
 */
export const medias = (tailles = [320, 480, 640, 720, 1200]): CollectionConfig => ({
  slug: 'media',
  labels: { singular: 'Image', plural: 'Médiathèque' },
  admin: { components: { views: { list: { Component: 'lewritter/composants/Mediatheque' } } } },
  access: { read: () => true, create: ({ req }) => Boolean(req.user) && role(req) !== 'contributor', update: siens, delete: siens },
  hooks: { beforeChange: [noterAuteur('televerse_par')] },
  upload: {
    staticDir: process.env.MEDIA_DIR || 'media',
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    adminThumbnail: `w${tailles[0]}`,
    imageSizes: tailles.map((w) => ({ name: `w${w}`, width: w, withoutEnlargement: true, formatOptions: webp })),
  },
  fields: [
    { name: 'alt', label: 'Texte alternatif', type: 'text', localized: true },
    { name: 'titre', label: 'Titre', type: 'text', localized: true },
    { name: 'legende', label: 'Légende', type: 'textarea', localized: true },
    { name: 'description', label: 'Description', type: 'textarea', localized: true },
    champAuteur('televerse_par', 'Téléversé par'),
  ],
})
