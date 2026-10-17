import type { SessionRateLimit } from 'claude-code'

// What one rate-limit window has gained during the current conversation: the
// points counted so far, and the last reading they were counted from.
type Window = { used: number; last: number; resetsAt?: string }

export type Tally = { startedAt: number; windows: Record<string, Window> }

// A later reset time than the one held means the window rolled over.
const rolled = (held: string | undefined, seen: string | undefined) =>
  held !== undefined && seen !== undefined && Date.parse(seen) - Date.parse(held) > 60000

// Folds one reading into the tally. A new startedAt (a launch or a /clear) zeroes
// what each window used but keeps its last reading, so the first reply of the new
// conversation is counted from where the old one left off. After a roll-over the
// new window counts from 0, so its whole percentage is this conversation's.
export const observe = (tally: Tally | undefined, startedAt: number, limits: readonly SessionRateLimit[]): Tally => {
  const isNew = tally?.startedAt !== startedAt
  const windows: Record<string, Window> = {}

  for (const { kind, percentUsed, resetsAt } of limits) {
    const held = tally?.windows[kind]
    const used = held && !isNew ? held.used : 0

    if (!held) {
      windows[kind] = { used, last: percentUsed, resetsAt }
    } else if (rolled(held.resetsAt, resetsAt) || percentUsed < held.last) {
      windows[kind] = { used: used + percentUsed, last: percentUsed, resetsAt }
    } else {
      windows[kind] = { used: used + percentUsed - held.last, last: percentUsed, resetsAt }
    }
  }

  // A window missing from this reading keeps what it had
  for (const [kind, held] of Object.entries(tally?.windows ?? {})) {
    windows[kind] ??= isNew ? { ...held, used: 0 } : held
  }

  return { startedAt, windows }
}
