import { Level, type IteratorOptions as LevelIteratorOptions } from 'level'

import { STORAGE_LEVEL_PATH, STORAGE_LEVEL_VALUE_ENCODING } from '../constants'

import type { StorageInstance } from '../storage'

export interface LevelStorageOptions {
  path?: string
  valueEncoding?: string
}
export interface LevelStorageInstance<T> extends StorageInstance<T> {}

export const LevelStorage = async <T = unknown>({
  path = STORAGE_LEVEL_PATH,
  valueEncoding = STORAGE_LEVEL_VALUE_ENCODING,
}: LevelStorageOptions): Promise<LevelStorageInstance<T>> => {
  const level = new Level<string, T>(path, {
    valueEncoding,
    createIfMissing: true,
  })
  await level.open()

  const instance: LevelStorageInstance<T> = {
    put: async (hash: string, value: T) => {
      await level.put(hash, value)
    },
    del: async (hash: string) => {
      await level.del(hash)
    },
    get: async (hash: string) => {
      try {
        const value = await level.get(hash)
        if (value) {
          return value
        }
      } catch {
        return null
      }

      return null
    },
    async *iterator(options: LevelIteratorOptions<string, T> = {}) {
      for await (const [key, value] of level.iterator(options)) {
        yield [key, value] as [string, T]
      }
    },
    merge: async () => {},
    clear: async () => {
      await level.clear()
    },
    close: async () => {
      await level.close()
    },
  }

  return instance
}
