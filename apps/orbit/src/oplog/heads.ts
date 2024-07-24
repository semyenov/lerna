import { MemoryStorage, type StorageInstance } from '../storage'

import { Entry, type EntryInstance } from './entry'

export const Heads = async <T>({
  storage,
  heads,
}: {
  storage?: StorageInstance<Uint8Array>
  heads?: EntryInstance<T>[]
}) => {
  const storage_: StorageInstance<Uint8Array> =
    storage || (await MemoryStorage<Uint8Array>())

  const put = async (heads: EntryInstance<T>[]) => {
    const heads_ = findHeads<T>(heads)
    for (const head of heads_) {
      await storage_.put(head.hash!, head.bytes!)
    }
  }

  const set = async (heads: EntryInstance<T>[]) => {
    await storage_.clear()
    await put(heads)
  }

  const add = async (head: EntryInstance<T>) => {
    const currentHeads = await all()
    if (currentHeads.some((e) => Entry.isEqual(e, head))) {
      return
    }
    const newHeads = findHeads<T>([...currentHeads, head])
    await set(newHeads)

    return newHeads
  }

  const remove = async (hash: string) => {
    const currentHeads = await all()
    const newHeads = currentHeads.filter((e) => e.hash !== hash)
    await set(newHeads)
  }

  const iterator = async function* () {
    const it = storage_.iterator()
    for await (const [, bytes] of it) {
      const head = await Entry.decode<T>(bytes)
      yield head
    }
  }

  const all = async () => {
    const values: EntryInstance<T>[] = []
    for await (const head of iterator()) {
      values.push(head)
    }
    return values
  }

  const clear = async () => {
    await storage_.clear()
  }

  const close = async () => {
    await storage_.close()
  }

  // Initialize the heads if given as parameter
  await put(heads || [])

  return {
    put,
    set,
    add,
    remove,
    iterator,
    all,
    clear,
    close,
  }
}

const findHeads = <T>(entries: EntryInstance<T>[]) => {
  const entries_ = new Set(entries)
  const items: Record<string, string> = {}
  for (const entry of entries_) {
    for (const next of entry.next!) {
      items[next!] = entry.hash!
    }
  }

  const res: EntryInstance<T>[] = []
  for (const entry of entries) {
    if (!items[entry.hash!]) {
      res.push(entry)
    }
  }

  return res
}
