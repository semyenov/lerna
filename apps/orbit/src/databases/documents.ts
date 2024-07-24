import {
  Database,
  type DatabaseInstance,
  type DatabaseOptions,
} from '../database.js'

import type { DatabaseType } from './index.js'

const type = 'documents'

export interface DocumentsDoc<T = unknown> {
  key?: string
  hash?: string
  value: T | null
}

export interface DocumentsIteratorOptions {
  amount?: number
}

export interface DocumentsOptions {
  indexBy?: string
}

export interface DocumentsInstance<T = unknown> extends DatabaseInstance<T> {
  type: 'documents'

  all: () => Promise<DocumentsDoc<T>[]>
  del: (key: string) => Promise<string>
  get: (key: string) => Promise<DocumentsDoc<T> | null>
  iterator: (
    options?: DocumentsIteratorOptions,
  ) => AsyncIterable<DocumentsDoc<T>>
  put: (doc: T) => Promise<string>
  query: (findFn: (doc: T) => boolean) => Promise<T[]>
}

/**
 * Defines a Documents database.
 * @param {DocumentsOptions<T>} options Various options for configuring the Document store.
 * @param {string} [options.indexBy=_id] An index.
 * @return {DatabaseType<'documents'>} A Documents function.
 * @memberof module:Databases
 */
export const Documents: DatabaseType<'documents'> = () => {
  return async <T = unknown>({
    ipfs,
    identity,
    address,
    name,
    directory,
    meta,
    headsStorage,
    entryStorage,
    indexStorage,
    accessController,
    referencesCount,
    syncAutomatically,
    onUpdate,
    indexBy = '_id',
  }: DatabaseOptions<T> & DocumentsOptions): Promise<DocumentsInstance<T>> => {
    const database = await Database<T>({
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
      onUpdate,
    })

    const { addOperation, log } = database

    /**
     * Stores a document to the store.
     * @function
     * @param {T} doc An object representing a key/value list of fields.
     * @return {Promise<string>} The hash of the new oplog entry.
     * @memberof module:Databases.Databases-Documents
     * @instance
     */
    const put = async (doc: T): Promise<string> => {
      const key = doc[indexBy as keyof T]

      if (!key) {
        throw new Error(
          `The provided document doesn't contain field '${String(indexBy)}'`,
        )
      }

      return addOperation({ op: 'PUT', key: String(key), value: doc })
    }

    /**
     * Deletes a document from the store.
     * @function
     * @param {string} key The key of the doc to delete.
     * @return {Promise<string>} The hash of the new oplog entry.
     * @memberof module:Databases.Databases-Documents
     * @instance
     */
    const del = async (key: string): Promise<string> => {
      if (!(await get(key))) {
        throw new Error(`No document with key '${key}' in the database`)
      }

      return addOperation({ op: 'DEL', key, value: null })
    }

    /**
     * Gets a document from the store by key.
     * @function
     * @param {string} key The key of the doc to get.
     * @return {Promise<DocumentsDoc<T> | null>} The doc corresponding to key or null.
     * @memberof module:Databases.Databases-Documents
     * @instance
     */
    const get = async (key: string): Promise<DocumentsDoc<T> | null> => {
      for await (const doc of iterator()) {
        if (key === doc.key) {
          return doc
        }
      }
      return null
    }

    /**
     * Queries the document store for documents matching mapper filters.
     * @function
     * @param {function(T): boolean} findFn A function for querying for specific
     * results.
     *
     * The findFn function's signature takes the form `function(doc)` where doc
     * is a document's value property. The function should return true if the
     * document should be included in the results, false otherwise.
     * @return {Promise<T[]>} Found documents.
     * @memberof module:Databases.Databases-Documents
     * @instance
     */
    const query = async (findFn: (doc: T) => boolean): Promise<T[]> => {
      const results: T[] = []

      for await (const doc of iterator()) {
        if (findFn(doc.value!)) {
          results.push(doc.value!)
        }
      }

      return results
    }

    /**
     * Iterates over documents.
     * @function
     * @param {DocumentsIteratorOptions} [options={}] Various options to apply to the iterator.
     * @param {number} [options.amount] The number of results to fetch.
     * @yields {DocumentsDoc<T>} The next document as hash/key/value.
     * @memberof module:Databases.Databases-Documents
     * @instance
     */
    const iterator = async function* ({
      amount,
    }: DocumentsIteratorOptions = {}): AsyncGenerator<
      DocumentsDoc<T>,
      void,
      unknown
    > {
      const keys: Record<string, boolean> = {}
      let count = 0
      for await (const entry of log.iterator()) {
        const { op, key, value } = entry.payload
        if (op === 'PUT' && !keys[key!]) {
          keys[key!] = true
          count++
          const hash = entry.hash!
          yield {
            hash,
            key: key!,
            value: value || null,
          } satisfies DocumentsDoc<T>
        } else if (op === 'DEL' && !keys[key!]) {
          keys[key!] = true
        }
        if (amount !== undefined && count >= amount) {
          break
        }
      }
    }

    /**
     * Returns all documents.
     * @function
     * @return {Promise<DocumentsDoc<T>[]>} An array of documents as hash/key
     * value entries.
     * @memberof module:Databases.Databases-Documents
     * @instance
     */
    const all = async (): Promise<DocumentsDoc<T>[]> => {
      const values: DocumentsDoc<T>[] = []
      for await (const entry of iterator()) {
        values.unshift(entry)
      }
      return values
    }

    return {
      ...database,
      type,
      put,
      del,
      get,
      iterator,
      query,
      indexBy,
      all,
    }
  }
}

Documents.type = type
