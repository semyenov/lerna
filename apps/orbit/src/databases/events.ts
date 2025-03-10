import { DATABASE_EVENTS_TYPE } from '../constants.js'
import {
  Database,
  type DatabaseInstance,
  type DatabaseOptions,
} from '../database.js'

import type { DatabaseOperation, DatabaseType } from '.'
import type { LogInstance } from '../oplog/log.js'
import type { SyncEvents, SyncInstance } from '../sync.js'
import type { PeerSet } from '@libp2p/peer-collections'

export interface EventsDoc<T = unknown> {
  key?: string
  hash?: string
  value: T | null
}

export interface EventsIteratorOptions {
  gt?: string
  gte?: string
  lt?: string
  lte?: string
  amount?: number
}

export interface EventsOptions<T = unknown> extends DatabaseOptions<T> {}
export interface EventsInstance<T = unknown> extends DatabaseInstance<T> {
  type: 'events'

  add: (value: T) => Promise<string>
  all: () => Promise<Omit<EventsDoc<T>, 'key'>[]>
  get: (hash: string) => Promise<T | null>
  iterator: (options: EventsIteratorOptions) => AsyncIterable<EventsDoc<T>>
}

export class EventsDatabase<T = unknown> implements EventsInstance<T> {
  private database: DatabaseInstance<T>

  get type(): 'events' {
    return DATABASE_EVENTS_TYPE
  }
  static get type(): 'events' {
    return DATABASE_EVENTS_TYPE
  }

  private constructor(database: DatabaseInstance<T>) {
    this.database = database
  }

  static async create<T>(
    options: EventsOptions<T>,
  ): Promise<EventsDatabase<T>> {
    const database = await Database.create<T>(options)
    return new EventsDatabase<T>(database)
  }

  get name(): string | undefined {
    return this.database.name
  }

  get address(): string | undefined {
    return this.database.address
  }

  get meta(): any {
    return this.database.meta
  }

  get events(): DatabaseInstance<T>['events'] {
    return this.database.events
  }

  get identity(): DatabaseInstance<T>['identity'] {
    return this.database.identity
  }

  get accessController(): DatabaseInstance<T>['accessController'] {
    return this.database.accessController
  }

  get peers(): PeerSet {
    return this.database.peers
  }

  get log(): LogInstance<DatabaseOperation<T>> {
    return this.database.log
  }

  get sync(): SyncInstance<
    DatabaseOperation<T>,
    SyncEvents<DatabaseOperation<T>>
  > {
    return this.database.sync
  }

  async addOperation(operation: DatabaseOperation<T>): Promise<string> {
    return this.database.addOperation(operation)
  }

  async add(value: T): Promise<string> {
    return this.database.addOperation({ op: 'ADD', key: null, value })
  }

  async get(hash: string): Promise<T | null> {
    const entry = await this.database.log.get(hash)
    return entry ? entry.payload.value : null
  }

  async *iterator({
    gt,
    gte,
    lt,
    lte,
    amount,
  }: EventsIteratorOptions = {}): AsyncIterable<EventsDoc<T>> {
    const it = this.database.log.iterator({ gt, gte, lt, lte, amount })
    for await (const event of it) {
      const hash = event.hash!
      const value = event.payload.value
      yield { hash, value }
    }
  }

  async all(): Promise<Omit<EventsDoc<T>, 'key'>[]> {
    const values = []
    for await (const entry of this.iterator()) {
      values.unshift(entry)
    }
    return values
  }

  close(): Promise<void> {
    return this.database.close()
  }

  drop(): Promise<void> {
    return this.database.drop()
  }
}

export const Events: DatabaseType<any, 'events'> = {
  create: EventsDatabase.create,
  type: DATABASE_EVENTS_TYPE,
}
