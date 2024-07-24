/* eslint-disable no-unused-vars */
/* eslint-disable unused-imports/no-unused-vars */

// @ts-ignore
import LRU from 'lru'
import PQueue from 'p-queue'

import { MemoryStorage } from '../storage/memory.js'

import { Clock, type ClockInstance, tickClock } from './clock.js'
import * as ConflictResolution from './conflict-resolution.js'
import { Entry, type EntryInstance } from './entry.js'
import { Heads } from './heads.js'

import type { AccessControllerInstance } from '../access-controllers/index.js'
import type { IdentityInstance } from '../identities/index.js'
import type { StorageInstance } from '../storage'

export interface LogIteratorOptions {
  gt?: string
  gte?: string
  lt?: string
  lte?: string
  amount?: number
}
export interface LogAppendOptions {
  referencesCount: number
}
export interface LogOptions<T> {
  logId?: string
  logHeads?: EntryInstance<T>[]
  accessController?: AccessControllerInstance
  entries?: EntryInstance<T>[]

  entryStorage?: StorageInstance<Uint8Array>
  headsStorage?: StorageInstance<Uint8Array>
  indexStorage?: StorageInstance<boolean>

  sortFn?: (a: EntryInstance<T>, b: EntryInstance<T>) => number
}

export interface LogInstance<T> {
  id: string

  access?: AccessControllerInstance
  identity: IdentityInstance
  storage: StorageInstance<Uint8Array>

  clock: () => Promise<ClockInstance>
  heads: () => Promise<EntryInstance<T>[]>
  values: () => Promise<EntryInstance<T>[]>
  all: () => Promise<EntryInstance<T>[]>
  get: (hash: string) => Promise<EntryInstance<T> | null>
  has: (hash: string) => Promise<boolean>
  append: (payload: T, options?: LogAppendOptions) => Promise<EntryInstance<T>>
  join: (log: LogInstance<T>) => Promise<void>
  joinEntry: (entry: EntryInstance<T>) => Promise<boolean>
  traverse: (
    rootEntries?: EntryInstance<T>[] | null,
    shouldStopFn?: (
      entry: EntryInstance<T>,
      useRefs?: boolean,
    ) => Promise<boolean>,
    useRefs?: boolean,
  ) => AsyncGenerator<EntryInstance<T>>
  iterator: (options?: LogIteratorOptions) => AsyncIterable<EntryInstance<T>>
  clear: () => Promise<void>
  close: () => Promise<void>
}

const { LastWriteWins, NoZeroes } = ConflictResolution

function randomId() {
  return Date.now().toString()
}
function maxClockTimeReducer(res: number, acc: EntryInstance<any>) {
  return Math.max(res, acc.clock.time)
}

const DEFAULT_STORAGE = MemoryStorage

const DEFAULT_STOP_FN = <T>(_entry: EntryInstance<T>, _useRefs: boolean) =>
  Promise.resolve(false)

const DEFAULT_ACCESS_CONTROLLER =
  async (): Promise<AccessControllerInstance> => {
    // An AccessController may do any async initialization stuff here...
    return {
      type: 'allow-all',
      write: [],
      canAppend: async (_entry: EntryInstance<any>) => true,
    }
  }

