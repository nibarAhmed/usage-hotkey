import type { SessionRateLimit } from 'claude-code'

// What one rate-limit window has gained during the current conversation: the
// points counted so far, and the last reading they were counted from.
type Window = { used: number; last: number; resetsAt?: string }

// What every running session has spent so far, in dollars, by session id.
export type Ledger = Record<string, number>

// The ledger all sessions share, and which entry is this session's.
export type Spend = { me: string; ledger: Ledger }

export type Tally = { startedAt: number; windows: Record<string, Window>; ledger?: Ledger }

// A new window resets a whole window length after the old one did, so only a
// reset time an hour or more later is a roll-over: one that shifts by minutes is
// the same window. Without both reset times, a drop is all there is to go by.
const ROLL = 60 * 60 * 1000

const rolled = (held: Window, percentUsed: number, seen: string | undefined) =>
  held.resetsAt !== undefined && seen !== undefined
    ? Date.parse(seen) - Date.parse(held.resetsAt) >= ROLL
    : percentUsed < held.last

// The windows are the account's, so what they gained since the last reading is
// every session's. This session's part of it is its part of what all of them
// spent meanwhile. A total that went down started over (a /clear). Nothing spent
// anywhere means the points came from outside Claude Code, so none are ours.
// Without a ledger (or an empty one) every point is ours, as before there was one.
export const share = (held: Ledger | undefined, spend: Spend | undefined): number => {
  if (!spend || Object.keys(spend.ledger).length === 0) {
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
// reading. A dip within the same window (a reply that landed late) adds nothing
// and keeps the higher figure, so the climb back is not counted twice. Each gain
// is scaled by this session's share of the spending. The
// spending baseline only moves on with a reading that moved: a press or a
// measurement with no new figures leaves it, so what others spent meanwhile is
// still set against the rise it shows up with.
export const observe = (
  tally: Tally | undefined,
  startedAt: number,
  limits: readonly SessionRateLimit[],
  spend?: Spend
): Tally => {
  const isNew = tally?.startedAt !== startedAt
  const part = share(tally?.ledger, spend)
  const windows: Record<string, Window> = {}
  let moved = !tally?.ledger

  for (const { kind, percentUsed, resetsAt } of limits) {
    const held = tally?.windows[kind]
    const used = held && !isNew ? held.used : 0

    if (!held) {
      windows[kind] = { used, last: percentUsed, resetsAt }
    } else if (rolled(held, percentUsed, resetsAt)) {
      moved = true
      windows[kind] = { used: used + percentUsed * part, last: percentUsed, resetsAt }
    } else {
      const gain = Math.max(0, percentUsed - held.last)

      moved ||= gain > 0
      windows[kind] = { used: used + gain * part, last: Math.max(held.last, percentUsed), resetsAt }
    }
  }

  // A window missing from this reading keeps what it had
  for (const [kind, held] of Object.entries(tally?.windows ?? {})) {
    windows[kind] ??= isNew ? { ...held, used: 0 } : held
  }

  return { startedAt, windows, ledger: moved ? spend?.ledger : tally?.ledger }
}
