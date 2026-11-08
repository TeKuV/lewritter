'use client'
// La médiathèque de WordPress : grille ou liste, envoi par glisser-déposer, sélection groupée et « Détails du fichier joint ».
// Sert aussi de sélecteur d'image pour l'éditeur (mode « choix »).
// ponytail: 200 images chargées et filtrées dans le navigateur, à paginer côté serveur si la médiathèque dépasse ce volume.
import { toast, useLocale } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation.js'
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type Media = {
  id: string
  filename: string
  mimeType: string
  filesize: number
  width: number
  height: number
  url: string
  thumbnailURL?: string | null
  alt?: string | null
  titre?: string | null
  legende?: string | null
  description?: string | null
  televerse_par?: string | null
  createdAt: string
}

const TYPES = [
  { value: '', label: 'Tous les médias' },
  { value: 'image/png', label: 'Images PNG' },
  { value: 'image/jpeg', label: 'Images JPEG' },
  { value: 'image/webp', label: 'Images WebP' },
]

const mois = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const titreDe = (m: Media) => m.titre || m.filename.replace(/\.\w+$/, '')
const poids = (o: number) => (o < 1024 * 1024 ? `${Math.round(o / 1024)} Ko` : `${(o / 1024 / 1024).toFixed(1)} Mo`)

async function erreurDe(res: Response) {
  const data = await res.json().catch(() => null)
  return data?.errors?.[0]?.message ?? `Erreur ${res.status}`
}

type Props = { mode?: 'page' | 'choix'; selection?: string | null; onSelection?: (m: Media | null) => void }

