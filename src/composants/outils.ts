import type { ReglagesEditeur } from '../editeur.js'

type AvecCustom = { slug: string; labels?: { singular?: unknown; plural?: unknown }; admin?: { custom?: Record<string, any>; hidden?: unknown } }

/** Un libellé de configuration Payload (texte ou traductions par langue), en français de préférence. */
export function libelle(valeur: unknown, secours: string): string {
  if (typeof valeur === 'string') return valeur
  if (valeur && typeof valeur === 'object') {
    const t = valeur as Record<string, unknown>
    const v = t.fr ?? Object.values(t)[0]
    if (typeof v === 'string') return v
  }
  return secours
}

export const reglagesEditeur = (c: AvecCustom | undefined): ReglagesEditeur | undefined => c?.admin?.custom?.lewritter?.editeur
export const collectionsEditeur = <T extends AvecCustom>(collections: T[]) => collections.filter((c) => reglagesEditeur(c))

/** Les réglages LeWritter d'une collection : icône du menu, séparation, libellé « Tout », sans « Ajouter », comptage au tableau de bord, sans purge du site. */
export type ReglagesFiche = { icone?: string; separe?: boolean; tous?: string; lectureSeule?: boolean; tableauDeBord?: boolean; sansPurge?: boolean }
export const reglagesFiche = (c: AvecCustom | undefined): ReglagesFiche => c?.admin?.custom?.lewritter ?? {}

export const nombre = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`.toLowerCase()
