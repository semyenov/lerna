/* eslint-disable no-unused-vars */
import { EVENTS_DATABASE_TYPE } from '../constants.js'
import {
  Database,
  type DatabaseInstance,
  type DatabaseOptions,
} from '../database.js'

import type { DatabaseType } from './index.js'

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

export const Events: DatabaseType<'events'> = () => {
  return async <T = unknown>(
    options: EventsOptions<T>,
  ): Promise<EventsInstance<T>> => {
    const database = await Database(options)
    const { addOperation, log } = database

    const add = async (value: T): Promise<string> => {
      return addOperation({ op: 'ADD', key: null, value })
    }

    const get = async (hash: string) => {
      const entry = await log.get(hash)
      return entry!.payload.value
    }

    const iterator = async function* ({
      gt,
      gte,
      lt,
      lte,
      amount,
    }: EventsIteratorOptions = {}): AsyncIterable<EventsDoc<T>> {
      const it = log.iterator({ gt, gte, lt, lte, amount })
      for await (const event of it) {
        const hash = event.hash!
        const value = event.payload.value
        yield { hash, value }
      }
    }

    const all = async () => {
      const values = []
      for await (const entry of iterator()) {
        values.unshift(entry)
      }
      return values
    }

    const instance: EventsInstance<T> = {
      ...database,

      type: EVENTS_DATABASE_TYPE,
      add,
      get,
      iterator,
      all,
    }

    return instance
  }
}

Events.type = EVENTS_DATABASE_TYPE
