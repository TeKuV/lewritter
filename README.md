# LeWritter

Un back-office headless bâti sur [Payload](https://payloadcms.com) (MIT), avec l'administration de WordPress que les rédacteurs connaissent déjà :

- la barre noire du haut, le menu de gauche et le tableau de bord « D'un coup d'œil » / « Activité » de wp-admin ;
- l'éditeur de blocs : plein écran, « / » pour choisir un bloc, panneau de droite (image mise en avant, extrait, état, langue, révisions), brouillons, sauvegarde automatique et corbeille ;
- la médiathèque en grille, avec glisser-déposer et tailles WebP préparées à l'envoi ;
- la connexion par une console OIDC (« Se connecter avec … »), sans mot de passe local : PKCE, state, nonce, jeton vérifié, et déconnexion qui révoque les sessions de tous les appareils.

Payload reste une dépendance npm, pas une copie : LeWritter suit ses mises à jour, et un site garde toute l'API de Payload (REST, GraphQL, API locale, migrations).

Chaque site déclare ses propres collections. LeWritter ajoute la médiathèque (`media`), les comptes (`users`) et l'interface.

## Installation

Dans un projet Payload 3 (Next.js) :

```bash
npm install lewritter
```

`src/payload.config.ts` :

```ts
import { postgresAdapter } from '@payloadcms/db-postgres'
import { editeurDeBlocs, lewritter } from 'lewritter'
import { buildConfig } from 'payload'
import sharp from 'sharp'

const Articles = editeurDeBlocs(
  {
    slug: 'articles',
    labels: { singular: 'Article', plural: 'Articles' },
    access: { read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }) },
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'body', type: 'richText' },
      { name: 'slug', type: 'text', required: true, unique: true },
      { name: 'dek', type: 'textarea' },
      { name: 'illustration', type: 'upload', relationTo: 'media' },
    ],
  },
  { titre: 'title', slug: 'slug', extrait: 'dek', image: 'illustration', voir: { fr: 'https://exemple.fr/articles/' } },
)

export default buildConfig({
  collections: [Articles],
  plugins: [
    lewritter({
      nom: 'Exemple',
      logo: '/logo.svg', // fichiers du dossier public/ du back-office
      monogramme: '/monogramme.svg',
      siteUrl: 'https://exemple.fr',
      purge: { url: 'http://site:3000/api/_revalidate', secret: process.env.REVALIDATE_SECRET },
    }),
  ],
  secret: process.env.PAYLOAD_SECRET!,
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL } }),
  sharp,
})
```

Les deux routes de la connexion par la console :

```ts
// src/app/auth/console/route.ts
import config from '@payload-config'
import { routesConsole } from 'lewritter/routes'
export const GET = routesConsole(config).debut
```

```ts
// src/app/auth/console/callback/route.ts
import config from '@payload-config'
import { routesConsole } from 'lewritter/routes'
export const GET = routesConsole(config).retour
```

L'apparence, dans `src/app/(payload)/custom.scss` :

```scss
@use 'lewritter/style.scss';
```

Puis `npx payload generate:importmap`.

## Réglages

Environnement du back-office :

| Variable | Rôle |
| --- | --- |
| `SERVER_URL` | Adresse publique du back-office (sert aussi au CSRF et à l'adresse de retour de la console) |
| `CONSOLE_URL` | Adresse publique de la console (émetteur des jetons) |
| `CONSOLE_INTERNAL_URL` | Facultatif : adresse de la console vue depuis le serveur (réseau Docker) |
| `CONSOLE_CLIENT_ID`, `CONSOLE_CLIENT_SECRET` | Client OIDC déclaré dans la console, retour `${SERVER_URL}/auth/console/callback` |
| `MEDIA_DIR` | Dossier des fichiers de la médiathèque (`media` par défaut) |

La console doit fournir `openid email profile` et un `email_verified` à `true`. Un compte local doit exister avec le même e-mail : LeWritter n'en crée jamais à la connexion. Le premier compte se crée avec `creerCompte(payload, email, 'admin')`, par exemple dans un script lancé par `npx payload run`.

## Comptes

Comme dans wp-admin :

- un administrateur voit « Comptes » dans le menu : « Tous les comptes » (filtres par rôle au-dessus de la liste), « Ajouter un compte » et « Profil » ;
- un éditeur ne voit que « Profil », où il change son prénom et son nom ; l'e-mail et le rôle ne changent que par un administrateur ;
- la barre du haut dit « Bonjour » avec le prénom et le nom, ou l'e-mail s'ils sont vides ;
- personne ne change son propre rôle ni ne supprime son propre compte, et le dernier administrateur ne peut être ni rétrogradé ni supprimé.

Les rôles reprennent ceux de WordPress :

| Rôle | Éditeur de blocs | Médiathèque | Autres collections, fiches uniques | Comptes |
| --- | --- | --- | --- | --- |
| Administrateur | tout | tout | selon le site | tout |
| Éditeur | tout, choisit l'auteur d'une fiche | tout | selon le site | lit la liste, modifie son profil |
| Auteur | crée, publie, modifie et supprime ses fiches | envoie, modifie et supprime ses fichiers | lecture | son profil |
| Contributeur | écrit ses brouillons, sans les publier ; plus rien une fois publiés | lecture | lecture | son profil |

Chaque fiche de l'éditeur de blocs a un champ `auteur` (relation vers `users`), rempli à la création. Une fiche créée avant la 0.2 n'en a pas : seul un éditeur ou un administrateur peut la modifier tant qu'on ne lui en a pas donné un. Un fichier de la médiathèque appartient à la dernière personne qui l'a modifié (`televerse_par`).

La 0.2 ajoute les champs `prenom` et `nom` aux comptes, deux rôles, et le champ `auteur` à chaque collection de l'éditeur de blocs : un site qui a des migrations en crée une (`npx payload migrate:create`).

`editeurDeBlocs(collection, options)` :

| Option | Rôle |
| --- | --- |
| `titre` | Champ titre (`title` par défaut) |
| `image` | Champ upload vers `media`, réglé par « Définir l'image mise en avant » |
| `extrait` | Champ texte réglé par « Ajouter un extrait… » |
| `slug` | Champ adresse, rempli depuis le titre ; ses anciennes valeurs restent dans `anciens_slugs` pour les redirections |
| `cle` | Champ non traduit rempli depuis le titre ; une fiche sans lui (brouillon automatique vide) reste hors des listes et disparaît le lendemain |
| `voir` | Préfixe de l'adresse publique par langue, pour le lien « Voir » de la liste |
| `sauvegarde` | Intervalle de la sauvegarde automatique en millisecondes (5000) |

Une collection règle sa place dans le menu avec `admin.custom.lewritter` : `icone` (`articles`, `media`, `textes`, `grille`, `ecran`, `etoile`, `bulle`, `barres`, `courrier`, `fiche`), `tous` (libellé de la liste), `separe`, `lectureSeule` (pas de « Ajouter »), `tableauDeBord` (comptée au tableau de bord) et `sansPurge` (n'appelle pas `purge`).

## Développer

```bash
npm install
npm run build   # dist/
npm pack        # lewritter-x.y.z.tgz, à installer dans un site avec npm install ./lewritter-x.y.z.tgz
```

Premier utilisateur : le back-office de [lekwatt.com](https://lekwatt.com) (dépôt TeKuV/ndop, dossier `cms/`).

## Licence

MIT, comme Payload. Voir [LICENSE](LICENSE).