export const Log = async <T>(
  identity: IdentityInstance,
  {
    logId,
    logHeads,
    accessController: access,
    entryStorage,
    headsStorage,
    indexStorage,
    sortFn,
  }: LogOptions<T> = {},
): Promise<LogInstance<T>> => {
  if (!identity) {
    throw new Error('Identity is required')
  }
  if (logHeads && !Array.isArray(logHeads)) {
    throw new Error("'logHeads' argument must be an array")
  }
  // Set Log's id
  const id = logId || randomId()
  // Access Controller
  const accessController_ = access || (await DEFAULT_ACCESS_CONTROLLER())
  // Oplog entry storage
  const storage = entryStorage || (await DEFAULT_STORAGE())
  // Entry index for keeping track which entries are already in the log
  const indexStorage_ = indexStorage || (await DEFAULT_STORAGE())
  // Heads storage
  const headsStorage_ = headsStorage || (await DEFAULT_STORAGE())
  // Add heads to the state storage, ie. init the log state
  const heads_ = await Heads({ storage: headsStorage_, heads: logHeads })
  // Conflict-resolution sorting function
  const sortFn_ = NoZeroes(sortFn! || LastWriteWins)
  // Internal queues for processing appends and joins in their call-order
  const appendQueue = new PQueue({ concurrency: 1 })
  const joinQueue = new PQueue({ concurrency: 1 })

  const heads = async () => {
    const res = await heads_.all()
    return res.sort(sortFn_).reverse()
  }

  const values = async () => {
    const values = []
    for await (const entry of traverse()) {
      values.unshift(entry)
    }
    return values
  }

  const get = async (hash: string): Promise<EntryInstance<T> | null> => {
    const bytes = await storage.get(hash)
    if (bytes) {
      const entry = await Entry.decode<T>(bytes)
      return entry
    }

    return null
  }

  const has = async (hash: string) => {
    const entry = await indexStorage_.get(hash)
    if (entry === undefined) {
      return false
    }

    return true
  }

  const append = async (
    data: T,
    options = { referencesCount: 0 },
  ): Promise<EntryInstance<T>> => {
    const task = async () => {
      // 1. Prepare entry
      // 2. Authorize entry
      // 3. Store entry
      // 4. return Entry
      // Get current heads of the log
      const headsEntries = await heads()
      // Create the next pointers from heads
      const next_ = headsEntries.map((entry) => entry)
      // Get references (pointers) to multiple entries in the past
      // (skips the heads which are covered by the next field)
      const refs_ = await getReferences(
        next_,
        options.referencesCount + headsEntries.length,
      )
      // Create the entry
      const entry = await Entry.create<T>(
        identity,
        id,
        data,
        tickClock(
          await (async () => {
            const _heads = await heads()
            const maxTime = Math.max(0, _heads.reduce(maxClockTimeReducer, 0))

            return Clock(identity.publicKey, maxTime)
          })(),
        ),
        next_.map((n) => n.id),
        refs_,
      )
      // Authorize the entry
      const canAppend = await accessController_.canAppend(entry)
      if (!canAppend) {
        throw new Error(
          `Could not append entry:\nKey "${identity.hash}" is not allowed to write to the log`,
        )
      }

      // The appended entry is now the latest head
      await heads_.set([entry])
      // Add entry to the entry storage
      await storage.put(entry.hash!, entry.bytes!)
      // Add entry to the entry index
      await indexStorage_.put(entry.hash!, true)
      // Return the appended entry
      return entry
    }

    return appendQueue.add(task) as Promise<EntryInstance<T>>
  }

  const join = async (log: LogInstance<T>) => {
    if (!log) {
      throw new Error('Log instance not defined')
    }
    if (!isLog(log)) {
      throw new Error('Given argument is not an instance of Log')
    }
    if (storage.merge) {
      await storage.merge(log.storage)
    }
    const heads = await log.heads()
    for (const entry of heads) {
      await joinEntry(entry)
    }
  }

  const joinEntry = async (entry: EntryInstance<T>) => {
    const task = async () => {
      /* 1. Check if the entry is already in the log and return early if it is */
      const isAlreadyInTheLog = await has(entry.hash!)
      if (isAlreadyInTheLog) {
        return false
      }

      const verifyEntry = async (entry: EntryInstance<T>) => {
        // Check that the Entry belongs to this Log
        if (entry.id !== id) {
          throw new Error(
            `Entry's id (${entry.id}) doesn't match the log's id (${id}).`,
          )
        }

        const canAppend = await accessController_.canAppend(entry)
        if (!canAppend) {
          throw new Error(
            `Could not append entry:\nKey "${entry.identity}" is not allowed to write to the log`,
          )
        }
        // Verify signature for the entry
        const isValid = await Entry.verify(identity, entry)
        if (!isValid) {
          throw new Error(
            `Could not validate signature for entry "${entry.hash}"`,
          )
        }
      }

      /* 2. Verify the entry */
      await verifyEntry(entry)

      /* 3. Find missing entries and connections (=path in the DAG) to the current heads */
      const headsHashes = (await heads()).map((e) => e.hash)
      const hashesToAdd = new Set([entry.hash])
      const hashesToGet = new Set([
        ...(entry.next ?? []),
        ...(entry.refs ?? []),
      ])
      const connectedHeads = new Set<string>()

      const traverseAndVerify = async () => {
        const getEntries = Array.from(hashesToGet.values()).filter(has).map(get)
        const entries = await Promise.all(getEntries)

        for (const e of entries!) {
          if (!e) {
            continue
          }

          hashesToGet.delete(e.hash!)
          await verifyEntry(e)
          hashesToAdd.add(e.hash)

          for (const hash of [...(e.next ?? []), ...(e.refs ?? [])]) {
            const isInTheLog = await has(hash)

            if (!isInTheLog && !hashesToAdd.has(hash)) {
              hashesToGet.add(hash)
            } else if (headsHashes.includes(hash)) {
              connectedHeads.add(hash)
            }
          }
        }

        if (hashesToGet.size > 0) {
          await traverseAndVerify()
        }
      }

      await traverseAndVerify()

      /* 4. Add missing entries to the index (=to the log) */
      for (const hash of hashesToAdd.values()) {
        await indexStorage_.put(hash!, true)
      }

      /* 5. Remove heads which new entries are connect to */
      for (const hash of connectedHeads.values()) {
        await heads_.remove(hash!)
      }

      /* 6. Add the new entry to heads (=union with current heads) */
      await heads_.add(entry)

      return true
    }

    return joinQueue.add(task) as Promise<boolean>
  }

  const clear = async () => {
    await indexStorage_.clear()
    await headsStorage_.clear()
    await storage.clear()
  }

  const close = async () => {
    await indexStorage_.close()
    await headsStorage_.close()
    await storage.close()
  }

  async function* traverse(
    rootEntries?: EntryInstance<T>[] | null,
    shouldStopFn: (
      entry: EntryInstance<T>,
      useRefs: boolean,
    ) => Promise<boolean> = DEFAULT_STOP_FN<T>,
    useRefs: boolean = true,
  ) {
    // By default, we don't stop traversal and traverse
    // until the end of the log
    // Start traversal from given entries or from current heads
    const rootEntries_ = rootEntries || (await heads())
    // Sort the given given root entries and use as the starting stack
    let stack = rootEntries_.sort(sortFn_)
    // Keep a record of all the hashes of entries we've traversed and yielded
    const traversed: Record<string, boolean> = {}
    // Keep a record of all the hashes we are fetching or have already fetched
    let toFetch: string[] = []
    const fetched: Record<string, boolean> = {}
    // A function to check if we've seen a hash
    const notIndexed = (hash: string) => !(traversed[hash!] || fetched[hash!])
    // Current entry during traversal
    let entry: EntryInstance<T>
    // Start traversal and process stack until it's empty (traversed the full log)
    while (stack.length > 0) {
      stack = stack.sort(sortFn_)
      // Get the next entry from the stack
      entry = stack.pop()!
      if (entry) {
        const { hash, next, refs } = entry
        // If we have an entry that we haven't traversed yet, process it
        if (!traversed[hash!]) {
          // Yield the current entry
          yield entry
          // If we should stop traversing, stop here
          const done = await shouldStopFn(entry, useRefs)
          if (done === true) {
            break
          }
          // Add to the hash indices
          traversed[hash!] = true
          fetched[hash!] = true
          // Add the next and refs hashes to the list of hashes to fetch next,
          // filter out traversed and fetched hashes
          toFetch = [...toFetch, ...next!, ...(useRefs ? refs! : [])].filter(
            notIndexed,
          )
          // Function to fetch an entry and making sure it's not a duplicate (check the hash indices)
          const fetchEntries = (hash: string) => {
            if (!traversed[hash!] && !fetched[hash!]) {
              fetched[hash!] = true
              return get(hash)
            }
          }
          // Fetch the next/reference entries
          const nexts = (await Promise.all(toFetch.map(fetchEntries))).filter(
            (e) => e !== null && e !== undefined,
          )

          // Add the next and refs fields from the fetched entries to the next round
          toFetch = nexts
            .reduce(
              (res, acc) =>
                Array.from(
                  new Set([
                    ...res,
                    ...acc.next!,
                    ...(useRefs ? acc.refs! : []),
                  ]),
                ),
              [] as string[],
            )
            .filter(notIndexed)
          // Add the fetched entries to the stack to be processed
          stack = [...nexts, ...stack]
        }
      }
    }
  }

  async function* iterator(
    options: LogIteratorOptions = { amount: -1 },
  ): AsyncGenerator<EntryInstance<T>> {
    // TODO: write comments on how the iterator algorithm works
    let lte_: (EntryInstance<T> | null)[] | null = null
    let lt_: (EntryInstance<T> | null)[] | null = null

    if (options.amount === 0) {
      return
    }

    if (typeof options.lte === 'string') {
      lte_ = [await get(options.lte!)]
    }

    if (typeof options.lt === 'string') {
      const entry = await get(options.lt)
      const nexts = await Promise.all((entry?.next ?? []).map((n) => get(n)))
      lt_ = nexts
    }

    if (lt_ !== null && !Array.isArray(lt_)) {
      throw new Error('lt must be a string or an array of Entries')
    }
    if (lte_ !== null && !Array.isArray(lte_)) {
      throw new Error('lte must be a string or an array of Entries')
    }

    const start: EntryInstance<T>[] = (lt_ || lte_ || (await heads())).filter(
      (i) => i !== null,
    )
    const end =
      options.gt || options.gte ? await get((options.gt || options.gte)!) : null

    const amountToIterate = end || options.amount === -1 ? -1 : options.amount

    let count = 0
    const shouldStopTraversal = async (entry: EntryInstance<T>) => {
      count++
      if (!entry) {
        return false
      }
      if (count >= amountToIterate! && amountToIterate !== -1) {
        return true
      }
      if (end && Entry.isEqual(entry, end)) {
        return true
      }
      return false
    }

    const useBuffer = end && options.amount !== -1 && !options.lt && !lte_
    const buffer = useBuffer ? new LRU(options.amount || 0 + 2) : null
    let index = 0

    const it = traverse(start, shouldStopTraversal)

    for await (const entry of it) {
      const skipFirst = options.lt && Entry.isEqual(entry, start[0])
      const skipLast = options.gt && Entry.isEqual(entry, end!)
      const skip = skipFirst || skipLast
      if (!skip) {
        if (useBuffer) {
          buffer.set(index++, entry.hash)
        } else {
          yield entry
        }
      }
    }

    if (useBuffer) {
      const endIndex = buffer.keys.length
      const startIndex =
        endIndex > options.amount! ? endIndex - options.amount! : 0
      const keys = buffer.keys.slice(startIndex, endIndex)
      for (const key of keys) {
        const hash = buffer.get(key)
        const entry = await get(hash)
        yield entry!
      }
    }
  }

  const getReferences = async (heads: EntryInstance<T>[], amount: number) => {
    let refs = []
    const shouldStopTraversal = async (
      _entry: EntryInstance<T>,
      _useRefs: boolean,
    ) => {
      return refs.length >= amount && amount !== -1
    }
    for await (const { hash } of traverse(heads, shouldStopTraversal, false)) {
      refs.push(hash!)
    }
    refs = refs.slice(heads.length + 1, amount)

    return refs
  }

  const clock = async () => {
    const heads_ = await heads()
    const maxTime = Math.max(0, heads_.reduce(maxClockTimeReducer, 0))

    return Clock(identity.publicKey, maxTime)
  }

  return {
    id,
    clock,
    heads,
    values,
    all: values, // Alias for values()
    get,
    has,
    append,
    join,
    joinEntry,
    traverse,
    iterator,
    clear,
    close,
    access,
    identity,
    storage,
  }
}

const isLog = <T = unknown>(obj: any): obj is LogInstance<T> => {
  return (
    obj &&
    obj.id !== undefined &&
    obj.clock !== undefined &&
    obj.heads !== undefined &&
    obj.values !== undefined &&
    obj.access !== undefined &&
    obj.identity !== undefined &&
    obj.storage !== undefined
  )
}
