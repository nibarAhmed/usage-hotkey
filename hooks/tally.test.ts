import { describe, expect, test } from 'claude-code/testing'

import { LOG, logReading, observe, share, type Reading } from './tally'

const RESET = '2026-10-17T15:00:00.000Z'
const LATER = '2026-10-17T20:00:00.000Z'
const NUDGED = '2026-10-17T15:04:00.000Z'
const five = (percentUsed: number, resetsAt = RESET) => ({ kind: 'five_hour', percentUsed, resetsAt })
const week = (percentUsed: number) => ({ kind: 'seven_day', percentUsed, resetsAt: '2026-10-20T09:00:00.000Z' })
const used = (tally: ReturnType<typeof observe>) =>
  Object.fromEntries(Object.entries(tally.windows).map(([kind, w]) => [kind, Number(w.used.toFixed(1))]))

describe('observe', () => {
  test('the first reading is the baseline, later ones add up', () => {
    let tally = observe(undefined, 1, [five(20), week(40)])
    expect(used(tally)).toEqual({ five_hour: 0, seven_day: 0 })

    tally = observe(tally, 1, [five(23.5), week(40.4)])
    tally = observe(tally, 1, [five(25), week(41)])
    expect(used(tally)).toEqual({ five_hour: 5, seven_day: 1 })
  })

  test('a /clear starts over from the last reading, counting its first reply', () => {
    let tally = observe(undefined, 1, [five(20)])
    tally = observe(tally, 1, [five(30)])
    // The first measurement of the new conversation comes after its first reply
    tally = observe(tally, 2, [five(32)])
    expect(used(tally)).toEqual({ five_hour: 2 })
  })

  test('a window that rolls over counts the new window from 0', () => {
    let tally = observe(undefined, 1, [five(90)])
    tally = observe(tally, 1, [five(95)])
    tally = observe(tally, 1, [five(3, LATER)])
    expect(used(tally)).toEqual({ five_hour: 8 })
  })

  test('a dip with the same reset time adds nothing, and the climb back counts once', () => {
    let tally = observe(undefined, 1, [five(40)])
    tally = observe(tally, 1, [five(45)])
    // A reply that landed late reads lower; the window did not start over
    tally = observe(tally, 1, [five(44)])
    expect(used(tally)).toEqual({ five_hour: 5 })

    tally = observe(tally, 1, [five(46)])
    expect(used(tally)).toEqual({ five_hour: 6 })
  })

  test('a reset time that shifts by minutes is the same window', () => {
    let tally = observe(undefined, 1, [five(60)])
    tally = observe(tally, 1, [five(62, NUDGED)])
    tally = observe(tally, 1, [five(61, RESET)])
    expect(used(tally)).toEqual({ five_hour: 2 })
  })

  test('a window gone from a reading counts from 0 when it comes back with a new reset time', () => {
    let tally = observe(undefined, 1, [five(80), week(40)])
    tally = observe(tally, 1, [five(90), week(41)])
    // The expired window drops out of the readings until the next reply
    tally = observe(tally, 1, [week(41)])
    expect(used(tally)).toEqual({ five_hour: 10, seven_day: 1 })

    tally = observe(tally, 1, [five(2, LATER), week(42)])
    expect(used(tally)).toEqual({ five_hour: 12, seven_day: 2 })
  })

  test('without reset times a drop is still a roll-over', () => {
    let tally = observe(undefined, 1, [{ kind: 'spend_limit', percentUsed: 50 }])
    tally = observe(tally, 1, [{ kind: 'spend_limit', percentUsed: 4 }])
    expect(used(tally)).toEqual({ spend_limit: 4 })
  })

  test('no reading yet leaves nothing to tally', () => {
    expect(observe(undefined, 1, []).windows).toEqual({})
  })

  test("another session's spending is not counted as this one's, in every window", () => {
    let tally = observe(undefined, 1, [five(20), week(40)], { me: 'a', ledger: { a: 1, b: 1 } })
    // a spent 0.3 and b 0.5 meanwhile, and the account went up 8 and 4 points
    tally = observe(tally, 1, [five(28), week(44)], { me: 'a', ledger: { a: 1.3, b: 1.5 } })
    expect(used(tally)).toEqual({ five_hour: 3, seven_day: 1.5 })
  })

  test('a session that began since the last reading counts from 0', () => {
    let tally = observe(undefined, 1, [five(20)], { me: 'a', ledger: { a: 1 } })
    tally = observe(tally, 1, [five(24)], { me: 'a', ledger: { a: 2, b: 1 } })
    expect(used(tally)).toEqual({ five_hour: 2 })
  })

  test('points gained with nothing spent by any session are none of ours', () => {
    let tally = observe(undefined, 1, [five(20)], { me: 'a', ledger: { a: 1, b: 1 } })
    tally = observe(tally, 1, [five(25)], { me: 'a', ledger: { a: 1, b: 1 } })
    expect(used(tally)).toEqual({ five_hour: 0 })
  })

  test('a reading that moved nothing keeps the spending baseline', () => {
    let tally = observe(undefined, 1, [five(20)], { me: 'a', ledger: { a: 1, b: 1 } })
    // A press while b works: no new figures, b's spending so far must still count
    tally = observe(tally, 1, [five(20)], { me: 'a', ledger: { a: 1, b: 1.5 } })
    tally = observe(tally, 1, [five(24)], { me: 'a', ledger: { a: 1.5, b: 1.5 } })
    expect(used(tally)).toEqual({ five_hour: 2 })
  })
})

describe('share', () => {
  test('a total that went down started over and counts whole', () => {
    expect(share({ a: 1, b: 5 }, { me: 'a', ledger: { a: 2, b: 1 } })).toBe(0.5)
  })

  test('without a ledger every point is ours', () => {
    expect(share(undefined, undefined)).toBe(1)
    expect(share(undefined, { me: 'a', ledger: {} })).toBe(1)
  })
})

describe('logReading', () => {
  const reading = (at: number, percentUsed: number): Reading => ({ at, limits: [five(percentUsed)], used: {} })

  test('keeps the last readings, oldest dropped first', () => {
    let log: readonly Reading[] = []

    for (let at = 0; at < LOG + 5; at++) {
      log = logReading(log, reading(at, at))
    }

    expect(log).toHaveLength(LOG)
    expect(log[0]?.at).toBe(5)
    expect(log[LOG - 1]?.at).toBe(LOG + 4)
  })

  test('a reading the same as the last one is left out, handing the log back as it was', () => {
    const log = logReading([], reading(1, 20))

    expect(logReading(log, reading(2, 20))).toBe(log)
    expect(logReading(log, reading(3, 21))).toHaveLength(2)
  })
})
