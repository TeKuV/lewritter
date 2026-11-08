// Fait d'une collection une collection « éditeur de blocs » : plein écran, panneau de droite, brouillons, sauvegarde
// automatique, corbeille, auteur, filtres de liste. Les noms de champs sont ceux de la collection du site.
import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeOperationHook, type CollectionConfig, type Field, type PayloadRequest, type Where } from 'payload'

import { champAuteur, depuisTitre, garderAncienSlug, noterAuteur } from './hooks.js'
import { estRedacteur, restreindre, role } from './roles.js'

// L'auteur d'une fiche, comme dans WordPress : la personne qui l'a créée ; un éditeur ou un administrateur peut le changer.
// Un auteur ne modifie que ses fiches ; un contributeur, que ses brouillons, et il ne publie pas.
const siennes = (req: PayloadRequest): Where => ({ and: [{ auteur: { equals: req.user!.id } }, ...(role(req) === 'contributor' ? [{ _status: { equals: 'draft' } }] : [])] })
const fixerAuteur: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (role(req) === 'contributor' && data._status === 'published') throw new APIError('Un contributeur ne publie pas : un éditeur relira la fiche.', 403, undefined, true)
  if (operation === 'create') return { ...data, auteur: estRedacteur(req) || !data.auteur ? req.user?.id : data.auteur }
  return estRedacteur(req) ? { ...data, auteur: originalDoc?.auteur } : data
}

export type OptionsEditeur = {
  /** Le champ titre, écrit en grand au-dessus du texte. */
  titre?: string
  /** Champ relationTo 'media' choisi avec « Définir l'image mise en avant ». */
  image?: string
  /** Champ texte court écrit avec « Ajouter un extrait… ». */
  extrait?: string
  /** Champ adresse, rempli depuis le titre ; ses anciennes valeurs restent dans `anciens_slugs`. */
  slug?: string
  /** Champ non traduit qui identifie la fiche, rempli depuis le titre. Une fiche sans lui n'apparaît pas dans les listes. */
  cle?: string
  /** Adresse publique d'une fiche publiée, par langue : préfixe auquel le slug s'ajoute (lien « Voir » de la liste). */
  voir?: Record<string, string>
  /** Intervalle de la sauvegarde automatique, en millisecondes. */
  sauvegarde?: number
}
export type ReglagesEditeur = Required<Pick<OptionsEditeur, 'titre'>> & Omit<OptionsEditeur, 'titre' | 'sauvegarde'>

const C = 'lewritter/composants'

export function editeurDeBlocs(collection: CollectionConfig, options: OptionsEditeur = {}): CollectionConfig {
  const reglages: ReglagesEditeur = { titre: options.titre ?? 'title', image: options.image, extrait: options.extrait, slug: options.slug, cle: options.cle, voir: options.voir }
  const cle = reglages.cle ?? reglages.titre
  const avecContenu: Where = { [cle]: { exists: true } }

  // La sauvegarde automatique crée une fiche dès l'ouverture de « Ajouter », comme le brouillon automatique de WordPress.
  // Sans titre, elle n'a pas de clé : elle reste hors des listes, et disparaît le lendemain si personne ne l'a remplie.
  const nettoyerFichesVides: CollectionBeforeOperationHook = ({ args, operation, req }) => {
    if (operation === 'create') {
      const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
      req.payload
        .delete({ collection: collection.slug as never, where: { and: [{ [cle]: { exists: false } }, { createdAt: { less_than: hier } }] }, overrideAccess: true, context: { sansPurge: true } })
        .catch((e) => req.payload.logger.warn(`Nettoyage des fiches vides impossible : ${(e as Error).message}`))
    }
    return args
  }

  const champs = collection.fields.map((f): Field => {
    if (!('name' in f)) return f
    if (f.name === reglages.titre && f.type === 'text') return { ...f, admin: { placeholder: 'Saisissez le titre', ...f.admin, components: { Cell: `${C}/CelluleTitre`, Field: `${C}/ChampTitre`, ...f.admin?.components } } }
    if (f.name === reglages.slug && f.type === 'text') return { ...f, hooks: { ...f.hooks, beforeValidate: [depuisTitre(reglages.titre), ...(f.hooks?.beforeValidate ?? [])], beforeChange: [...(f.hooks?.beforeChange ?? []), garderAncienSlug] }, admin: { position: 'sidebar', placeholder: 'Depuis le titre', ...f.admin } }
    if (f.name === reglages.cle && f.type === 'text') return { ...f, hooks: { ...f.hooks, beforeValidate: [depuisTitre(reglages.titre), ...(f.hooks?.beforeValidate ?? [])] }, admin: { ...f.admin, hidden: true } }
    // Modifiés depuis le panneau de droite, avec leurs propres contrôles.
    if (f.name === reglages.image || f.name === reglages.extrait) return { ...f, admin: { ...f.admin, hidden: true } } as Field
    return f
  })
  const premierePosition = champs.findIndex((f) => 'admin' in f && (f.admin as { position?: string } | undefined)?.position === 'sidebar')
  const localise = champs.some((f) => 'name' in f && f.name === reglages.slug && 'localized' in f && f.localized)

  return {
    ...collection,
    trash: collection.trash ?? true, // une suppression se rattrape, comme la corbeille de WordPress
    access: { ...collection.access, update: restreindre(collection.access?.update, siennes), delete: restreindre(collection.access?.delete, siennes) },
    versions: { maxPerDoc: 25, ...(typeof collection.versions === 'object' ? collection.versions : {}), drafts: { autosave: { interval: options.sauvegarde ?? 5000 } } },
    admin: {
      ...collection.admin,
      useAsTitle: collection.admin?.useAsTitle ?? reglages.titre,
      baseListFilter: collection.admin?.baseListFilter ?? (() => avecContenu),
      hideAPIURL: collection.admin?.hideAPIURL ?? true,
      custom: { ...collection.admin?.custom, lewritter: { ...collection.admin?.custom?.lewritter, editeur: reglages } },
      components: { ...collection.admin?.components, beforeListTable: [...(collection.admin?.components?.beforeListTable ?? []), `${C}/FiltresStatut`] },
    },
    hooks: {
      ...collection.hooks,
      beforeChange: [...(collection.hooks?.beforeChange ?? []), fixerAuteur, noterAuteur('modifie_par')],
      beforeOperation: [...(collection.hooks?.beforeOperation ?? []), nettoyerFichesVides],
    },
    fields: [
      // La barre du haut, au-dessus de tout : un champ pour rester dans le formulaire et pouvoir l'enregistrer.
      { name: 'barre', type: 'ui', admin: { components: { Field: `${C}/EditeurBarre` } } },
      ...champs.slice(0, premierePosition < 0 ? champs.length : premierePosition),
      // Le panneau de droite, dans l'ordre de l'éditeur de blocs.
      { name: 'panneau', type: 'ui', admin: { position: 'sidebar', components: { Field: `${C}/EditeurPanneau` } } },
      { name: 'auteur', label: 'Auteur', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar' }, access: { update: ({ req }) => !estRedacteur(req) } },
      ...(premierePosition < 0 ? [] : champs.slice(premierePosition)),
      { name: 'supprimer', type: 'ui', admin: { position: 'sidebar', components: { Field: `${C}/EditeurSupprimer` } } },
      ...(reglages.slug ? [{ name: 'anciens_slugs', type: 'text', hasMany: true, localized: localise, admin: { hidden: true } } as Field] : []),
      champAuteur('modifie_par', 'Modifié par'),
    ],
  }
}
