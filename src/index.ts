// LeWritter : l'administration de Payload à la manière de WordPress, avec la connexion par la console de l'équipe.
// Un site ajoute le greffon à sa configuration, puis déclare ses collections ; celles qu'il passe à `editeurDeBlocs`
// s'écrivent dans l'éditeur de blocs. Voir le README.
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { fr } from '@payloadcms/translations/languages/fr'
import type { CollectionConfig, Config, GlobalConfig, Plugin } from 'payload'

import { comptes } from './collections/comptes.js'
import { medias } from './collections/medias.js'
import { purge, type OptionsPurge } from './hooks.js'
import { refuserRedacteurs } from './roles.js'

export { editeurDeBlocs, type OptionsEditeur } from './editeur.js'
export { ROLES, estRedacteur, restreindre, type Role } from './roles.js'
export { slugify, depuisTitre } from './hooks.js'
export { creerCompte } from './comptes.js'

export type OptionsLewritter = {
  /** Le nom du site : bouton de connexion, barre du haut, titre des onglets. */
  nom: string
  /** Adresses publiques des images servies par le site hôte (dossier public). */
  logo?: string
  monogramme?: string
  /** Lien « Voir le site » de la barre du haut. */
  siteUrl?: string
  /** Appelée après chaque modification de contenu, pour que le site relise tout de suite. */
  purge?: OptionsPurge
  /** Largeurs des tailles d'image préparées à l'envoi (WebP). */
  tailles?: number[]
}

/** Ce que les composants lisent dans la configuration (admin.custom.lewritter). */
export type ReglagesClient = { nom: string; logo?: string; monogramme?: string; siteUrl?: string }

const C = 'lewritter/composants'

export const lewritter = (options: OptionsLewritter): Plugin => (config: Config): Config => {
  const fournies = config.collections ?? []
  const auth = comptes.slug
  const collections = [
    ...fournies,
    ...(fournies.some((c) => c.slug === medias(options.tailles).slug) ? [] : [medias(options.tailles)]),
    ...(fournies.some((c) => c.slug === auth) ? [] : [comptes]),
  ]
    .map((c): CollectionConfig => (c.slug === auth || c.admin?.custom?.lewritter?.sansPurge ? c : { ...c, hooks: { ...c.hooks, ...ajouter(c.hooks, purge(options.purge)) } }))
    // Un auteur ou un contributeur n'écrit que dans l'éditeur de blocs et la médiathèque, qui ont leurs propres règles.
    .map((c): CollectionConfig => (c.slug === auth || c.slug === 'media' || c.admin?.custom?.lewritter?.editeur ? c : { ...c, access: { ...c.access, create: refuserRedacteurs(c.access?.create), update: refuserRedacteurs(c.access?.update), delete: refuserRedacteurs(c.access?.delete) } }))
  const globals = (config.globals ?? []).map((g): GlobalConfig => ({ ...g, access: { ...g.access, update: refuserRedacteurs(g.access?.update) }, hooks: { ...g.hooks, afterChange: [...(g.hooks?.afterChange ?? []), ...purge(options.purge).globale] } }))
  const reglages: ReglagesClient = { nom: options.nom, logo: options.logo, monogramme: options.monogramme, siteUrl: options.siteUrl }
  const serveur = config.serverURL ?? process.env.SERVER_URL

  return {
    ...config,
    serverURL: serveur,
    collections,
    globals,
    telemetry: config.telemetry ?? false,
    // Refuse les écritures venues d'un autre site, et n'ouvre l'API à aucune autre origine.
    csrf: config.csrf ?? (serveur ? [serveur] : []),
    cors: config.cors ?? [],
    admin: {
      theme: 'light',
      dateFormat: "d MMMM yyyy 'à' HH:mm",
      ...config.admin,
      user: auth,
      meta: { titleSuffix: ` - ${options.nom}`, ...config.admin?.meta },
      custom: { ...config.admin?.custom, lewritter: reglages },
      components: {
        ...config.admin?.components,
        beforeLogin: [...(config.admin?.components?.beforeLogin ?? []), `${C}/BoutonConsole`],
        graphics: { Logo: `${C}/Logo`, ...config.admin?.components?.graphics },
        header: [...(config.admin?.components?.header ?? []), `${C}/BarreAdmin`],
        Nav: `${C}/Menu`,
        views: { dashboard: { Component: `${C}/TableauDeBord` }, ...config.admin?.components?.views },
      },
    },
    i18n: {
      supportedLanguages: { fr },
      fallbackLanguage: 'fr',
      ...config.i18n,
      translations: { ...TRADUCTIONS, ...config.i18n?.translations },
    },
    // Sans images ni liens vers d'autres fiches dans le texte : un site qui lit du Markdown les perdrait sans prévenir.
    editor: config.editor ?? lexicalEditor({
      admin: { hideGutter: true, placeholder: 'Saisir « / » pour choisir un bloc' },
      features: ({ defaultFeatures }) => defaultFeatures.filter((f) => !['upload', 'relationship'].includes(f.key)),
    }),
  }
}

const ajouter = (existants: CollectionConfig['hooks'], purges: ReturnType<typeof purge>) => ({
  afterChange: [...(existants?.afterChange ?? []), ...purges.apresModification],
  afterDelete: [...(existants?.afterDelete ?? []), ...purges.apresSuppression],
})

// Les libellés français de Payload qui gênent un rédacteur.
const TRADUCTIONS = {
  fr: {
    general: {
      locale: 'Langue',
      locales: 'Langues',
      createNew: 'Ajouter',
      createNewLabel: 'Ajouter : {{label}}',
      creatingNewLabel: 'Ajouter : {{label}}',
    },
    version: { publishChanges: 'Publier' },
    fields: {
      chooseFromExisting: 'Choisir dans la médiathèque',
      addNewLabel: 'Ajouter : {{label}}',
      uploadNewLabel: 'Envoyer : {{label}}',
    },
  },
}
