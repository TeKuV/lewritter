// La barre noire du haut, à la manière de wp-admin.
import type { Payload } from 'payload'

import type { ReglagesClient } from '../index.js'
import { collectionsEditeur, libelle } from './outils.js'

type Props = { payload?: Payload; locale?: { code?: string }; user?: { email?: string } }

export default function BarreAdmin({ payload, locale, user }: Props) {
  const r = payload?.config.admin.custom?.lewritter as ReglagesClient | undefined
  const langues = payload?.config.localization ? payload.config.localization.locales : []
  const defaut = payload?.config.localization ? payload.config.localization.defaultLocale : null
  const creer = payload ? collectionsEditeur(payload.config.collections)[0] : undefined
  return (
    <header className="wp-bar">
      <nav className="wp-bar__groupe" aria-label="Raccourcis">
        <a className="wp-bar__logo" href="/admin" aria-label="Tableau de bord">
          {r?.monogramme ? <img src={r.monogramme} alt="" width="20" height="20" /> : <span aria-hidden="true">⌂</span>}
        </a>
        {r?.siteUrl ? <a href={r.siteUrl} target="_blank" rel="noopener noreferrer">{r.nom}</a> : <span>{r?.nom}</span>}
        {creer && (
          <a href={`/admin/collections/${creer.slug}/create${defaut ? `?locale=${defaut}` : ''}`} title={`Ajouter : ${libelle(creer.labels?.singular, creer.slug)}`}>
            <span aria-hidden="true">+</span> Créer
          </a>
        )}
      </nav>
      <div className="wp-bar__groupe">
        {langues.length > 1 && (
          <span className="wp-bar__langues">
            {langues.map((l) =>
              l.code === locale?.code ? (
                <strong key={l.code} aria-current="true">{libelle(l.label, l.code)}</strong>
              ) : (
                <a key={l.code} href={`?locale=${l.code}`}>{libelle(l.label, l.code)}</a>
              ),
            )}
          </span>
        )}
        <a className="wp-bar__compte" href="/admin/account">Bonjour, {user?.email}</a>
        <a href="/admin/logout">Se déconnecter</a>
      </div>
    </header>
  )
}
