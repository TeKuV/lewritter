// Connexion par la console de l'équipe, même contrat que les autres applications (dépôt mbere, docs/api-contract.md).
// Le site hôte expose ces deux fonctions aux adresses /auth/console et /auth/console/callback (voir le README).
// Réglages lus dans l'environnement : SERVER_URL, CONSOLE_URL, CONSOLE_INTERNAL_URL (facultatif), CONSOLE_CLIENT_ID, CONSOLE_CLIENT_SECRET.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextResponse } from 'next/server.js'
import { getPayload, type SanitizedConfig } from 'payload'

import { cookieDeSession } from './auth/strategie.js'

const aleatoire = (n: number) => randomBytes(n).toString('base64url')
const egal = (a: unknown, b: unknown) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const [x, y] = [Buffer.from(a), Buffer.from(b)]
  return x.length === y.length && timingSafeEqual(x, y)
}
const reglages = () => {
  const { CONSOLE_URL, CONSOLE_INTERNAL_URL, CONSOLE_CLIENT_ID, CONSOLE_CLIENT_SECRET, SERVER_URL } = process.env
  if (!CONSOLE_URL || !CONSOLE_CLIENT_ID || !CONSOLE_CLIENT_SECRET || !SERVER_URL) return null
  return { console: CONSOLE_URL, interne: CONSOLE_INTERNAL_URL || CONSOLE_URL, client: CONSOLE_CLIENT_ID, secret: CONSOLE_CLIENT_SECRET, serveur: SERVER_URL }
}
const nonReglee = () => new NextResponse('Connexion par la console non réglée', { status: 404 })

export function routesConsole(config: SanitizedConfig | Promise<SanitizedConfig>) {
  /** Début : envoie le navigateur à la console, avec state, nonce et PKCE gardés dans un cookie de ce navigateur. */
  async function debut(request: Request) {
    const r = reglages()
    if (!r) return nonReglee()
    const demande = new URL(request.url).searchParams.get('next') ?? ''
    const suite = /^\/(?![/\\])/.test(demande) ? demande : '/admin'
    const [state, nonce, verifier] = [aleatoire(30), aleatoire(30), aleatoire(48)]
    const url = new URL(`${r.console}/oauth/auth`)
    url.search = new URLSearchParams({
      client_id: r.client,
      redirect_uri: `${r.serveur}/auth/console/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString()
    const reponse = NextResponse.redirect(url)
    // Lié à ce navigateur, illisible par le JavaScript de la page, valable 10 minutes et effacé au retour.
    reponse.cookies.set('console_sso', Buffer.from(JSON.stringify({ state, nonce, verifier, suite })).toString('base64url'), {
      httpOnly: true,
      secure: r.serveur.startsWith('https:'),
      sameSite: 'lax',
      path: '/auth/console',
      maxAge: 600,
    })
    return reponse
  }

  /** Retour : vérifie state, jeton et nonce, puis ouvre la session du compte local de même e-mail. Aucun compte n'est créé. */
  async function retour(request: Request) {
    const r = reglages()
    if (!r) return nonReglee()
    const payload = await getPayload({ config })
    const refus = (raison: string, code: 'compte' | 'connexion' = 'connexion') => {
      payload.logger.warn(`Connexion console refusée : ${raison}`)
      const reponse = NextResponse.redirect(`${r.serveur}/admin/login?erreur=${code}`)
      reponse.cookies.delete({ name: 'console_sso', path: '/auth/console' })
      return reponse
    }

    const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)console_sso=([^;]+)/)?.[1]
    if (!cookie) return refus('demande de connexion absente ou expirée')
    let attendu: { state?: string; nonce?: string; verifier?: string; suite?: string }
    try {
      attendu = JSON.parse(Buffer.from(cookie, 'base64url').toString())
    } catch {
      return refus('demande de connexion illisible')
    }
    const params = new URL(request.url).searchParams
    if (!egal(params.get('state'), attendu.state)) return refus('state différent')
    const code = params.get('code')
    if (params.get('error') || !code || !attendu.verifier) return refus(params.get('error') ?? 'code absent')

    let email: string
    try {
      const res = await fetch(`${r.interne}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${r.serveur}/auth/console/callback`,
          client_id: r.client,
          client_secret: r.secret,
          code_verifier: attendu.verifier,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) return refus(`jeton refusé (${res.status})`)
      const { id_token: idToken } = await res.json()
      // Signature, émetteur, destinataire et expiration : jwtVerify ; le nonce lie la réponse à cette demande.
      const { payload: claims } = await jwtVerify(idToken, createRemoteJWKSet(new URL(`${r.interne}/oauth/jwks`)), { issuer: r.console, audience: r.client, maxTokenAge: '10 minutes' })
      if (!egal(claims.nonce, attendu.nonce)) return refus('nonce différent')
      if (claims.email_verified !== true || typeof claims.email !== 'string') return refus('e-mail non vérifié')
      email = claims.email.toLowerCase()
    } catch (e) {
      return refus(`échange impossible : ${(e as Error).message}`)
    }

    const { docs } = await payload.find({ collection: 'users' as never, where: { email: { equals: email } }, limit: 1, overrideAccess: true, showHiddenFields: true })
    const user = docs[0]
    if (!user) return refus(`aucun compte pour ${email}`, 'compte')

    // Chaque connexion repart de la langue par défaut : Payload retient sinon la dernière langue du compte, sans que ça se voie.
    const suite = new URL(attendu.suite ?? '/admin', r.serveur)
    const langue = payload.config.localization ? payload.config.localization.defaultLocale : null
    if (suite.pathname === '/admin' && langue) suite.searchParams.set('locale', langue)
    const reponse = NextResponse.redirect(suite)
    reponse.cookies.delete({ name: 'console_sso', path: '/auth/console' })
    // Après : cookies.delete réécrit tout l'en-tête Set-Cookie et effacerait la session.
    reponse.headers.append('Set-Cookie', await cookieDeSession(payload, user as never))
    return reponse
  }

  return { debut, retour }
}
