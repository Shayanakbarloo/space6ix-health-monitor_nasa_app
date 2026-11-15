import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight } from '@phosphor-icons/react'
import { fetchUsers, login } from './api'
import type { User } from './data/users'
import { EASE, Logo } from './ui'

const ROLE_NOTE: Record<User['role'], string> = {
  crew: "Sees the whole crew's health",
  cmo: "Sees the whole crew's health",
  surgeon: 'Sees only what the crew sends to Earth',
}

/** Pick a person to sign in as. One tap opens Live monitor for that person. */
export default function SignIn({ onDone }: { onDone: () => void }) {
  const [users, setUsers] = useState<User[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers().then((r) => (r.ok ? setUsers(r.data.users) : setError(`${r.error} Start it with "npm run dev".`)))
  }, [])

  const choose = async (u: User) => {
    if (busy) return
    setBusy(u.id)
    setError(null)
    const r = await login(u.id)
    setBusy(null)
    if (r.ok) onDone()
    else setError(r.error)
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="w-full max-w-md">
        <div className="flex items-center gap-4">
          <Logo size={52} />
          <div>
            <h1 className="text-2xl font-semibold tracking-[0.06em]">SOMA</h1>
            <p className="text-sm font-medium text-ink">Spaceflight Organ Monitoring Application</p>
            <p className="mt-0.5 text-sm text-muted">Choose a person to see their health</p>
          </div>
        </div>

        <section className="mt-8" aria-labelledby="who">
          <h2 id="who" className="mb-2 text-sm text-muted">
            Who are you?
          </h2>
          <div className="grid gap-2">
            {(users ?? []).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => void choose(u)}
                disabled={busy !== null}
                className="press group flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 text-left shadow-[0_10px_28px_-20px_rgba(30,64,130,0.3)] hover:border-line-strong hover:bg-raised disabled:opacity-60"
              >
                <span>
                  <span className="block font-medium">{u.name}</span>
                  <span className="block text-xs text-muted">{u.title}</span>
                </span>
                <span className="flex items-center gap-2 text-right text-xs text-dim">
                  {busy === u.id ? 'Opening...' : ROLE_NOTE[u.role]}
                  <ArrowRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
            {!users && !error && <p className="rounded-xl border border-line bg-panel px-4 py-4 text-sm text-muted">Loading accounts...</p>}
          </div>
          <p className="mt-3 text-xs text-dim">Demo accounts, no password. A real system would use the agency's own sign-in.</p>
        </section>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-urgent-bg px-3 py-2 text-sm text-urgent">
            {error}
          </p>
        )}

        <p className="mt-8 rounded-xl border border-line-strong px-4 py-3 text-center text-sm">A prototype for the NASA Space Apps Challenge. Not a medical device.</p>
        <p className="mt-3 text-center text-xs text-muted">Educational prototype. Not a medical device.</p>
      </motion.div>
    </div>
  )
}
