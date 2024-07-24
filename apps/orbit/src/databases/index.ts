import {
  Documents,
  DocumentsDatabase,
  type DocumentsInstance,
  type DocumentsOptions,
} from './documents.js'
import {
  Events,
  EventsDatabase,
  type EventsInstance,
  type EventsOptions,
} from './events.js'
import {
  KeyValueIndexed,
  KeyValueIndexedDatabase,
  type KeyValueIndexedInstance,
  type KeyValueIndexedOptions,
} from './keyvalue-indexed.js'
import {
  KeyValue,
  KeyValueDatabase,
  type KeyValueInstance,
} from './keyvalue.js'

import type { DatabaseInstance } from '../database.js'

export interface DatabaseOperation<T> {
  op: 'PUT' | 'DEL' | 'ADD'
  key: string | null
  value: T | null
}

export interface DatabaseTypeMap {
  events: EventsDatabase
  documents: DocumentsDatabase
  keyvalue: KeyValueDatabase
  'keyvalue-indexed': KeyValueIndexedDatabase
}

export type DatabaseType<T = unknown> = {
  type: string
  create: (...args: any[]) => Promise<DatabaseInstance<T>>
}

const databaseTypes: Record<string, DatabaseType> = {}

export const useDatabaseType = (database: DatabaseType) => {
  if (!database.type) {
    throw new Error("Database type does not contain required field 'type'.")
  }

  databaseTypes[database.type] = database
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

useDatabaseType(EventsDatabase)
useDatabaseType(DocumentsDatabase)
useDatabaseType(KeyValueDatabase)
useDatabaseType(KeyValueIndexedDatabase)

export { Documents, Events, KeyValue, KeyValueIndexed }
export type {
  DocumentsInstance,
  DocumentsOptions,
  EventsInstance,
  EventsOptions,
  KeyValueIndexedInstance,
  KeyValueIndexedOptions,
  KeyValueInstance,
}
