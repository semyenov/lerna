/* eslint-disable no-unused-vars */
import {
  Documents,
  type DocumentsInstance,
  type DocumentsOptions,
} from './documents.js'
import { Events, type EventsInstance, type EventsOptions } from './events.js'
import {
  KeyValueIndexed,
  type KeyValueIndexedInstance,
  type KeyValueIndexedOptions,
} from './keyvalue-indexed.js'
import { KeyValue, type KeyValueInstance } from './keyvalue.js'

import type { DatabaseInstance, DatabaseOptions } from '../database.js'

export interface DatabaseOperation<T> {
  op: 'PUT' | 'DEL' | 'ADD'
  key: string | null
  value: T | null
}

export type DatabaseType<K extends string = string> = {
  type: K
  (): <T = unknown>(options: DatabaseOptions<T>) => Promise<DatabaseInstance<T>>
}
export type DatabaseTypeMap<T = unknown> = {
  events: EventsInstance<T>
  documents: DocumentsInstance<T>
  keyvalue: KeyValueInstance<T>
  'keyvalue-indexed': KeyValueIndexedInstance<T>
}

const databaseTypes: Record<string, ReturnType<DatabaseType>> = {}

export const useDatabaseType = (database: DatabaseType) => {
  if (!database.type) {
    throw new Error("Database type does not contain required field 'type'.")
  }

  databaseTypes[database.type] = database()
}

export const getDatabaseType = (type: string) => {
  if (!type) {
    throw new Error('Type not specified')
  }

  if (!databaseTypes[type!]) {
    throw new Error(`Unsupported database type: '${type}'`)
  }

  return databaseTypes[type!]
}

useDatabaseType(Events)
useDatabaseType(Documents)
useDatabaseType(KeyValue)

export type {
  DocumentsInstance,
  DocumentsOptions,
  EventsOptions,
  EventsInstance,
  KeyValueInstance,
  KeyValueIndexedInstance,
  KeyValueIndexedOptions,
}
export { Documents, Events, KeyValue, KeyValueIndexed }
