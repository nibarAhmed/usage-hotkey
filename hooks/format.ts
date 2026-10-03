import type { SessionRateLimit, SessionUsage } from 'claude-code'

const LABELS: Record<string, string> = {
  five_hour: 'Session',
  seven_day: 'Weekly',
  spend_limit: 'Spend limit'
}

// Largest first; a countdown speaks its first unit and the one below it.
const UNITS = [
  ['day', 24 * 60],
  ['hour', 60],
  ['minute', 1]
] as const

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
const count = (n: number) => n.toLocaleString('en-US')
const parse = (iso: string | undefined) => (iso ? Date.parse(iso) : NaN)

const spell = (minutes: number): string => {
  for (const [i, [unit, size]] of UNITS.entries()) {
    if (minutes < size) {
      continue
    }

    const next = UNITS[i + 1]
    const rest = next ? Math.floor((minutes % size) / next[1]) : 0

    return `${plural(Math.floor(minutes / size), unit)}${next && rest ? ` ${plural(rest, next[0])}` : ''}`
  }

  return plural(minutes, 'minute')
}

export const untilReset = (resetsAt: string | undefined, now: number): string => {
  const at = parse(resetsAt)

  return Number.isNaN(at) ? 'reset time unknown' : `resets in ${spell(Math.max(0, Math.round((at - now) / 60000)))}`
}

// The wall-clock time of a reset in the person's time zone, as /usage shows it:
// "3:10 PM" for today, "Friday 9 AM" for another day.
export const resetClock = (resetsAt: string | undefined, now: number): string => {
  const at = parse(resetsAt)

  if (Number.isNaN(at)) {
    return ''
  }

  const date = new Date(at)
  // Newer ICU puts a no-break or narrow no-break space before AM/PM.
  const time = date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(':00', '')
  const isToday = date.toDateString() === new Date(now).toDateString()

  return isToday ? time : `${date.toLocaleDateString('en-US', { weekday: 'long' })} ${time}`
}

const describeLimit = (limit: SessionRateLimit, now: number): string => {
  const clock = resetClock(limit.resetsAt, now)
  const at = clock ? `, at ${clock}` : ''

  return `${LABELS[limit.kind] ?? limit.kind} ${Math.round(limit.percentUsed)} percent used, ${untilReset(limit.resetsAt, now)}${at}`
}

const describeContext = ({ tokens, window }: SessionUsage['context']): string => {
  if (tokens === undefined) {
    return `Context window ${count(window)} tokens, no reading yet`
  }

  return `Context ${count(tokens)} of ${count(window)} tokens`
}

export const describeUsage = (usage: SessionUsage, now: number): string => {
  const limits = usage.rateLimits.length
    ? usage.rateLimits.map(limit => describeLimit(limit, now))
    : ['No usage limit reading yet']
  const cost = usage.cost ? [`Cost ${usage.cost.usd.toFixed(2)} dollars`] : []

  return `${[describeContext(usage.context), ...limits, ...cost].join('. ')}.`
}
