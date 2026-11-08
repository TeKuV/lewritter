// La seule entrée du back-office, sur le modèle de « Sign in with Google » : il n'y a pas de mot de passe local.
import type { Payload } from 'payload'

import type { ReglagesClient } from '../index.js'

const MESSAGES: Record<string, string> = {
  compte: "Votre compte de la console n'a pas d'accès à ce back-office. Demandez à un administrateur de vous ajouter.",
  connexion: 'La connexion par la console a échoué. Réessayez.',
}

type Props = { payload?: Payload; searchParams?: Record<string, string | string[] | undefined> }

export default function BoutonConsole({ payload, searchParams }: Props) {
  const r = payload?.config.admin.custom?.lewritter as ReglagesClient | undefined
  const message = MESSAGES[String(searchParams?.erreur ?? '')]
  return (
    <div style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
      {message && <p role="alert" style={{ margin: 0 }}>{message}</p>}
      {/* Un vrai lien, pas un <Link> : la redirection vers la console ne doit pas passer par le routeur de Next. */}
      <a className="wp-sso" href="/auth/console">
        {r?.monogramme && <img src={r.monogramme} alt="" width="18" height="18" />}
        <span>{`Se connecter avec ${r?.nom ?? 'la console'}`}</span>
      </a>
    </div>
  )
}
