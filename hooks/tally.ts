import type { SessionRateLimit } from 'claude-code'

// What one rate-limit window has gained during the current conversation: the
// points counted so far, and the last reading they were counted from.
type Window = { used: number; last: number; resetsAt?: string }

// What every running session has spent so far, in dollars, by session id: the
// ledger all sessions share, and which entry is this session's.
export type Spend = { me: string; ledger: Record<string, number> }

export type Tally = { startedAt: number; windows: Record<string, Window>; ledger?: Record<string, number> }

// A later reset time than the one held means the window rolled over.
const rolled = (held: string | undefined, seen: string | undefined) =>
  held !== undefined && seen !== undefined && Date.parse(seen) - Date.parse(held) > 60000

// The windows are the account's, so what they gained since the last reading is
// every session's. This session's part of it is its part of what all of them
// spent meanwhile. A total that went down started over (a /clear). Nothing spent
// anywhere means the points came from outside Claude Code, so none are ours.
// Without a ledger every point is ours, as before there was one.
export const share = (held: Record<string, number> | undefined, spend: Spend | undefined): number => {
  if (!spend) {
    return 1
  }

  const spent = (id: string) => {
    const now = spend.ledger[id] ?? 0
    const was = held?.[id] ?? 0

    return now >= was ? now - was : now
  }
  const all = Object.keys(spend.ledger).reduce((sum, id) => sum + spent(id), 0)

  return all > 0 ? spent(spend.me) / all : 0
}

// Folds one reading into the tally. A new startedAt (a launch or a /clear) zeroes
// what each window used but keeps its last reading, so the first reply of the new
// conversation is counted from where the old one left off. After a roll-over the
// new window counts from 0, so its whole percentage is gained since the last
// reading. Each gain is scaled by this session's share of the spending.
export const observe = (
  tally: Tally | undefined,
  startedAt: number,
  limits: readonly SessionRateLimit[],
  spend?: Spend
): Tally => {
  const isNew = tally?.startedAt !== startedAt
  const part = share(tally?.ledger, spend)
  const windows: Record<string, Window> = {}

  for (const { kind, percentUsed, resetsAt } of limits) {
    const held = tally?.windows[kind]
    const used = held && !isNew ? held.used : 0

    if (!held) {
      windows[kind] = { used, last: percentUsed, resetsAt }
    } else if (rolled(held.resetsAt, resetsAt) || percentUsed < held.last) {
      windows[kind] = { used: used + percentUsed * part, last: percentUsed, resetsAt }
    } else {
      windows[kind] = { used: used + (percentUsed - held.last) * part, last: percentUsed, resetsAt }
    }
  }

  // A window missing from this reading keeps what it had
  for (const [kind, held] of Object.entries(tally?.windows ?? {})) {
    windows[kind] ??= isNew ? { ...held, used: 0 } : held
  }

  return { startedAt, windows, ledger: spend?.ledger }
}
