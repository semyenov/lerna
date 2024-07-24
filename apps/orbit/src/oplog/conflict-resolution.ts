import { compareClocks } from './clock.js'

import type { EntryInstance } from './entry.js'

export function LastWriteWins<T>(a: EntryInstance<T>, b: EntryInstance<T>) {
  // Ultimate conflict resolution (take the first/left arg)
  const First = () => 1
  // Sort two entries by their clock id, if the same always take the first
  const sortById = <T>(a: EntryInstance<T>, b: EntryInstance<T>) =>
    SortByClockId(a, b, First)
  // Sort two entries by their clock time, if concurrent,
  // determine sorting using provided conflict resolution function
  const sortByEntryClocks = (a: EntryInstance, b: EntryInstance) =>
    SortByClocks(a, b, sortById)
  // Sort entries by clock time as the primary sort criteria
  return sortByEntryClocks(a, b)
}

export function SortByClocks(
  a: EntryInstance,
  b: EntryInstance,
  resolveConflict: (a: EntryInstance, b: EntryInstance) => number,
) {
  // Compare the clocks
  const diff = compareClocks(a.clock, b.clock)
  // If the clocks are concurrent, use the provided
  // conflict resolution function to determine which comes first
  return diff === 0 ? resolveConflict(a, b) : diff
}

export function SortByClockId<T>(
  a: EntryInstance<T>,
  b: EntryInstance<T>,
  resolveConflict: (a: EntryInstance<T>, b: EntryInstance<T>) => number,
) {
  // Sort by ID if clocks are concurrent,
  // take the entry with a "greater" clock id
  return a.clock.id === b.clock.id
    ? resolveConflict(a, b)
    : a.clock.id < b.clock.id
      ? -1
      : 1
}

export function NoZeroes<T>(
  func: (a: EntryInstance<T>, b: EntryInstance<T>) => number,
) {
  const msg = `Your log's tiebreaker function, ${func.name}, has returned zero and therefore cannot be used to resolve conflicts.`

  const comparator = (a: EntryInstance<T>, b: EntryInstance<T>) => {
    // Validate by calling the function
    const result = func(a, b)
    if (result === 0) {
      throw new Error(msg)
    }
    return result
  }

  return comparator
}
