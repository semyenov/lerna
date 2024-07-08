import type { AccessControllerInstance } from './access-controller'
import type { DatabaseInstance } from './database'
import type { IdentitiesInstance, IdentityInstance } from './identities'
import type { OrbitDBInstance } from './index'
import type { StorageInstance } from './storage'
import type { IPFS } from './vendor'

interface DatabaseOptions {
  ipfs?: IPFS
  identity?: IdentityInstance
  address?: string
  orbitdb?: OrbitDBInstance
  identities?: IdentitiesInstance
  accessController?: AccessControllerInstance
  directory?: string
}

interface DocumentsDoc<T = unknown> {
  hash: string
  key: string
  value: T
}

interface DocumentsIteratorOptions {
  amount?: number
}

interface DocumentsOptions<T> {
  indexBy?: keyof T
}

interface DocumentsInstance<T = unknown> extends DatabaseInstance<T> {
  type: 'documents'

  all(): Promise<DocumentsDoc<T>[]>

  del(key: string): Promise<string>

  get(key: string): Promise<DocumentsDoc<T> | null>

  iterator(
    options?: DocumentsIteratorOptions,
  ): AsyncGenerator<DocumentsDoc<T>, string>

  put(doc: T): Promise<string>

  query(findFn: (doc: T) => boolean): Promise<T[]>
}

interface EventsDoc<T = unknown> {
  key: string
  value: T
}

interface EventsIteratorOptions {
  gt?: string
  gte?: string
  lt?: string
  lte?: string
  amount?: number
}

interface EventsInstance<T = unknown> extends DatabaseInstance<T> {
  type: 'events'

  add(value: T): Promise<string>

  all(): Promise<Omit<EventsDoc<T>, 'key'>[]>

  get(hash: string): Promise<T | null>

  iterator(options?: EventsIteratorOptions): AsyncGenerator<EventsDoc<T>>
}

interface KeyValueDoc<T = unknown> {
  hash: string
  key: string
  value: T
}

interface KeyValueIteratorOptions {
  amount?: number
}

interface KeyValueInstance<T = unknown> extends DatabaseInstance<T> {
  type: 'keyvalue'

  all(): Promise<KeyValueDoc<T>[]>

  set(key: string, value: T): Promise<string>

  del(key: string): Promise<void>

  get(key: string): Promise<T | null>

  iterator(
    filters?: KeyValueIteratorOptions,
  ): AsyncGenerator<KeyValueDoc<T>, string>

  put(key: string, value: T): Promise<string>
}

interface KeyValueIndexedOptions {
  storage?: StorageInstance
}

interface KeyValueIndexedInstance<T = unknown> extends KeyValueInstance<T> {
}

interface DatabasesTypeMap<T = unknown> {
  documents: DocumentsInstance<T>
  events: EventsInstance<T>
  keyvalue: KeyValueInstance<T> | KeyValueIndexedInstance<T>
}
// eslint-disable-next-line ts/consistent-type-definitions
type Databases<
  T extends keyof DatabasesTypeMap,
  U extends DatabaseInstance,
> = {
  type: T

  (options: DatabaseOptions): Promise<U>
}

declare const Documents: <T = unknown>(
  documentsOptions?: DocumentsOptions<T>,
) => Databases<'documents', DocumentsInstance>

declare const Events: () => Databases<'events', EventsInstance>
declare const KeyValue: () => Databases<'keyvalue', KeyValueInstance>

declare const KeyValueIndexed: (
  options?: KeyValueIndexedOptions,
) => Databases<'keyvalue', KeyValueIndexedInstance>

export type {
  Databases,
  DatabasesTypeMap,
  DocumentsDoc,
  DocumentsInstance,
  DocumentsIteratorOptions,
  DocumentsOptions,
  EventsDoc,
  EventsInstance,
  EventsIteratorOptions,
  KeyValueDoc,
  KeyValueIndexedInstance,
  KeyValueInstance,
  KeyValueIteratorOptions,
}
export { Documents, Events, KeyValue, KeyValueIndexed }

export function useDatabaseType<T = unknown>(
  database: Databases<keyof DatabasesTypeMap, DatabaseInstance>
): void
