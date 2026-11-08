// « Tous (5) | Publiés (5) | Brouillons (0) | Corbeille (0) » au-dessus de la liste, comme dans wp-admin.
import type { Payload } from 'payload'

import { reglagesEditeur } from './outils.js'

type Props = { payload: Payload; collectionSlug?: string; collectionConfig?: { slug: string }; searchParams?: Record<string, unknown>; viewType?: string }

export default async function FiltresStatut({ payload, collectionSlug, collectionConfig, searchParams, viewType }: Props) {
  const slug = collectionSlug ?? collectionConfig?.slug
  const collection = payload.config.collections.find((c) => c.slug === slug)
  const r = reglagesEditeur(collection)
  if (!collection || !r) return null
  const base = `/admin/collections/${collection.slug}`
  const avecContenu = { [r.cle ?? r.titre]: { exists: true } }
  const compte = (status?: 'published' | 'draft') =>
    payload.count({ collection: collection.slug as never, where: { and: [avecContenu, ...(status ? [{ _status: { equals: status } }] : [])] } as never }).then((x) => x.totalDocs)
  const corbeille = payload.count({ collection: collection.slug as never, trash: true, where: { deletedAt: { exists: true } } as never }).then((x) => x.totalDocs)
  const [tous, publies, brouillons, jetes] = await Promise.all([compte(), compte('published'), compte('draft'), corbeille])
  const where = searchParams?.where as { _status?: { equals?: string } } | undefined
  const actuel = where?._status?.equals ?? searchParams?.['where[_status][equals]']

  const liens = [
    { label: 'Tous', n: tous, href: base, actif: !actuel && viewType !== 'trash' },
    { label: 'Publiés', n: publies, href: `${base}?where[_status][equals]=published`, actif: actuel === 'published' },
    { label: 'Brouillons', n: brouillons, href: `${base}?where[_status][equals]=draft`, actif: actuel === 'draft' },
    { label: 'Corbeille', n: jetes, href: `${base}/trash`, actif: viewType === 'trash' },
  ]
  return (
    <ul className="wp-filtres">
      {liens.map((l) => (
        <li key={l.label}>
          <a href={l.href} aria-current={l.actif ? 'true' : undefined}>
            {l.label} <span>({l.n})</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
