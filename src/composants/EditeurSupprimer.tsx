'use client'
// Le bas du panneau de droite : « Déplacer dans la corbeille », d'où la fiche se récupère.
import { toast, useDocumentInfo } from '@payloadcms/ui'

export default function EditeurSupprimer() {
  const { id, collectionSlug } = useDocumentInfo()
  if (!id) return null

  const supprimer = async () => {
    const res = await fetch(`/api/${collectionSlug}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedAt: new Date().toISOString() }),
    })
    if (res.ok) window.location.href = `/admin/collections/${collectionSlug}`
    else toast.error('Le déplacement dans la corbeille a échoué.')
  }

  return <button type="button" className="wpe-supprimer" onClick={supprimer}>Déplacer dans la corbeille</button>
}
