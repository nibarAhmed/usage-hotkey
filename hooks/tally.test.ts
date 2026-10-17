import { describe, expect, test } from 'claude-code/testing'

import { observe } from './tally'

const RESET = '2026-10-17T15:00:00.000Z'
const LATER = '2026-10-17T20:00:00.000Z'
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

  test('a drop with the same reset time is also a roll-over', () => {
    let tally = observe(undefined, 1, [five(50)])
    tally = observe(tally, 1, [five(4)])
    expect(used(tally)).toEqual({ five_hour: 4 })
  })

  test('no reading yet leaves nothing to tally', () => {
    expect(observe(undefined, 1, []).windows).toEqual({})
  })
})
