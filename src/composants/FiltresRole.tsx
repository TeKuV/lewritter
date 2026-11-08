// « Tous (3) | Administrateur (1) | Éditeur (2) » au-dessus de la liste des comptes, comme dans wp-admin.
import type { Payload } from 'payload'

import { libelle } from './outils.js'

type Props = { payload: Payload; user?: { role?: string } | null; searchParams?: Record<string, unknown> }

export default async function FiltresRole({ payload, user, searchParams }: Props) {
  if (user?.role !== 'admin') return null
  const champ = payload.collections.users.config.fields.find((f) => 'name' in f && f.name === 'role') as { options?: { label: unknown; value: string }[] } | undefined
  const roles = champ?.options ?? []
  const compte = (role?: string) => payload.count({ collection: 'users' as never, where: role ? { role: { equals: role } } : {}, overrideAccess: true }).then((x) => x.totalDocs)
  const [tous, ...parRole] = await Promise.all([compte(), ...roles.map((r) => compte(r.value))])
  const where = searchParams?.where as { role?: { equals?: string } } | undefined
  const actuel = where?.role?.equals ?? searchParams?.['where[role][equals]']
  const base = '/admin/collections/users'

  const liens = [
    { label: 'Tous', n: tous, href: base, actif: !actuel },
    ...roles.map((r, i) => ({ label: libelle(r.label, r.value), n: parRole[i], href: `${base}?where[role][equals]=${r.value}`, actif: actuel === r.value })),
  ]
  return (
    <ul className="wp-filtres">
      {liens.map((l) => (
        <li key={l.href}>
          <a href={l.href} aria-current={l.actif ? 'true' : undefined}>
            {l.label} <span>({l.n})</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
