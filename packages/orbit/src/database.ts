/* eslint-disable no-console */
import { TypedEventEmitter } from '@libp2p/interface'
import PQueue from 'p-queue'

import {
  DATABASE_CACHE_SIZE,
  DATABASE_PATH,
  DATABASE_REFERENCES_COUNT,
} from './constants.js'
import { Entry, Log } from './oplog/index.js'
import {
  ComposedStorage,
  IPFSBlockStorage,
  LevelStorage,
  LRUStorage,
  type StorageInstance,
} from './storage/index.js'
import { Sync, type SyncEvents, type SyncInstance } from './sync.js'
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
  accessController: AccessControllerInstance
  onUpdate?: (
    log: LogInstance<DatabaseOperation<T>>,
    entry: EntryInstance<T> | EntryInstance<DatabaseOperation<T>>,
  ) => Promise<void>
  // addOperation: (op: DatabaseOperation<T>) => Promise<string>
}

export interface DatabaseEvents<T = unknown> {
  join: CustomEvent<{ peerId: PeerId; heads: EntryInstance<T>[] }>
  leave: CustomEvent<{ peerId: PeerId }>
  close: CustomEvent
  drop: CustomEvent
  error: ErrorEvent
  update: CustomEvent<{ entry: EntryInstance<T> }>
}

export interface DatabaseInstance<
  T,
  E extends DatabaseEvents<T> = DatabaseEvents<T>,
> {
  name?: string
  address?: string
  indexBy?: string
  meta: any
  log: LogInstance<DatabaseOperation<T>>
  sync: SyncInstance<DatabaseOperation<T>, SyncEvents<DatabaseOperation<T>>>
  peers: PeerSet
  events: TypedEventEmitter<E>
  identity: IdentityInstance
  accessController: AccessControllerInstance
  addOperation: (op: DatabaseOperation<T>) => Promise<string>
  close: () => Promise<void>
  drop: () => Promise<void>
}

export class Database<
  T = unknown,
  E extends DatabaseEvents<T> & SyncEvents<T> = DatabaseEvents<T> &
    SyncEvents<DatabaseOperation<T>>,
> implements DatabaseInstance<T, E>
{
  private queue: PQueue

  public name?: string
  public address?: string
  public indexBy?: string
  public meta: any
  public log: LogInstance<DatabaseOperation<T>>
  public sync: SyncInstance<
    DatabaseOperation<T>,
    SyncEvents<DatabaseOperation<T>>
  >
  public events: TypedEventEmitter<E>
  public identity: IdentityInstance
  public accessController: AccessControllerInstance
  public addOperation: (op: DatabaseOperation<T>) => Promise<string>

  public onUpdate?: (
    log: LogInstance<DatabaseOperation<T>>,
    entry: EntryInstance<T> | EntryInstance<DatabaseOperation<T>>,
  ) => Promise<void>

  public get peers() {
    return this.sync.peers
  }

  private constructor(
    identity: IdentityInstance,
    log: Log<DatabaseOperation<T>>,
    events: TypedEventEmitter<E>,
    queue: PQueue,
    sync: SyncInstance<DatabaseOperation<T>, SyncEvents<DatabaseOperation<T>>>,
    addOperation: (op: DatabaseOperation<T>) => Promise<string>,
    accessController: AccessControllerInstance,

    name?: string,
    address?: string,
    meta?: any,
    onUpdate?: (
      log: LogInstance<DatabaseOperation<T>>,
      entry: EntryInstance<T> | EntryInstance<DatabaseOperation<T>>,
    ) => Promise<void>,
  ) {
    this.meta = meta
    this.name = name
    this.address = address
    this.identity = identity
    this.accessController = accessController
    this.onUpdate = onUpdate

    this.log = log
    this.events = events
    this.queue = queue
    this.sync = sync
    this.addOperation = addOperation
  }

  static async create<T>(options: DatabaseOptions<T>) {
    const ipfs = options.ipfs
    const name = options.name
    const address = options.address
    const path = join(options.directory || DATABASE_PATH, `./${address}/`)
    const identity = options.identity!
    const accessController = options.accessController
    const onUpdate = options.onUpdate
    const start = options.syncAutomatically ?? true
    const referencesCount =
      options.referencesCount && Number(options.referencesCount) > -1
        ? options.referencesCount
        : DATABASE_REFERENCES_COUNT
    const meta = options.meta || {}

    const entryStorage =
      options.entryStorage ||
      ComposedStorage.create({
        storage1: await LRUStorage.create({ size: DATABASE_CACHE_SIZE }),
        storage2: await IPFSBlockStorage.create({
          ipfs,
          pin: true,
        }),
      })

    const headsStorage =
      options.headsStorage ||
      ComposedStorage.create({
        storage1: await LRUStorage.create({ size: DATABASE_CACHE_SIZE }),
        storage2: await LevelStorage.create({
          path: join(path, '/log/_heads/'),
        }),
      })

    const indexStorage =
      options.indexStorage ||
      ComposedStorage.create({
        storage1: await LRUStorage.create({ size: DATABASE_CACHE_SIZE }),
        storage2: await LevelStorage.create({
          path: join(path, '/log/_index/'),
        }),
      })

    const log = new Log<DatabaseOperation<T>>(identity, {
      logId: address,
      accessController,
      entryStorage,
      headsStorage,
      indexStorage,
    })

    const queue = new PQueue({ concurrency: 1 })
    const events = new TypedEventEmitter<
      DatabaseEvents<T> & SyncEvents<DatabaseOperation<T>>
    >()

    const addOperation = async (op: DatabaseOperation<T>): Promise<string> => {
      console.log('addOperation', op)
      const task = async () => {
        const entry = await log.append(op, {
          referencesCount,
        })
        await sync.add(entry)
        if (onUpdate) {
          await onUpdate(log, entry)
        }
        events.dispatchEvent(new CustomEvent('update', { detail: { entry } }))
        return entry.hash!
      }

      const hash = await queue.add(task)
      await queue.onIdle()

      return hash as string
    }

    const applyOperation = async (bytes: Uint8Array): Promise<void> => {
      const task = async () => {
        const entry = await Entry.decode<DatabaseOperation<T>>(bytes)
        if (entry) {
          const updated = await log.joinEntry(entry)
          if (updated) {
            if (onUpdate) {
              await onUpdate(log, entry)
            }
            events.dispatchEvent(
              new CustomEvent('update', { detail: { entry } }),
            )
          }
        }
      }

      console.log('apply', bytes)
      await queue.add(task)
    }

    const sync = new Sync<DatabaseOperation<T>>({
      log,
      ipfs,
      start,
      events,
      onSynced: applyOperation,
    })

    return new Database(
      identity,
      log,
      events,
      queue,
      sync,
      addOperation,
      log.accessController,
      name,
      address,
      meta,
      onUpdate,
    )
  }

  public async drop(): Promise<void> {
    await this.queue.onIdle()
    await this.log.clear()
    if (this.accessController && this.accessController.drop) {
      await this.accessController.drop()
    }
    this.events.dispatchEvent(new CustomEvent('drop'))
  }

  public async close(): Promise<void> {
    await this.sync.stop()
    await this.queue.onIdle()
    await this.log.close()
    if (this.accessController && this.accessController.close) {
      await this.accessController.close()
    }
    this.events.dispatchEvent(new CustomEvent('close'))
  }
}
