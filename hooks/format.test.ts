import { describe, expect, test } from 'claude-code/testing'

import { describeUsage, resetClock, untilReset } from './format'

// Local noon, so "today" and "another day" hold in any time zone.
const NOW = new Date(2026, 9, 3, 12, 0).getTime()
const at = (ms: number) => new Date(NOW + ms).toISOString()
const MIN = 60000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('untilReset', () => {
  test('speaks minutes, hours and days', () => {
    expect(untilReset(at(MIN), NOW)).toBe('resets in 1 minute')
    expect(untilReset(at(2 * HOUR + 10 * MIN), NOW)).toBe('resets in 2 hours 10 minutes')
    expect(untilReset(at(2 * DAY + 3 * HOUR), NOW)).toBe('resets in 2 days 3 hours')
  })

  test('handles a missing or past time', () => {
    expect(untilReset(undefined, NOW)).toBe('reset time unknown')
    expect(untilReset(at(-HOUR), NOW)).toBe('resets in 0 minutes')
  })
})

// The clock time follows the zone the test runs in, so these match its shape.
describe('resetClock', () => {
  test('says a time today and a weekday plus time on another day', () => {
    expect(resetClock(at(2 * HOUR + 10 * MIN), NOW)).toMatch(/^\d{1,2}(:\d\d)? [AP]M$/)
    expect(resetClock(at(6 * DAY + 2 * HOUR), NOW)).toMatch(/^\w+day \d{1,2}(:\d\d)? [AP]M$/)
  })

  test('is empty for a missing time', () => {
    expect(resetClock(undefined, NOW)).toBe('')
  })
})

describe('describeUsage', () => {
  test('reads tokens, both windows with countdown and clock time, then cost', () => {
    expect(
      describeUsage(
        {
          context: { tokens: 45000, window: 200000, percent: 22.5 },
          cost: { usd: 1.234 },
          rateLimits: [
            { kind: 'five_hour', percentUsed: 23.5, resetsAt: at(2 * HOUR + 10 * MIN) },
            { kind: 'seven_day', percentUsed: 41, resetsAt: at(2 * DAY + 3 * HOUR) }
          ]
        } as never,
        NOW
      )
    ).toMatch(
      /^Context 45,000 of 200,000 tokens, 23 percent\. Session 24 percent used, resets in 2 hours 10 minutes, at \d{1,2}(:\d\d)? [AP]M\. Weekly 41 percent used, resets in 2 days 3 hours, at \w+day \d{1,2}(:\d\d)? [AP]M\. Cost 1\.23 dollars\.$/
    )
  })

  test('says so when there is no reading', () => {
    expect(describeUsage({ context: { window: 200000 }, rateLimits: [] } as never, NOW)).toBe(
      'Context window 200,000 tokens, no reading yet. No usage limit reading yet.'
    )
  })
})
