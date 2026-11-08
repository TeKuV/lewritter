'use client'
// Le titre dans la liste, avec ses actions au survol : « Modifier | Voir ».
import { useConfig, useLocale } from '@payloadcms/ui'

import { reglagesEditeur } from './outils.js'

type Props = { cellData?: string; collectionSlug?: string; rowData?: Record<string, unknown> & { id?: string; _status?: string } }

export default function CelluleTitre({ cellData, collectionSlug, rowData }: Props) {
  const { code } = useLocale()
  const { config } = useConfig()
  const r = reglagesEditeur(config.collections.find((c) => c.slug === collectionSlug))
  const lien = `/admin/collections/${collectionSlug}/${rowData?.id}`
  const slug = r?.slug ? rowData?.[r.slug] : undefined
  const prefixe = r?.voir?.[code]
  const voir = prefixe && typeof slug === 'string' && rowData?._status === 'published' ? `${prefixe}${slug}/` : null
  return (
    <div className="wp-cellule">
      <strong>
        <a href={lien}>{cellData || '(sans titre)'}</a>
        {rowData?._status === 'draft' && <em> - Brouillon</em>}
      </strong>
      <div className="wp-cellule__actions">
        <a href={lien}>Modifier</a>
        {voir && <> | <a href={voir} target="_blank" rel="noopener noreferrer">Voir</a></>}
      </div>
    </div>
  )
}
