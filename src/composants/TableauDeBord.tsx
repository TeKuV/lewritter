// Le tableau de bord : « D'un coup d'œil » et « Activité », comme les boîtes d'accueil de wp-admin.
// Compte les collections en éditeur de blocs, la médiathèque et celles marquées admin.custom.lewritter.tableauDeBord.
import type { Payload } from 'payload'

import { collectionsEditeur, libelle, nombre, reglagesEditeur, reglagesFiche } from './outils.js'

type Props = { payload?: Payload; initPageResult?: { req: { payload: Payload } }; locale?: { code?: string } }

const date = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default async function TableauDeBord({ payload: direct, initPageResult, locale }: Props) {
  const payload = (direct ?? initPageResult?.req.payload) as Payload
  const collections = payload.config.collections
  const editeurs = collectionsEditeur(collections)
  const comptees = collections.filter((c) => c.slug === 'media' || reglagesFiche(c).tableauDeBord)
  const avecContenu = (c: (typeof editeurs)[number]) => ({ [reglagesEditeur(c)!.cle ?? reglagesEditeur(c)!.titre]: { exists: true } })

  const lignes = await Promise.all([
    ...editeurs.flatMap((c) => [
      payload.count({ collection: c.slug as never, where: { ...avecContenu(c), _status: { equals: 'published' } } as never }).then((r) => ({ texte: nombre(r.totalDocs, libelle(c.labels?.singular, c.slug), libelle(c.labels?.plural, c.slug)), href: `/admin/collections/${c.slug}?where[_status][equals]=published` })),
      payload.count({ collection: c.slug as never, where: { ...avecContenu(c), _status: { equals: 'draft' } } as never }).then((r) => ({ texte: nombre(r.totalDocs, 'brouillon', 'brouillons'), href: `/admin/collections/${c.slug}?where[_status][equals]=draft` })),
    ]),
    ...comptees.map((c) => payload.count({ collection: c.slug as never }).then((r) => ({ texte: c.slug === 'media' ? nombre(r.totalDocs, 'image', 'images') : nombre(r.totalDocs, libelle(c.labels?.singular, c.slug), libelle(c.labels?.plural, c.slug)), href: `/admin/collections/${c.slug}` }))),
  ])
  const recents = (await Promise.all(editeurs.map((c) =>
    payload.find({ collection: c.slug as never, where: avecContenu(c) as never, sort: '-updatedAt', limit: 6, depth: 0, draft: true, locale: (locale?.code ?? 'all') as never, fallbackLocale: (payload.config.localization ? payload.config.localization.defaultLocale : undefined) as never })
      .then((r) => r.docs.map((d) => ({ collection: c.slug, titre: (d as Record<string, unknown>)[reglagesEditeur(c)!.titre] as string | undefined, ...(d as { id: string; updatedAt: string; _status?: string }) }))),
  ))).flat().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)

  return (
    <main className="wp-bord">
      <h1>Tableau de bord</h1>
      <div className="wp-bord__colonnes">
        <section className="wp-boite">
          <h2 className="wp-boite__titre">D'un coup d'œil</h2>
          <ul className="wp-bord__chiffres">
            {lignes.map((l) => <li key={l.href}><a href={l.href}>{l.texte}</a></li>)}
          </ul>
        </section>
        {editeurs.length > 0 && (
          <section className="wp-boite">
            <h2 className="wp-boite__titre">Activité</h2>
            <h3 className="wp-bord__sous-titre">Dernières modifications</h3>
            <ul className="wp-bord__activite">
              {recents.map((a) => (
                <li key={a.id}>
                  <time dateTime={a.updatedAt}>{date(a.updatedAt)}</time>
                  <span>
                    <a href={`/admin/collections/${a.collection}/${a.id}`}>{a.titre || '(sans titre)'}</a>
                    {a._status === 'draft' && <em> - Brouillon</em>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
