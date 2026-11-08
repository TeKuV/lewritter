'use client'
// Le haut du panneau de droite de l'éditeur de blocs : onglets, carte de la fiche, image mise en avant, extrait, état et langue.
import { UnpublishButton, useConfig, useDocumentInfo, useField, useFormFields, useLocale } from '@payloadcms/ui'
import { useEffect, useRef, useState } from 'react'

import Mediatheque, { type Media } from './Mediatheque.js'
import { libelle, reglagesEditeur } from './outils.js'

function ImageMiseEnAvant({ path }: { path: string }) {
  const { value, setValue } = useField<string | null>({ path })
  const [media, setMedia] = useState<Media | null>(null)
  const [choix, setChoix] = useState<Media | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const dialogue = useRef<HTMLDialogElement>(null)
  const id = value && typeof value === 'object' ? (value as { id: string }).id : value

  useEffect(() => {
    if (!id) { setMedia(null); return }
    let actif = true
    fetch(`/api/media/${id}?depth=0`).then((r) => (r.ok ? r.json() : null)).then((m) => { if (actif) setMedia(m) })
    return () => { actif = false }
  }, [id])
  useEffect(() => { if (ouvert) dialogue.current?.showModal() }, [ouvert])

  const fermer = () => { dialogue.current?.close(); setOuvert(false) }
  const definir = () => {
    if (choix) { setValue(choix.id); setMedia(choix) }
    fermer()
  }

  return (
    <div className="wpe-image">
      {media ? (
        <>
          <button type="button" className="wpe-image__apercu" onClick={() => { setChoix(media); setOuvert(true) }} aria-label="Remplacer l'image mise en avant">
            <img src={media.thumbnailURL ?? media.url} alt={media.alt ?? ''} />
          </button>
          <div className="wpe-image__actions">
            <button type="button" className="wpe-bouton" onClick={() => { setChoix(media); setOuvert(true) }}>Remplacer</button>
            <button type="button" className="wpe-bouton" onClick={() => { setValue(null); setMedia(null) }}>Retirer</button>
          </div>
        </>
      ) : (
        <button type="button" className="wpe-bouton wpe-bouton--large" onClick={() => { setChoix(null); setOuvert(true) }}>Définir l'image mise en avant</button>
      )}
      {ouvert && (
        <dialog ref={dialogue} className="wpe-choix" aria-labelledby="wpe-choix-titre" onClose={() => setOuvert(false)}>
          <header>
            <h2 id="wpe-choix-titre">Image mise en avant</h2>
            <button type="button" aria-label="Fermer" onClick={fermer}>×</button>
          </header>
          <div className="wpe-choix__corps">
            <Mediatheque mode="choix" selection={choix?.id ?? null} onSelection={setChoix} />
          </div>
          <footer>
            {choix && <span>{choix.filename} - {choix.width} × {choix.height}</span>}
            <button type="button" className="wpm-btn wpm-btn--primaire" disabled={!choix} onClick={definir}>Définir l'image mise en avant</button>
          </footer>
        </dialog>
      )}
    </div>
  )
}

function Extrait({ path }: { path: string }) {
  const { value, setValue } = useField<string>({ path })
  const [ouvert, setOuvert] = useState(false)
  if (!ouvert && !value) {
    return <button type="button" className="wpe-lien" onClick={() => setOuvert(true)}>Ajouter un extrait…</button>
  }
  return (
    <label className="wpe-extrait">
      <span>Extrait</span>
      <textarea rows={4} value={value ?? ''} autoFocus={ouvert} onChange={(e) => setValue(e.target.value)} />
    </label>
  )
}

export default function EditeurPanneau() {
  const { id, collectionSlug, versionCount, hasPublishedDoc, unpublishedVersionCount, lastUpdateTime } = useDocumentInfo()
  const { config } = useConfig()
  const collection = config.collections.find((c) => c.slug === collectionSlug)
  const r = reglagesEditeur(collection)
  const nom = libelle(collection?.labels?.singular, collectionSlug ?? '')
  const langues = config.localization ? config.localization.locales : []
  const titre = useFormFields(([f]) => f[r?.titre ?? 'title']?.value as string | undefined)
  const statut = useFormFields(([f]) => f._status?.value)
  const auteur = useFormFields(([f]) => f.modifie_par?.value as string | undefined)
  const { code } = useLocale()
  const [onglet, setOnglet] = useState<'fiche' | 'bloc'>('fiche')

  useEffect(() => {
    const racine = document.documentElement
    racine.dataset.wpOnglet = onglet
    return () => { delete racine.dataset.wpOnglet; delete racine.dataset.wpPanneau }
  }, [onglet])

  const etat = statut === 'published' && !unpublishedVersionCount ? 'Publié'
    : hasPublishedDoc ? 'Publié, modifications en brouillon'
    : 'Brouillon'
  const modifie = lastUpdateTime ? new Date(lastUpdateTime).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="wpe-panneau">
      <div className="wpe-onglets" role="tablist" aria-label="Réglages">
        <button type="button" role="tab" aria-selected={onglet === 'fiche'} onClick={() => setOnglet('fiche')}>{nom}</button>
        <button type="button" role="tab" aria-selected={onglet === 'bloc'} onClick={() => setOnglet('bloc')}>Bloc</button>
        <button
          type="button"
          className="wpe-onglets__fermer"
          aria-label="Fermer les réglages"
          onClick={() => document.querySelector<HTMLButtonElement>('.wpe-barre [aria-label="Réglages"]')?.click()}
        >×</button>
      </div>

      {onglet === 'bloc' ? (
        <p className="wpe-bloc-vide">Sélectionnez du texte pour le mettre en forme, ou tapez « / » pour choisir un bloc.</p>
      ) : (
        <>
          <div className="wpe-section">
            <div className="wpe-carte">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M19 5.5c-3.8-.5-8 .7-10.300 3.500-1.800 2.200-2.300 4.900-1.700 7.300L4.500 19l1 1 2.600-2.600c2.400.7 5.100.2 7.300-1.600 2.800-2.300 4.100-6.500 3.600-10.300zM9 15.100l5-5-1-1-5 5c-.1-1.600.5-3.300 1.800-4.800 1.700-2 4.600-3.100 7.500-3 .100 2.900-1 5.800-3 7.500-1.500 1.300-3.200 1.900-4.800 1.800z" /></svg>
              <strong>{titre || 'Aucun titre'}</strong>
            </div>
            {r?.image && <ImageMiseEnAvant path={r.image} />}
            {r?.extrait && <Extrait path={r.extrait} />}
            {modifie && <p className="wpe-modifie">Dernière modification : {modifie}{auteur ? `, par ${auteur}` : ''}.</p>}
          </div>
          <div className="wpe-rangee">
            <span>État</span>
            <strong>{id ? etat : 'Brouillon'}</strong>
          </div>
          {hasPublishedDoc && <div className="wpe-rangee wpe-rangee--action"><span /><UnpublishButton /></div>}
          {langues.length > 1 && <div className="wpe-rangee">
            <span>Langue</span>
            <span className="wpe-langues">
              {langues.map((l) => (l.code === code
                ? <strong key={l.code} aria-current="true">{libelle(l.label, l.code)}</strong>
                : <a key={l.code} href={`?locale=${l.code}`}>{libelle(l.label, l.code)}</a>))}
            </span>
          </div>}
          {id && (
            <div className="wpe-rangee">
              <span>Révisions</span>
              <a href={`/admin/collections/${collectionSlug}/${id}/versions`}>{versionCount ?? 0}</a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