export default function Mediatheque({ mode = 'page', selection, onSelection }: Props) {
  const { code } = useLocale()
  const params = useSearchParams()
  const estPage = mode === 'page'
  const [medias, setMedias] = useState<Media[]>([])
  const [charge, setCharge] = useState(false)
  const [vue, setVue] = useState<'grille' | 'liste'>('grille')
  const [type, setType] = useState('')
  const [periode, setPeriode] = useState('')
  const [recherche, setRecherche] = useState('')
  const [envoi, setEnvoi] = useState(estPage && params.get('ajouter') === '1')
  const [envoiEnCours, setEnvoiEnCours] = useState(0)
  const [survol, setSurvol] = useState(false)
  const [groupe, setGroupe] = useState(false)
  const [coches, setCoches] = useState<string[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const fichiers = useRef<HTMLInputElement>(null)

  const charger = useCallback(async () => {
    const res = await fetch(`/api/media?limit=200&sort=-createdAt&depth=0&locale=${code}`)
    if (res.ok) setMedias((await res.json()).docs)
    setCharge(true)
  }, [code])
  useEffect(() => { charger() }, [charger])

  const periodes = useMemo(() => [...new Set(medias.map((m) => mois(m.createdAt)))], [medias])
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return medias.filter((m) =>
      (!type || m.mimeType === type) &&
      (!periode || mois(m.createdAt) === periode) &&
      (!q || [m.filename, m.alt, m.titre].some((t) => t?.toLowerCase().includes(q))),
    )
  }, [medias, type, periode, recherche])

  async function envoyer(liste: File[]) {
    setEnvoiEnCours(liste.length)
    let premier: Media | null = null
    for (const fichier of liste) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(fichier.type)) {
        toast.error(`${fichier.name} : ce type de fichier n'est pas autorisé. Utilisez une image PNG, JPEG ou WebP.`)
        setEnvoiEnCours((n) => n - 1)
        continue
      }
      const form = new FormData()
      form.append('file', fichier)
      form.append('_payload', JSON.stringify({ titre: fichier.name.replace(/\.\w+$/, '') }))
      const res = await fetch(`/api/media?locale=${code}`, { method: 'POST', body: form })
      if (res.ok) premier ??= (await res.json()).doc
      else toast.error(`${fichier.name} : ${await erreurDe(res)}`)
      setEnvoiEnCours((n) => n - 1)
    }
    await charger()
    if (premier) {
      setEnvoi(false)
      if (!estPage) onSelection?.(premier)
    }
  }
  const auChoixFichiers = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) envoyer([...e.target.files])
    e.target.value = ''
  }
  const auDepot = (e: DragEvent) => {
    e.preventDefault()
    setSurvol(false)
    if (e.dataTransfer.files.length) envoyer([...e.dataTransfer.files])
  }

  async function supprimer(ids: string[]) {
    const message = ids.length > 1
      ? `Supprimer définitivement ces ${ids.length} fichiers ? Cette action est irréversible.`
      : 'Supprimer définitivement ce fichier ? Cette action est irréversible.'
    if (!window.confirm(message)) return false
    const resultats = await Promise.all(ids.map((id) => fetch(`/api/media/${id}`, { method: 'DELETE' })))
    const refuse = resultats.find((r) => !r.ok)
    if (refuse) toast.error(await erreurDe(refuse))
    await charger()
    return !refuse
  }

  const auClicVignette = (m: Media) => {
    if (groupe) setCoches((c) => (c.includes(m.id) ? c.filter((i) => i !== m.id) : [...c, m.id]))
    else if (estPage) setDetailId(m.id)
    else onSelection?.(selection === m.id ? null : m)
  }
  const quitterGroupe = () => { setGroupe(false); setCoches([]) }
  const estCoche = (m: Media) => (groupe ? coches.includes(m.id) : !estPage && selection === m.id)
  const detail = visibles.find((m) => m.id === detailId) ?? null

  return (
    <div className={estPage ? 'wpm wpm--page' : 'wpm wpm--choix'}>
      {estPage && (
        <div className="wpm__entete">
          <h1>Médiathèque</h1>
          <button type="button" className="wpm-btn" onClick={() => setEnvoi((v) => !v)} aria-expanded={envoi}>Ajouter un fichier média</button>
        </div>
      )}

      {(envoi || (!estPage && charge && !medias.length)) && (
        <div
          className={survol ? 'wpm-depot wpm-depot--survol' : 'wpm-depot'}
          onDragOver={(e) => { e.preventDefault(); setSurvol(true) }}
          onDragLeave={() => setSurvol(false)}
          onDrop={auDepot}
        >
          {estPage && <button type="button" className="wpm-depot__fermer" aria-label="Fermer l'envoi" onClick={() => setEnvoi(false)}>×</button>}
          <p className="wpm-depot__titre">Déposez vos fichiers pour les téléverser</p>
          <p>ou</p>
          <button type="button" className="wpm-btn wpm-btn--grand" onClick={() => fichiers.current?.click()}>Sélectionner des fichiers</button>
          <p className="wpm-depot__note">Images PNG, JPEG ou WebP.</p>
          {envoiEnCours > 0 && <p role="status">Téléversement en cours…</p>}
        </div>
      )}
      <input ref={fichiers} type="file" hidden multiple={estPage} accept="image/png,image/jpeg,image/webp" onChange={auChoixFichiers} />

      <div className="wpm-filtres">
        {estPage && !groupe && (
          <div className="wpm-filtres__vues">
            <button type="button" aria-label="Vue en liste" aria-pressed={vue === 'liste'} onClick={() => setVue('liste')}>
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M2 3h16v2H2zM2 7h16v2H2zM2 11h16v2H2zM2 15h16v2H2z" /></svg>
            </button>
            <button type="button" aria-label="Vue en grille" aria-pressed={vue === 'grille'} onClick={() => setVue('grille')}>
              <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M2 2h7v7H2zM11 2h7v7h-7zM2 11h7v7H2zM11 11h7v7h-7z" /></svg>
            </button>
          </div>
        )}
        {!groupe && (
          <>
            <select aria-label="Filtrer par type" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select aria-label="Filtrer par date" value={periode} onChange={(e) => setPeriode(e.target.value)}>
              <option value="">Toutes les dates</option>
              {periodes.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </>
        )}
        {estPage && (groupe ? (
          <>
            <button type="button" className="wpm-btn" onClick={quitterGroupe}>Annuler</button>
            <button type="button" className="wpm-btn wpm-btn--primaire" disabled={!coches.length} onClick={async () => { if (await supprimer(coches)) quitterGroupe() }}>
              Supprimer définitivement
            </button>
          </>
        ) : (
          vue === 'grille' && <button type="button" className="wpm-btn" onClick={() => setGroupe(true)}>Sélection groupée</button>
        ))}
        {!estPage && <button type="button" className="wpm-btn" onClick={() => setEnvoi((v) => !v)}>Téléverser des fichiers</button>}
        <label className="wpm-filtres__recherche">
          <span>Rechercher des médias</span>
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </label>
      </div>

      {charge && !visibles.length && <p className="wpm-vide">Aucun média n'a été trouvé.</p>}

      {vue === 'grille' || !estPage ? (
        <ul className="wpm-grille">
          {visibles.map((m) => (
            <li key={m.id}>
              <button type="button" className={estCoche(m) ? 'wpm-vignette wpm-vignette--cochee' : 'wpm-vignette'} aria-pressed={groupe || !estPage ? estCoche(m) : undefined} onClick={() => auClicVignette(m)}>
                {/* Comme WordPress : une image large reste à sa taille et se centre, sinon elle remplit le carré. */}
                <img src={m.thumbnailURL ?? m.url} alt={m.alt ?? ''} loading="lazy" className={m.width / m.height > 1.6 ? 'wpm-vignette__large' : undefined} />
                <span className="wpm-vignette__nom">{titreDe(m)}</span>
                {estCoche(m) && <span className="wpm-vignette__coche" aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="wpm-liste">
          <table>
            <thead><tr><th>Fichier</th><th>Texte alternatif</th><th>Date</th></tr></thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.id}>
                  <td>
                    <button type="button" className="wpm-liste__fichier" onClick={() => setDetailId(m.id)}>
                      <img src={m.thumbnailURL ?? m.url} alt="" width="60" height="60" loading="lazy" />
                      <span><strong>{titreDe(m)}</strong><small>{m.filename}</small></span>
                    </button>
                  </td>
                  <td>{m.alt || '-'}</td>
                  <td>{jour(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {estPage && detail && (
        <Details
          key={detail.id}
          media={detail}
          locale={code}
          precedent={visibles[visibles.indexOf(detail) - 1]?.id}
          suivant={visibles[visibles.indexOf(detail) + 1]?.id}
          aller={setDetailId}
          fermer={() => setDetailId(null)}
          actualiser={charger}
          supprimer={async () => { if (await supprimer([detail.id])) setDetailId(null) }}
        />
      )}
    </div>
  )
}

type DetailsProps = {
  media: Media
  locale: string
  precedent?: string
  suivant?: string
  aller: (id: string) => void
  fermer: () => void
  actualiser: () => Promise<void>
  supprimer: () => void
}

function Details({ media, locale, precedent, suivant, aller, fermer, actualiser, supprimer }: DetailsProps) {
  const dialogue = useRef<HTMLDialogElement>(null)
  const [copie, setCopie] = useState(false)
  useEffect(() => { dialogue.current?.showModal() }, [])

  // Comme dans WordPress, chaque champ s'enregistre quand on le quitte.
  async function enregistrer(champ: string, valeur: string) {
    if ((media[champ as keyof Media] ?? '') === valeur) return
    const res = await fetch(`/api/media/${media.id}?locale=${locale}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [champ]: valeur }),
    })
    if (!res.ok) toast.error(await erreurDe(res))
    await actualiser()
  }
  const champ = (nom: 'alt' | 'titre' | 'legende' | 'description', label: string, multi: boolean) => (
    <label className="wpm-details__champ">
      <span>{label}</span>
      {multi
        ? <textarea defaultValue={media[nom] ?? ''} onBlur={(e) => enregistrer(nom, e.target.value)} />
        : <input defaultValue={nom === 'titre' ? titreDe(media) : media[nom] ?? ''} onBlur={(e) => enregistrer(nom, e.target.value)} />}
    </label>
  )
  const copier = async () => {
    await navigator.clipboard.writeText(media.url)
    setCopie(true)
    setTimeout(() => setCopie(false), 2000)
  }

  return (
    <dialog
      ref={dialogue}
      className="wpm-details"
      aria-labelledby="wpm-details-titre"
      onClose={fermer}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).matches('input, textarea')) return
        if (e.key === 'ArrowLeft' && precedent) aller(precedent)
        if (e.key === 'ArrowRight' && suivant) aller(suivant)
      }}
    >
      <header className="wpm-details__entete">
        <h2 id="wpm-details-titre">Détails du fichier joint</h2>
        <nav>
          <button type="button" aria-label="Fichier précédent" disabled={!precedent} onClick={() => precedent && aller(precedent)}>‹</button>
          <button type="button" aria-label="Fichier suivant" disabled={!suivant} onClick={() => suivant && aller(suivant)}>›</button>
          <button type="button" aria-label="Fermer" onClick={() => dialogue.current?.close()}>×</button>
        </nav>
      </header>
      <div className="wpm-details__corps">
        <div className="wpm-details__apercu">
          <img src={media.url} alt={media.alt ?? ''} />
          <a className="wpm-btn wpm-btn--grand" href={`/admin/collections/media/${media.id}`}>Modifier l'image</a>
        </div>
        <div className="wpm-details__infos">
          <dl>
            <div><dt>Téléversé le :</dt><dd>{jour(media.createdAt)}</dd></div>
            {media.televerse_par && <div><dt>Téléversé par :</dt><dd>{media.televerse_par}</dd></div>}
            <div><dt>Nom du fichier :</dt><dd>{media.filename}</dd></div>
            <div><dt>Type du fichier :</dt><dd>{media.mimeType}</dd></div>
            <div><dt>Taille du fichier :</dt><dd>{poids(media.filesize)}</dd></div>
            <div><dt>Dimensions :</dt><dd>{media.width} pixels par {media.height}</dd></div>
          </dl>
          <div className="wpm-details__champs">
            {champ('alt', 'Texte alternatif', true)}
            <p className="wpm-details__aide">Laissez vide si l'image est purement décorative.</p>
            {champ('titre', 'Titre', false)}
            {champ('legende', 'Légende de l’image', true)}
            {champ('description', 'Description', true)}
            <label className="wpm-details__champ">
              <span>URL du fichier :</span>
              <input readOnly value={media.url} className="wpm-details__url" />
            </label>
            <p className="wpm-details__aide">
              <button type="button" className="wpm-btn wpm-btn--petit" onClick={copier}>{copie ? 'Copiée !' : 'Copier l’URL dans le presse-papier'}</button>
            </p>
          </div>
          <p className="wpm-details__actions">
            <a href={media.url} target="_blank" rel="noopener noreferrer">Voir le fichier média</a> |{' '}
            <a href={`/admin/collections/media/${media.id}`}>Modifier plus de détails</a> |{' '}
            <a href={media.url} download={media.filename}>Télécharger le fichier</a> |{' '}
            <button type="button" className="wpm-details__supprimer" onClick={supprimer}>Supprimer définitivement</button>
          </p>
        </div>
      </div>
    </dialog>
  )
}
