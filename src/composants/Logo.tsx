import type { Payload } from 'payload'

import type { ReglagesClient } from '../index.js'

export default function Logo({ payload }: { payload?: Payload }) {
  const r = payload?.config.admin.custom?.lewritter as ReglagesClient | undefined
  return r?.logo ? <img src={r.logo} alt={r.nom} width="220" /> : <strong style={{ fontSize: 28 }}>{r?.nom}</strong>
}
