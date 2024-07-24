/**
 * @namespace Storage-LRU
 * @memberof module:Storage
 * @description
 * LRUStorage stores data in a Least Recently Used (LRU) cache.
 */

// @ts-ignore
import LRU from 'lru'

import { STORAGE_LRU_SIZE } from '../constants'

import type { StorageInstance } from './types'

export interface LRUStorageOptions {
  size?: number
}
export interface LRUStorageInstance<T> extends StorageInstance<T> {}

export const LRUStorage = async <T>({
  size = STORAGE_LRU_SIZE,
}: LRUStorageOptions): Promise<LRUStorageInstance<T>> => {
  let lru = new LRU<T>(size)

  const storage: LRUStorageInstance<T> = {
    put: async (hash: string, data: T) => {
      lru.set(hash, data)
    },
    del: async (hash) => {
      lru.remove(hash)
    },
    get: async (hash) => {
      return lru.get(hash) || null
    },
    async *iterator() {
      for await (const key of lru.keys) {
        const value = lru.get(key)
        yield [key, value] as [string, T]
      }
    },
    merge: async (other) => {
      if (other) {
        for await (const [key, value] of other.iterator()) {
          lru.set(key, value)
        }
      }
    },
    clear: async () => {
      lru = new LRU(size || STORAGE_LRU_SIZE)
    },
    close: async () => {},
  }

  return storage
}
