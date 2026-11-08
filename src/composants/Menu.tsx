'use client'
// Le menu noir de gauche, construit depuis la configuration : la rubrique en cours déplie ses sous-menus, comme dans wp-admin.
// Ordre : tableau de bord, collections en éditeur de blocs, médiathèque, fiches uniques (globals), autres collections, comptes.
// Une collection règle son icône et une séparation dans admin.custom.lewritter ({ icone, separe, tous }).
import { Link, useAuth, useConfig, useEntityVisibility } from '@payloadcms/ui'
import { usePathname } from 'next/navigation.js'

import { libelle, reglagesEditeur, reglagesFiche } from './outils.js'

const ICONES: Record<string, string> = {
  bord: 'M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z',
  articles: 'M4 2h9l3 3v13H4zM7 7h6v1.5H7zM7 10.5h6V12H7zM7 14h4v1.5H7z',
  media: 'M2 4h16v12H2zM4 14h12l-4-5-3 3.5L7 10z',
  comptes: 'M10 3a4 4 0 110 8 4 4 0 010-8zM3 18c0-4 3-6 7-6s7 2 7 6z',
  textes: 'M3 3h14v3h-1.5V4.5h-4V15.5h2V17h-7v-1.5h2V4.5h-4V6H3z',
  grille: 'M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z',
  ecran: 'M2 4h16v10H2zM4 6v6h12V6zM7 15.5h6V17H7z',
  etoile: 'M10 2l2.5 5.2 5.5.8-4 4 1 5.7L10 15l-5 2.7 1-5.7-4-4 5.5-.8z',
  bulle: 'M2 3h16v11H8l-4 4v-4H2z',
  barres: 'M3 17V9h3v8zM8.5 17V3h3v14zM14 17v-5h3v5z',
  courrier: 'M2 4h16v12H2zM4 6.5V14h12V6.5l-6 4.5z',
  fiche: 'M4 2h12v16H4zM6 5v1.5h8V5zM6 8.5V10h8V8.5zM6 12v1.5h5V12z',
}

type Rubrique = { href: string; label: string; icone: string; separe?: boolean; sous?: { href: string; label: string }[] }

export default function Menu() {
  const chemin = usePathname()
  const { user } = useAuth()
  const { config } = useConfig()
  const { isEntityVisible } = useEntityVisibility()
  const estAdmin = (user as { role?: string } | null)?.role === 'admin'
  const defaut = config.localization ? config.localization.defaultLocale : null
  const ajouter = (slug: string) => `/admin/collections/${slug}/create${defaut ? `?locale=${defaut}` : ''}`

  const visibles = config.collections.filter((c) => !c.slug.startsWith('payload-') && isEntityVisible({ collectionSlug: c.slug }))
  const fiche = (c: (typeof visibles)[number], icone: string): Rubrique => {
    const r = reglagesFiche(c)
    const pluriel = libelle(c.labels?.plural, c.slug)
    return {
      href: `/admin/collections/${c.slug}`,
      label: pluriel,
      icone: r.icone ?? icone,
      separe: r.separe,
      sous: [
        { href: `/admin/collections/${c.slug}`, label: r.tous ?? `Tout : ${pluriel.toLowerCase()}` },
        { href: ajouter(c.slug), label: 'Ajouter' },
      ],
    }
  }
  const editeurs = visibles.filter((c) => reglagesEditeur(c))
  const autres = visibles.filter((c) => !reglagesEditeur(c) && c.slug !== 'media' && c.slug !== 'users')
  const rubriques: Rubrique[] = [
    { href: '/admin', label: 'Tableau de bord', icone: 'bord' },
    ...editeurs.map((c) => fiche(c, 'articles')),
    ...(visibles.some((c) => c.slug === 'media')
      ? [{ href: '/admin/collections/media', label: 'Médias', icone: 'media', sous: [{ href: '/admin/collections/media', label: 'Médiathèque' }, { href: '/admin/collections/media?ajouter=1', label: 'Ajouter un fichier média' }] }]
      : []),
    ...config.globals.filter((g) => isEntityVisible({ globalSlug: g.slug })).map((g, i) => ({ href: `/admin/globals/${g.slug}`, label: libelle(g.label, g.slug), icone: reglagesFiche(g as never).icone ?? 'textes', separe: i === 0 || reglagesFiche(g as never).separe })),
    ...autres.map((c) => fiche(c, 'fiche')),
    // Comme dans WordPress : « Comptes » pour un administrateur, « Profil » seul pour les autres.
    estAdmin
      ? { href: '/admin/collections/users', label: 'Comptes', icone: 'comptes', sous: [{ href: '/admin/collections/users', label: 'Tous les comptes' }, { href: '/admin/collections/users/create', label: 'Ajouter un compte' }, { href: '/admin/account', label: 'Profil' }] }
      : { href: '/admin/account', label: 'Profil', icone: 'comptes' },
  ]
  // Une rubrique sans « Ajouter » possible (demandes de contact) : son sous-menu ne garde que la liste.
  for (const r of rubriques) if (r.sous && autres.some((c) => r.href.endsWith(`/${c.slug}`) && c.admin?.custom?.lewritter?.lectureSeule)) r.sous = r.sous.slice(0, 1)

  return (
    <nav className="wp-menu" aria-label="Menu principal">
      <ul>
        {rubriques.map((r) => {
          const actif = r.href === '/admin' ? chemin === '/admin' : chemin.startsWith(r.href) || Boolean(r.sous?.some((s) => chemin === s.href.split('?')[0]))
          return (
            <li key={r.href} className={`wp-menu__rubrique${actif ? ' wp-menu__rubrique--active' : ''}${r.separe ? ' wp-menu__rubrique--separee' : ''}`}>
              <Link href={r.href} prefetch={false} aria-current={actif ? 'page' : undefined}>
                <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path fillRule="evenodd" d={ICONES[r.icone] ?? ICONES.fiche} /></svg>
                <span>{r.label}</span>
              </Link>
              {r.sous && r.sous.length > 1 && (
                <ul className="wp-menu__sous">
                  {r.sous.map((s) => {
                    const sChemin = s.href.split('?')[0]
                    const sActif = chemin === sChemin && !s.href.includes('?ajouter')
                    return (
                      <li key={s.href}>
                        <Link href={s.href} prefetch={false} className={sActif ? 'wp-menu__lien-actif' : undefined}>{s.label}</Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
