import { LevelStorage } from '../storage/level.js'
import { join } from '../utils'

import { KeyValue, type KeyValueInstance } from './keyvalue.js'

import type { DatabaseOperation, DatabaseType } from './index.js'
import type { DatabaseOptions } from '../database.js'
import type { EntryInstance } from '../oplog/entry.js'
import type { LogInstance } from '../oplog/log.js'
import type { StorageInstance } from '../storage/index.js'

const valueEncoding = 'json'

export const Index =
  <T>({ directory }: { directory?: string } = {}) =>
  async () => {
    const index = await LevelStorage<EntryInstance<DatabaseOperation<T>>>({
      path: directory,
      valueEncoding,
    })
    const indexedEntries = await LevelStorage<boolean>({
      path: join(directory || './orbitdb', `/_indexedEntries/`),
      valueEncoding,
    })

    const update = async (
      log: LogInstance<DatabaseOperation<T>>,
      entry: EntryInstance<T>,
    ) => {
      const keys = new Set()
      const toBeIndexed = new Set()
      const latest = entry.hash

      // Function to check if a hash is in the entry index
      const isIndexed = async (hash: string) =>
        (await indexedEntries.get(hash)) === true
      const isNotIndexed = async (hash: string) => !(await isIndexed(hash))

      // Function to decide when the log traversal should be stopped
      const shoudStopTraverse = async (
        entry: EntryInstance<DatabaseOperation<T>>,
      ) => {
        // Go through the nexts of an entry and if any is not yet
        // indexed, add it to the list of entries-to-be-indexed
        for await (const hash of entry.next!) {
          if (await isNotIndexed(hash)) {
            toBeIndexed.add(hash)
          }
        }
        // If the latest entry and all its nexts are indexed and to-be-indexed list is empty,
        // we don't have anything more to process, so return true to stop the traversal
        return (await isIndexed(latest!)) && toBeIndexed.size === 0
      }

      // Traverse the log and stop when everything has been processed
      for await (const entry of log.traverse(null, shoudStopTraverse)) {
        const { hash, payload } = entry
        // If an entry is not yet indexed, process it
        if (await isNotIndexed(hash!)) {
          const { op, key } = payload
          if (op === 'PUT' && !keys.has(key)) {
            keys.add(key)
            await index.put(key!, entry)
            await indexedEntries.put(hash!, true)
          } else if (op === 'DEL' && !keys.has(key)) {
            keys.add(key)
            await index.del(key!)
            await indexedEntries.put(hash!, true)
          }
          // Remove the entry (hash) from the list of to-be-indexed entries
          toBeIndexed.delete(hash)
        }
      }
    }

    /**
     * Closes the index and its storages.
     */
    const close = async () => {
      await index.close()
      await indexedEntries.close()
    }

    /**
     * Drops all records from the index and its storages.
     */
    const drop = async () => {
      await index.clear()
      await indexedEntries.clear()
    }

    return {
      get: index.get,
      iterator: index.iterator,
      update,
      close,
      drop,
    }
  }

export interface KeyValueIndexedOptions<T> {
  storage?: StorageInstance<T>
}

export interface KeyValueIndexedInstance<T = unknown>
  extends KeyValueInstance<T> {}

export const KeyValueIndexed: DatabaseType<'keyvalue-indexed'> = () => {
  return async <T = unknown>(
    options: DatabaseOptions<T> & KeyValueIndexedOptions<T>,
  ): Promise<KeyValueIndexedInstance<T>> => {
    const {
      ipfs,
      identity,
      address,
      name,
      accessController,
      directory,
      meta,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
      syncAutomatically,
    } = options

    // Set up the directory for an index
    const indexDirectory = join(
      directory || './orbitdb',
      `./${address}/_index/`,
    )

    // Set up the index
    const index = await Index<T>({
      directory: indexDirectory,
    })()

    // Set up the underlying KeyValue database
    const keyValueStore = await KeyValue()({
      ipfs,
      identity,
      address,
      name,
      accessController,
      directory,
      meta,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
      syncAutomatically,
      onUpdate: index.update,
    })

    /**
     * Gets a value from the store by key.
     * @function
     * @param {string} key The key of the value to get.
     * @return {*} The value corresponding to key or null.
     * @memberof module:Databases.Databases-KeyValueIndexed
     * @instance
     */
    const get = async (key: string): Promise<T | null> => {
      const entry = await index.get(key)
      if (entry) {
        return entry.payload.value
      }

      return null
    }

    /**
     * Iterates over keyvalue pairs.
     * @function
     * @param {Object} [filters={}] Various filters to apply to the iterator.
     * @param {string} [filters.amount=-1] The number of results to fetch.
     * @yields [string, string, string] The next key/value as key/value/hash.
     * @memberof module:Databases.Databases-KeyValueIndexed
     * @instance
     */
    const iterator = async function* ({
      amount = -1,
    }: { amount?: number } = {}): AsyncIterable<{
      hash: string
      key: string
      value: T | null
    }> {
      const it = index.iterator({ amount, reverse: true })
      for await (const record of it) {
        // 'index' is a LevelStorage that returns a [key, value] pair
        const entry = record[1]
        const { key, value } = entry.payload
        const hash = entry.hash!
        yield {
          hash,
          key: key!,
          value: value || null,
        }
      }
    }

    /**
     * Closes the index and underlying storage.
     */
    const close = async (): Promise<void> => {
      await keyValueStore.close()
      await index.close()
    }

    /**
     * Drops all records from the index and underlying storage.
     */
    const drop = async (): Promise<void> => {
      await keyValueStore.drop()
      await index.drop()
    }

    return {
      ...keyValueStore,
      get,
      iterator,
      close,
      drop,
    }
  }
}

KeyValueIndexed.type = 'keyvalue-indexed'
