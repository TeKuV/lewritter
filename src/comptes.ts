import type { Payload } from 'payload'

import type { Role } from './roles.js'

/**
 * Crée le compte local d'un membre de la console, ou change son rôle. Le premier administrateur ne peut venir que d'ici :
 * le back-office n'a pas de mot de passe et ne crée jamais de compte à la connexion.
 */
export async function creerCompte(payload: Payload, email: string, role: Role = 'editor') {
  const adresse = email.trim().toLowerCase()
  if (!adresse.includes('@')) throw new Error(`Adresse invalide : ${email}`)
  const { docs } = await payload.find({ collection: 'users' as never, where: { email: { equals: adresse } }, limit: 1, overrideAccess: true })
  if (docs[0]) await payload.update({ collection: 'users' as never, id: (docs[0] as { id: string }).id, data: { role } as never, overrideAccess: true })
  else await payload.create({ collection: 'users' as never, data: { email: adresse, role } as never, overrideAccess: true })
  return `${adresse} : ${role}`
}
