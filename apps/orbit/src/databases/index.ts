import { Documents } from './documents.js'
import { Events } from './events.js'
import { KeyValueIndexed } from './keyvalue-indexed.js'
import { KeyValue } from './keyvalue.js'

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

const databaseTypes: Record<string, DatabaseType> = {}

const useDatabaseType = (database: DatabaseType) => {
  if (!database.type) {
    throw new Error("Database type does not contain required field 'type'.")
  }

  databaseTypes[database.type] = database
}

const getDatabaseType = (type: string) => {
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

export {
  useDatabaseType,
  getDatabaseType,
  Documents,
  Events,
  KeyValue,
  KeyValueIndexed,
}
