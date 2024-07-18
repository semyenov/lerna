/**
 * @namespace Storage-Level
 * @memberof module:Storage
 * @description
 * LevelStorage stores data to a Level-compatible database.
 *
 * To learn more about Level, see {@link https://github.com/Level/level}.
 */
import { LRUStorageInstance } from 'apps/orbit/types/storage'
import {  IPFSBlockStorage, LRUStorage } from '../storage'
import { IPFSBlockStorageInstance } from '../storage/ipfs-block'
import { Level } from 'level'

const defaultPath = './level'
const defaultValueEncoding = 'view'

interface StorageInstance<T> {
  put: (hash: string, data: any) => Promise<void>
  get: (hash: string) => Promise<T>
  del: (hash: string) => Promise<void>
  close: () => Promise<void>
  clear: () => Promise<void>
  iterator: (options?: {amount: number; reverse: boolean}) => AsyncGenerator<[string, T], void, unknown>
  merge: (other: StorageInstance<T>) => Promise<void>
}

interface LevelStorageOptions {
  path?: string
  valueEncoding?: string
}
interface LevelStorageInstance<T> extends StorageInstance<T> {}

interface MemoryStorageInstance extends StorageInstance<Uint8Array> {}
declare function MemoryStorage(): Promise<MemoryStorageInstance>

interface StorageTypeMap<T> {
  composed: StorageInstance<T>
  ipfs: IPFSBlockStorageInstance
  lru: LRUStorageInstance
  level: LevelStorageInstance<T>
  memory: MemoryStorageInstance
}

type StorageType = keyof StorageTypeMap<unknown>

export type {
  IPFSBlockStorageInstance,
  LevelStorageOptions,
  LevelStorageInstance,
  LRUStorageInstance,
  MemoryStorageInstance,
  StorageInstance,
  StorageType,
  StorageTypeMap,
}
export {
  IPFSBlockStorage,
  LevelStorage,
  LRUStorage,
  MemoryStorage,
}

const LevelStorage = async <T = unknown>(
  { path, valueEncoding }: LevelStorageOptions,
): Promise<LevelStorageInstance<T>> => {
  path = path || defaultPath
  valueEncoding = valueEncoding || defaultValueEncoding

  const db = new Level<string, T>(path, { valueEncoding, createIfMissing : true })
  await db.open()


  const put = async (hash: string, value: T) => {
    await db.put(hash, value)
  }

  const del = async (hash: string) => {
    await db.del(hash)
  }


  const get = async (hash: string) => {
    return db.get(hash)
  }

  const iterator = async function* ({ amount, reverse }: { amount?: number; reverse?: boolean } = {}) {
    const iteratorOptions = { limit: amount || -1, reverse: reverse || false }
    for await (const [key, value] of db.iterator(iteratorOptions)) {
      yield [key, value] as [string, T]
    }
  }

  const merge = async (other: LevelStorageInstance<T>) => {}


  const clear = async () => {
    await db.clear()
  }


  const close = async () => {
    await db.close()
  }

  return {
    put,
    del,
    get,
    iterator,
    merge,
    clear,
    close,
  }
}

export default LevelStorage
