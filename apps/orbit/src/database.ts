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
  LRUStorage,
  LevelStorage,
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
  accessController?: AccessControllerInstance
  onUpdate?: (
    log: LogInstance<DatabaseOperation<T>>,
    entry: EntryInstance<T> | EntryInstance<DatabaseOperation<T>>,
  ) => Promise<void>
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
  type: string
  peers: PeerSet
  meta: any
  log: LogInstance<DatabaseOperation<T>>
  sync: SyncInstance<DatabaseOperation<T>, SyncEvents<DatabaseOperation<T>>>
  events: TypedEventEmitter<E>
  identity: IdentityInstance
  accessController: AccessControllerInstance
  addOperation: (op: DatabaseOperation<T>) => Promise<string>
  close: () => Promise<void>
  drop: () => Promise<void>
}

export class Database<
  T = any,
  E extends DatabaseEvents<T> = DatabaseEvents<T> & SyncEvents<T>,
> implements DatabaseInstance<T, E>
{
  public name?: string
  public address?: string
  public indexBy?: string
  public type: string = 'database'
  public peers: PeerSet
  public meta: any
  public log: LogInstance<DatabaseOperation<T>>
  public sync: SyncInstance<
    DatabaseOperation<T>,
    SyncEvents<DatabaseOperation<T>>
  >
  public events: TypedEventEmitter<E>
  public identity: IdentityInstance
  public accessController: AccessControllerInstance

  private queue: PQueue
  private onUpdate?: (
    log: LogInstance<DatabaseOperation<T>>,
    entry: EntryInstance<T> | EntryInstance<DatabaseOperation<T>>,
  ) => Promise<void>

  constructor(options: DatabaseOptions<T>) {
    this.meta = options.meta || {}
    this.name = options.name
    this.address = options.address
    this.identity = options.identity!
    this.accessController = options.accessController!
    this.onUpdate = options.onUpdate
    this.events = new TypedEventEmitter<DatabaseEvents<T>>()
    this.queue = new PQueue({ concurrency: 1 })

    const path = join(options.directory || DATABASE_PATH, `./${this.address}/`)

    const entryStorage =
      options.entryStorage ||
      new ComposedStorage({
        storage1: new LRUStorage({ size: DATABASE_CACHE_SIZE }),
        storage2: new IPFSBlockStorage({ ipfs: options.ipfs, pin: true }),
      })

    const headsStorage =
      options.headsStorage ||
      new ComposedStorage({
        storage1: new LRUStorage({ size: DATABASE_CACHE_SIZE }),
        storage2: new LevelStorage(join(path, '/log/_heads/')),
      })

    const indexStorage =
      options.indexStorage ||
      new ComposedStorage({
        storage1: new LRUStorage({ size: DATABASE_CACHE_SIZE }),
        storage2: new LevelStorage(join(path, '/log/_index/')),
      })

    this.log = new Log<DatabaseOperation<T>>(this.identity, {
      logId: this.address,
      accessController: this.accessController,
      entryStorage,
      headsStorage,
      indexStorage,
    })

    this.sync = new Sync({
      ipfs: options.ipfs,
      log: this.log,
      start: options.syncAutomatically ?? true,
      onSynced: this.applyOperation.bind(this) as unknown as (
        peerId: PeerId,
        heads: EntryInstance<DatabaseOperation<T>>[],
      ) => Promise<void>,
    })

    this.peers = this.sync.peers
  }

  static async create<T>(options: DatabaseOptions<T>): Promise<Database<T>> {
    const database = new Database<T>(options)
    return database
  }

  private async applyOperation(bytes: Uint8Array): Promise<void> {
    const task = async () => {
      const entry = await Entry.decode<DatabaseOperation<T>>(bytes)
      if (entry) {
        const updated = await this.log.joinEntry(entry)
        if (updated) {
          if (this.onUpdate) {
            await this.onUpdate(this.log, entry)
          }
          this.events.dispatchEvent(
            new CustomEvent('update', { detail: { entry } }),
          )
        }
      }
    }

    await this.queue.add(task)
  }

  public async addOperation(op: DatabaseOperation<T>): Promise<string> {
    const task = async () => {
      const entry = await this.log.append(op, {
        referencesCount: DATABASE_REFERENCES_COUNT,
      })
      await this.sync.add(entry)
      if (this.onUpdate) {
        await this.onUpdate(this.log, entry)
      }
      this.events.dispatchEvent(
        new CustomEvent('update', { detail: { entry } }),
      )
      return entry.hash!
    }

    const hash = await this.queue.add(task)
    await this.queue.onIdle()
    return hash as string
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
