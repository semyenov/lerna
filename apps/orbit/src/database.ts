/* eslint-disable no-unused-vars */
import { EventEmitter } from 'node:events'

import PQueue from 'p-queue'

import {
  DATABASE_CACHE_SIZE,
  DATABASE_PATH as DATABASE_PATH,
  DATABASE_REFERENCES_COUNT,
} from './constants.js'
import { Entry, Log } from './oplog/index.js'
import {
  ComposedStorage,
  IPFSBlockStorage,
  LRUStorage,
  LevelStorage,
  type StorageInstance,
} from './storage/index.js'
import { Sync, type SyncInstance } from './sync.js'
import { join } from './utils'

import type { AccessControllerInstance } from './access-controllers'
import type { DatabaseOperation } from './databases/index.js'
import type {
  IdentitiesInstance,
  IdentityInstance,
} from './identities/index.js'
import type { EntryInstance } from './oplog/entry.js'
import type { LogInstance } from './oplog/log.js'
import type { HeliaInstance, PeerId } from './vendor.js'
import type { PeerSet } from '@libp2p/peer-collections'

export interface DatabaseOptions<T> {
  meta: any
  name?: string
  address?: string
  directory: string
  referencesCount?: number
  syncAutomatically?: boolean

  ipfs: HeliaInstance
  identity?: IdentityInstance
  identities?: IdentitiesInstance
  headsStorage?: StorageInstance<Uint8Array>
  entryStorage?: StorageInstance<Uint8Array>
  indexStorage?: StorageInstance<boolean>
  accessController?: AccessControllerInstance

  onUpdate?: (
    log: LogInstance<DatabaseOperation<T>>,
    entry: EntryInstance<T> | EntryInstance<DatabaseOperation<T>>,
  ) => Promise<void>
}

export interface DatabaseEvents<T = unknown> extends EventEmitter {
  on: ((
    event: 'join',
    listener: (peerId: string, heads: EntryInstance<T>[]) => void,
  ) => this) &
    ((event: 'leave', listener: (peerId: string) => void) => this) &
    ((event: 'close', listener: () => void) => this) &
    ((event: 'drop', listener: () => void) => this) &
    ((event: 'error', listener: (error: Error) => void) => this) &
    ((event: 'update', listener: (entry: EntryInstance<T>) => void) => this)
}

export interface DatabaseInstance<T = unknown> {
  name?: string
  address?: string
  indexBy?: string
  type: string
  peers: PeerSet
  meta: any

  log: LogInstance<DatabaseOperation<T>>
  sync: SyncInstance<DatabaseOperation<T>>

  events: DatabaseEvents<T>
  identity: IdentityInstance
  accessController: AccessControllerInstance

  addOperation: (op: DatabaseOperation<T>) => Promise<string>
  close: () => Promise<void>
  drop: () => Promise<void>
}

export const Database = async <T = any>({
  ipfs,

  meta = {},
  name,
  address,

  directory = DATABASE_PATH,
  referencesCount = DATABASE_REFERENCES_COUNT,

  identity,
  headsStorage,
  entryStorage,
  indexStorage,
  accessController,
  onUpdate,
  syncAutomatically = true,
}: DatabaseOptions<T>): Promise<DatabaseInstance<T>> => {
  const path = join(directory, `./${address}/`)

  const entryStorage_ =
    entryStorage ||
    (await ComposedStorage({
      storage1: await LRUStorage({ size: DATABASE_CACHE_SIZE }),
      storage2: await IPFSBlockStorage({ ipfs, pin: true }),
    }))

  const headsStorage_ =
    headsStorage ||
    (await ComposedStorage({
      storage1: await LRUStorage({ size: DATABASE_CACHE_SIZE }),
      storage2: await LevelStorage({ path: join(path, '/log/_heads/') }),
    }))

  const indexStorage_ =
    indexStorage ||
    (await ComposedStorage({
      storage1: await LRUStorage({ size: DATABASE_CACHE_SIZE }),
      storage2: await LevelStorage({ path: join(path, '/log/_index/') }),
    }))

  const log = await Log<DatabaseOperation<T>>(identity!, {
    logId: address,
    accessController,
    entryStorage: entryStorage_,
    headsStorage: headsStorage_,
    indexStorage: indexStorage_,
  })

  const events = new EventEmitter()
  const queue = new PQueue({ concurrency: 1 })

  const applyOperation = async (bytes: Uint8Array) => {
    const task = async () => {
      const entry = await Entry.decode<DatabaseOperation<T>>(bytes)
      if (entry) {
        const updated = await log.joinEntry(entry)
        if (updated) {
          if (onUpdate) {
            await onUpdate(log, entry)
          }
          events.emit('update', entry)
        }
      }
    }

    await queue.add(task)
  }

  const sync = await Sync({
    ipfs,
    log,
    events,
    start: syncAutomatically,

    // TODO: check this
    onSynced: applyOperation as unknown as (
      peerId: PeerId,
      heads: EntryInstance<DatabaseOperation<T>>[],
    ) => Promise<void>,
  })

  const instance: DatabaseInstance<T> = {
    type: 'database',

    meta,
    name,
    address,

    log,
    sync,
    events,
    peers: sync.peers,
    identity: identity!,
    accessController: accessController!,

    drop: async () => {
      await queue.onIdle()
      await log.clear()
      if (accessController && accessController.drop) {
        await accessController.drop()
      }
      events.emit('drop')
    },
    close: async () => {
      await sync.stop()
      await queue.onIdle()
      await log.close()
      if (accessController && accessController.close) {
        await accessController.close()
      }
      events.emit('close')
    },
    addOperation: async (op: DatabaseOperation<T>): Promise<string> => {
      const task = async () => {
        const entry = await log.append(op, { referencesCount })
        await sync.add(entry)
        if (onUpdate) {
          await onUpdate(log, entry)
        }
        events.emit('update', entry)

        return entry.hash!
      }

      const hash = await queue.add(task)
      await queue.onIdle()

      return hash as string
    },
  }

  return instance
}
