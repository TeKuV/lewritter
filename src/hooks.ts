import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionBeforeChangeHook, Field, FieldHook, GlobalAfterChangeHook } from 'payload'

export type OptionsPurge = { url?: string; secret?: string; entete?: string }

/** Prévient le site qu'un contenu a changé. Le contexte `sansPurge` l'évite pendant un import en masse. */
export function purge(options?: OptionsPurge) {
  const prevenir = () => {
    if (!options?.url) return
    fetch(options.url, {
      method: 'POST',
      headers: options.secret ? { [options.entete ?? 'x-revalidate-secret']: options.secret } : {},
      signal: AbortSignal.timeout(5000),
    }).catch((e) => console.warn('purge du cache du site impossible :', (e as Error).message))
  }
  const apresModification: CollectionAfterChangeHook = ({ doc, context }) => {
    if (!context.sansPurge) prevenir()
    return doc
  }
  const apresSuppression: CollectionAfterDeleteHook = ({ context }) => {
    if (!context.sansPurge) prevenir()
  }
  const globale: GlobalAfterChangeHook = ({ doc, context }) => {
    if (!context.sansPurge) prevenir()
    return doc
  }
  return { apresModification: [apresModification], apresSuppression: [apresSuppression], globale: [globale] }
}

/** Garde l'e-mail de la dernière personne qui a modifié la fiche, lisible seulement une fois connecté. */
export const champAuteur = (name: string, label: string): Field => ({
  name,
  label,
  type: 'text',
  access: { read: ({ req }) => Boolean(req.user) },
  admin: { hidden: true },
})
export const noterAuteur = (name: string): CollectionBeforeChangeHook => ({ data, req }) => {
  const email = (req.user as { email?: string } | null)?.email
  return email ? { ...data, [name]: email } : data
}

export const slugify = (text: unknown) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Laissée vide, la valeur vient du champ titre de la langue en cours, comme l'adresse d'un article dans WordPress. */
export const depuisTitre = (titre = 'title'): FieldHook => ({ value, siblingData }) => value || slugify(siblingData?.[titre]) || undefined

/** Un slug remplacé reste connu dans `anciens_slugs` : le site peut rediriger l'ancienne adresse vers la nouvelle. */
export const garderAncienSlug: FieldHook = ({ value, previousValue, siblingData, originalDoc }) => {
  if (previousValue && value && previousValue !== value) {
    const connus: string[] = siblingData.anciens_slugs ?? originalDoc?.anciens_slugs ?? []
    siblingData.anciens_slugs = [...new Set([...connus, previousValue])].filter((s) => s !== value)
  }
  return value
}
