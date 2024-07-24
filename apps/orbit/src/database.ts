/**
 * @module Database
 * @description
 * Database is the base class for OrbitDB data stores and handles all lower
 * level add operations and database sync-ing using IPFS.
 */
import { EventEmitter } from 'events'

import PQueue from 'p-queue'

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

export interface DatabaseOptions<T> {
  meta: any
  name?: string
  address?: string
  directory: string
  referencesCount?: number
  syncAutomatically?: boolean

  ipfs: HeliaInstance
  accessController?: AccessControllerInstance
  identity?: IdentityInstance
  identities?: IdentitiesInstance
  headsStorage?: StorageInstance<any>
  entryStorage?: StorageInstance<any>
  indexStorage?: StorageInstance<any>
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
  peers: Set<PeerId>
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

const DEFAULT_REFEREMCES_COUNT = 16
const DEFAULT_CACHE_SIZE = 1000

export const Database = async <T = any>({
  ipfs,
  identity,
  address,
  name,
  accessController,
  directory = './orbitdb',
  meta = {},
  headsStorage,
  entryStorage,
  indexStorage,
  referencesCount = DEFAULT_REFEREMCES_COUNT,
  syncAutomatically,
  onUpdate,
}: DatabaseOptions<T>): Promise<DatabaseInstance<T>> => {
  const path = join(directory, `./${address}/`)
  const entryStorage_ =
    entryStorage ||
    (await ComposedStorage({
      storage1: await LRUStorage({ size: DEFAULT_CACHE_SIZE }),
      storage2: await IPFSBlockStorage({ ipfs, pin: true }),
    }))

  const headsStorage_ =
    headsStorage ||
    (await ComposedStorage({
      storage1: await LRUStorage({ size: DEFAULT_CACHE_SIZE }),
      storage2: await LevelStorage({ path: join(path, '/log/_heads/') }),
    }))

  const indexStorage_ =
    indexStorage ||
    (await ComposedStorage({
      storage1: await LRUStorage({ size: DEFAULT_CACHE_SIZE }),
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

  const addOperation = async (op: DatabaseOperation<T>): Promise<string> => {
    const task = async () => {
      const entry = await log.append(op, { referencesCount })
      await sync.add(entry)
      if (onUpdate) {
        await onUpdate(log, entry)
      }
      events.emit('update', entry)
      return entry.hash
    }

    const hash = await queue.add(task)
    await queue.onIdle()

    return hash as string
  }

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

  /**
   * Closes the database, stopping sync and closing the oplog.
   * @memberof module:Databases~Database
   * @instance
   * @async
   */
  const close = async () => {
    await sync.stop()
    await queue.onIdle()
    await log.close()
    if (accessController && accessController.close) {
      await accessController.close()
    }
    events.emit('close')
  }

  /**
   * Drops the database, clearing the oplog.
   * @memberof module:Databases~Database
   * @instance
   * @async
   */
  const drop = async () => {
    await queue.onIdle()
    await log.clear()
    if (accessController && accessController.drop) {
      await accessController.drop()
    }
    events.emit('drop')
  }

  const sync = await Sync({
    ipfs,
    log,
    events,
    onSynced: applyOperation as unknown as (
      peerId: PeerId,
      heads: EntryInstance<DatabaseOperation<T>>[],
    ) => Promise<void>,
    start: syncAutomatically,
  })

  return {
    type: 'database',

    /**
     * The address of the database.
     * @†ype string
     * @memberof module:Databases~Database
     * @instance
     */
    address,
    /**
     * The name of the database.
     * @†ype string
     * @memberof module:Databases~Database
     * @instance
     */
    name,
    identity: identity!,
    meta,
    close,
    drop,
    addOperation,
    /**
     * The underlying [operations log]{@link module:Log~Log} of the database.
     * @†ype {module:Log~Log}
     * @memberof module:Databases~Database
     * @instance
     */
    log,
    /**
     * A [sync]{@link module:Sync~Sync} instance of the database.
     * @†ype {module:Sync~Sync}
     * @memberof module:Databases~Database
     * @instance
     */
    sync,
    /**
     * Set of currently connected peers for this Database instance.
     * @†ype Set
     * @memberof module:Databases~Database
     * @instance
     */
    peers: sync.peers,
    /**
     * Event emitter that emits Database changes. See Events section for details.
     * @†ype EventEmitter
     * @memberof module:Databases~Database
     * @instance
     */
    events,
    /**
     * The [access controller]{@link module:AccessControllers} instance of the database.
     * @memberof module:Databases~Database
     * @instance
     */
    accessController: accessController!,
  }
}
