import {
  type AccessControllerInstance,
  type AccessControllerType,
  type AccessControllerTypeMap,
  getAccessController,
} from './access-controllers/index.js'
import { IPFSAccessController } from './access-controllers/ipfs.js'
import { OrbitDBAddress } from './address.js'
import { DATABASE_DEFAULT_TYPE } from './constants.js'
import {
  type DatabaseType,
  type DatabaseTypeMap,
  getDatabaseType,
} from './databases/index.js'
import {
  Identities,
  type IdentitiesInstance,
  type IdentityInstance,
} from './identities/index.js'
import { KeyStore, type KeyStoreInstance } from './key-store.js'
import { type Manifest, ManifestStore } from './manifest-store.js'
import { join } from './utils'
import { createId } from './utils/index.js'

import type { DatabaseInstance } from './database.js'
import type { StorageInstance } from './storage/index.js'
import type { HeliaInstance, PeerId } from './vendor.js'

export interface OrbitDBOpenOptions<T, D extends keyof DatabaseTypeMap<T>> {
  type?: D
  meta?: any
  sync?: boolean
  referencesCount?: number
  Database?: DatabaseType<D>
  AccessController?: ReturnType<
    AccessControllerType<string, AccessControllerInstance>
  >
  headsStorage?: StorageInstance<Uint8Array>
  entryStorage?: StorageInstance<Uint8Array>
  indexStorage?: StorageInstance<boolean>
}

export interface OrbitDBOptions {
  id?: string
  ipfs: HeliaInstance
  identity?: IdentityInstance
  identities?: IdentitiesInstance
  directory?: string
}

export interface OrbitDBInstance {
  id: string
  ipfs: HeliaInstance
  directory: string
  keystore: KeyStoreInstance
  identity: IdentityInstance
  peerId: PeerId

  open: <T, D extends keyof DatabaseTypeMap>(
    address: string,
    options: OrbitDBOpenOptions<T, D>,
  ) => Promise<DatabaseType>
  stop: () => Promise<void>
}

const DEFAULT_ACCESS_CONTROLLER = IPFSAccessController({})

export class OrbitDB implements OrbitDBInstance {
  id: string
  ipfs: HeliaInstance
  directory: string
  keystore: KeyStoreInstance
  identity: IdentityInstance
  peerId: PeerId
  private identities: IdentitiesInstance
  private manifestStore: ManifestStore
  private databases: Record<string, DatabaseInstance<any>> = {}

  private constructor(
    id: string,
    ipfs: HeliaInstance,
    directory: string,
    keystore: KeyStoreInstance,
    identity: IdentityInstance,
    identities: IdentitiesInstance,
    manifestStore: ManifestStore,
  ) {
    this.id = id
    this.ipfs = ipfs
    this.directory = directory
    this.keystore = keystore
    this.identity = identity
    this.peerId = ipfs.libp2p.peerId
    this.identities = identities
    this.manifestStore = manifestStore
  }

  static async create(options: OrbitDBOptions): Promise<OrbitDB> {
    if (options.ipfs === null) {
      throw new Error('IPFS instance is a required argument.')
    }

    const generatedId = options.id || (await createId())
    const defaultDirectory = options.directory || './orbitdb'

    let keystore: KeyStoreInstance
    let identities: IdentitiesInstance

    if (options.identities) {
      identities = options.identities
      keystore = identities.keystore
    } else {
      keystore = await KeyStore.create({
        path: join(defaultDirectory, './keystore'),
      })
      identities = Identities.create({ ipfs: options.ipfs, keystore })({
        ipfs: options.ipfs,
        keystore,
      })
    }

    let finalIdentity: IdentityInstance
    if (options.identity) {
      if (typeof options.identity.provider === 'function') {
        finalIdentity = await identities.createIdentity({
          id: options.identity.id,
          provider: options.identity.provider,
        })
      } else {
        finalIdentity = options.identity
      }
    } else {
      finalIdentity = await identities.createIdentity({ id: generatedId })
    }

    const manifestStore = await ManifestStore.create({ ipfs: options.ipfs })

    return new OrbitDB(
      generatedId,
      options.ipfs,
      defaultDirectory,
      keystore,
      finalIdentity,
      identities,
      manifestStore,
    )
  }

  async open<T, D extends keyof DatabaseTypeMap<T>>(
    address: string,
    options: OrbitDBOpenOptions<T, D>,
  ): Promise<DatabaseTypeMap<T>[D]> {
    let name: string,
      manifest: Manifest | null,
      accessController: AccessControllerInstance,
      address_: string = address,
      type_: D = options.type || (DATABASE_DEFAULT_TYPE as D),
      meta_: any = options.meta

    if (this.databases[address_!]) {
      return this.databases[address_!] as DatabaseTypeMap<T>[D]
    }

    if (OrbitDBAddress.isValidAddress(address_)) {
      const addr = OrbitDBAddress.create(address_)
      manifest = await this.manifestStore.get(addr.hash)
      if (!manifest) {
        throw new Error(`Manifest not found for address: ${address_}`)
      }

      const acType = manifest.accessController
        .split('/', 2)
        .pop()! as keyof AccessControllerTypeMap

      const AccessControllerType = getAccessController(acType)({})
      if (!AccessControllerType) {
        throw new Error(`Unsupported access controller type: '${acType}'`)
      }

      accessController = await AccessControllerType({
        orbitdb: this,
        identities: this.identities,
        address: manifest.accessController,
      })

      name = manifest.name
      type_ = type_ || (manifest.type as D)
      meta_ = meta_ || manifest.meta
    } else {
      type_ = type_ || (DATABASE_DEFAULT_TYPE as D)
      const AccessControllerType =
        options.AccessController || DEFAULT_ACCESS_CONTROLLER

      accessController = await AccessControllerType({
        orbitdb: this,
        identities: this.identities,
        name: address_,
      })

      const m = await this.manifestStore.create({
        name: address_,
        type: type_,
        accessController: accessController.address!,
        meta: meta_,
      })

      manifest = m.manifest
      address_ = m.hash

      name = manifest?.name || 'unknown'

      meta_ = meta_ || manifest?.meta
      if (this.databases[address_!]) {
        return this.databases[address_!] as DatabaseTypeMap<T>[D]
      }
    }

    const DatabaseType = options.Database || getDatabaseType(type_)

    if (!DatabaseType) {
      throw new Error(`Unsupported database type: '${type_}'`)
    }

    const db = await DatabaseType.create({
      ipfs: this.ipfs,
      identity: this.identity,
      address: address_,
      name,
      meta: meta_,
      directory: this.directory,
      accessController,
      syncAutomatically: options.sync,
      headsStorage: options.headsStorage,
      entryStorage: options.entryStorage,
      indexStorage: options.indexStorage,
      referencesCount: options.referencesCount,
    })

    db.events.on('close', this.onDatabaseClosed(address_))

    this.databases[address_!] = db

    return db as DatabaseTypeMap<T>[D]
  }

  private onDatabaseClosed = (address: string) => (): void => {
    delete this.databases[address!]
  }

  async stop(): Promise<void> {
    for (const db of Object.values(this.databases)) {
      await db.close()
    }
    if (this.keystore) {
      await this.keystore.close()
    }
    if (this.manifestStore) {
      await this.manifestStore.close()
    }

    Object.keys(this.databases).forEach((key) => {
      delete this.databases[key!]
    })
  }
}

export { OrbitDBAddress }
