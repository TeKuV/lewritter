// Session du back-office, ouverte après une connexion par la console (src/app/auth/console/*).
// Le jeton est vérifié à chaque requête, et comparé à l'« époque » du compte, que la déconnexion fait avancer.
import { jwtVerify, SignJWT } from 'jose'
import { type AuthStrategy, extractJWT, generatePayloadCookie, getFieldsToSign, type Payload } from 'payload'

const cle = (payload: Payload) => new TextEncoder().encode(payload.secret)

export const strategieConsole: AuthStrategy = {
  name: 'console',
  authenticate: async ({ headers, payload }) => {
    const jeton = extractJWT({ headers, payload })
    if (!jeton) return { user: null }
    try {
      const { payload: claims } = await jwtVerify(jeton, cle(payload), { algorithms: ['HS256'] })
      const user = await payload.findByID({ collection: 'users', id: String(claims.id), disableErrors: true, overrideAccess: true, showHiddenFields: true })
      if (!user || claims.collection !== 'users' || claims.ep !== ((user as { epoque?: number | null }).epoque ?? 0)) return { user: null }
      return { user: { ...user, collection: 'users', _strategy: 'console' } }
    } catch {
      return { user: null } // jeton expiré ou falsifié
    }
  },
}

/** Le cookie de session d'un compte local dont l'identité vient d'être prouvée par la console. */
export async function cookieDeSession(payload: Payload, user: Record<string, unknown> & { email: string }) {
  const collectionConfig = payload.collections.users.config
  const auth = collectionConfig.auth
  const fields = getFieldsToSign({ collectionConfig, email: user.email, user: { ...user, collection: 'users' } as never })
  const token = await new SignJWT(fields as never).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(`${auth.tokenExpiration} secs`).sign(cle(payload))
  return generatePayloadCookie({ collectionAuthConfig: auth, cookiePrefix: payload.config.cookiePrefix, token })
}
