import {
  type AccessControllerInstance,
  type AccessControllerOptions,
  IPFSAccessController,
  getAccessController,
} from './access-controllers/index.js'
import { OrbitDBAddress, isValidAddress } from './address.js'
import { getDatabaseType } from './databases/index.js'
import {
  Identities,
  type IdentitiesInstance,
  type IdentityInstance,
} from './identities/index.js'
import { KeyStore, type KeyStoreInstance } from './key-store.js'
import { ManifestStore } from './manifest-store.js'
import { join } from './utils'
import { createId } from './utils/index.js'

import type { DatabaseInstance } from './database.js'
import type { StorageInstance } from './storage/index.js'
import type { HeliaInstance, PeerId } from './vendor.js'

export interface OrbitDBOpenOptions<D extends keyof DatabasesTypeMap> {
  type?: D
  meta?: any
  sync?: boolean
  referencesCount?: number

  Database?: Databases<keyof DatabasesTypeMap, DatabaseInstance>
  AccessController?: (
    options: AccessControllerOptions,
  ) => AccessControllerInstance

  headsStorage?: StorageInstance
  entryStorage?: StorageInstance
  indexStorage?: StorageInstance
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

  open: <T, D extends keyof DatabasesTypeMap>(
    address: string,
    options?: OrbitDBOpenOptions<D>,
  ) => Promise<DatabasesTypeMap<T>[D]>
  stop: () => Promise<void>
}

const DEFAULT_DATABASE_TYPE = 'events'

const DEFAULT_ACCESS_CONTROLLER = IPFSAccessController

const OrbitDB = async ({
  ipfs,
  id,
  identity,
  identities,
  directory,
}: OrbitDBOptions): Promise<OrbitDBInstance> => {
  /**
   * @namespace module:OrbitDB~OrbitDB
   * @description The instance returned by {@link module:OrbitDB}.
   */

  if (ipfs === null) {
    throw new Error('IPFS instance is a required argument.')
  }

  const generatedId = id || (await createId())
  const peerId: PeerId = ipfs.libp2p.peerId
  const defaultDirectory = directory || './orbitdb'

  let keystore: KeyStoreInstance
  let identities_: IdentitiesInstance

  if (identities) {
    identities_ = identities
    keystore = identities_.keystore
  } else {
    keystore = await KeyStore({ path: join(defaultDirectory, './keystore') })
    identities_ = await Identities({ ipfs, keystore })
  }

  let finalIdentity: IdentityInstance
  if (identity) {
    if (typeof identity.provider === 'function') {
      finalIdentity = await identities_.createIdentity({ ...identity })
    } else {
      finalIdentity = identity
    }
  } else {
    finalIdentity = await identities_.createIdentity({ id: generatedId })
  }

  const manifestStore = await ManifestStore({ ipfs })

  const databases: Record<string, DatabaseInstance> = {}

  const open = async <T, D extends keyof DatabasesTypeMap>(
    address: string,
    {
      type,
      meta,
      sync,
      Database,
      AccessController,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
    }: OrbitDBOpenOptions<D> = {},
  ): Promise<DatabasesTypeMap<T>[D]> => {
    let name: string, manifest: any, accessController: AccessControllerInstance

    if (databases[address!]) {
      return databases[address!] as DatabasesTypeMap<T>[D]
    }

    if (isValidAddress(address)) {
      const addr = OrbitDBAddress(address)
      manifest = await manifestStore.get(addr.hash)
      const acType = manifest.accessController.split('/', 2).pop()
      const AccessControllerType = getAccessController(acType)
      accessController = await AccessControllerType({
        orbitdb: { open, identity: finalIdentity, ipfs },
        identities: identities_,
        address: manifest.accessController,
      })
      name = manifest.name
      type = type || manifest.type
      meta = meta || manifest.meta
    } else {
      type = type || DEFAULT_DATABASE_TYPE
      const AccessControllerType = AccessController || DEFAULT_ACCESS_CONTROLLER
      accessController = await AccessControllerType({
        orbitdb: { open, identity: finalIdentity, ipfs },
        identities: identities_,
        name: address,
      })
      const m = await manifestStore.create({
        name: address,
        type,
        accessController: accessController.address,
        meta,
      })
      manifest = m.manifest
      address = m.hash
      name = manifest.name
      meta = meta || manifest.meta
      if (databases[address!]) {
        return databases[address!] as DatabasesTypeMap<T>[D]
      }
    }

    const DatabaseType = Database || getDatabaseType(type)

    if (!DatabaseType) {
      throw new Error(`Unsupported database type: '${type}'`)
    }

    const db = await DatabaseType({
      ipfs,
      identity: finalIdentity,
      address,
      name,
      access: accessController,
      directory: defaultDirectory,
      meta,
      syncAutomatically: sync,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
    })

    db.events.on('close', onDatabaseClosed(address))

    databases[address] = db

    return db as DatabasesTypeMap<T>[D]
  }

  const onDatabaseClosed = (address: string) => (): void => {
    delete databases[address]
  }

  /**
   * Stops OrbitDB, closing the underlying keystore and manifest store.
   * @function stop
   * @memberof module:OrbitDB~OrbitDB
   * @instance
   * @async
   */
  const stop = async (): Promise<void> => {
    for (const db of Object.values(databases)) {
      await db.close()
    }
    if (keystore) {
      await keystore.close()
    }
    if (manifestStore) {
      await manifestStore.close()
    }
    Object.keys(databases).forEach((key) => delete databases[key])
  }

  return {
    id: generatedId,
    open,
    stop,
    ipfs,
    directory: defaultDirectory,
    keystore,
    identity: finalIdentity,
    peerId,
  }
}

export { OrbitDB, OrbitDBAddress }
