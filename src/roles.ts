// Les rôles de WordPress utiles à un back-office : Administrateur, Éditeur, Auteur, Contributeur.
// Un auteur écrit, publie et supprime ses propres fiches ; un contributeur écrit ses brouillons sans les publier.
// Aucun des deux ne modifie les autres collections ni les fiches uniques du site.
import type { Access, PayloadRequest, Where } from 'payload'

export type Role = 'admin' | 'editor' | 'author' | 'contributor'

export const ROLES: { label: string; value: Role }[] = [
  { label: 'Administrateur', value: 'admin' },
  { label: 'Éditeur', value: 'editor' },
  { label: 'Auteur', value: 'author' },
  { label: 'Contributeur', value: 'contributor' },
]

export const role = (req: Pick<PayloadRequest, 'user'>) => (req.user as { role?: Role } | null)?.role
/** Auteur ou contributeur : n'agit que sur ce qui est à lui. */
export const estRedacteur = (req: Pick<PayloadRequest, 'user'>) => role(req) === 'author' || role(req) === 'contributor'

/** L'accès d'origine (une personne connectée, par défaut), restreint pour un auteur ou un contributeur par `filtre` (false : refusé). */
export const restreindre = (origine: Access | undefined, filtre: (req: PayloadRequest) => Where | false): Access => async (args) => {
  const base = origine ? await origine(args) : Boolean(args.req.user)
  if (!base || !estRedacteur(args.req)) return base
  const f = filtre(args.req)
  if (!f) return false
  return base === true ? f : { and: [base, f] }
}

export const refuserRedacteurs = (origine: Access | undefined) => restreindre(origine, () => false)
