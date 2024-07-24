import {
  type AccessControllerInstance,
  type AccessControllerType,
  IPFSAccessController,
  getAccessController,
} from './access-controllers/index.js'
import { OrbitDBAddress, isValidAddress } from './address.js'
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
import { ManifestStore } from './manifest-store.js'
import { join } from './utils'
import { createId } from './utils/index.js'

import type { StorageInstance } from './storage/index.js'
import type { HeliaInstance, PeerId } from './vendor.js'

export interface OrbitDBOpenOptions<T, D extends keyof DatabaseTypeMap<T>> {
  type?: D
  meta?: any
  sync?: boolean
  referencesCount?: number

  Database?: ReturnType<DatabaseType>
  AccessController?: ReturnType<AccessControllerType<string, any>>

  headsStorage?: StorageInstance<T>
  entryStorage?: StorageInstance<T>
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

  open: <T, D extends keyof DatabaseTypeMap<T>>(
    address: string,
    options?: OrbitDBOpenOptions<T, D>,
  ) => Promise<DatabaseTypeMap<T>[D]>
  stop: () => Promise<void>
}

const DEFAULT_DATABASE_TYPE = 'events'

const DEFAULT_ACCESS_CONTROLLER = IPFSAccessController

export const OrbitDB = async ({
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
      finalIdentity = await identities_.createIdentity({
        id: identity.id,
        provider: identity.provider,
      })
    } else {
      finalIdentity = identity
    }
  } else {
    finalIdentity = await identities_.createIdentity({ id: generatedId })
  }

  const manifestStore = await ManifestStore({ ipfs })
  const databases: Record<string, any> = {}

  const open = async <T, D extends keyof DatabaseTypeMap<T>>(
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
    }: OrbitDBOpenOptions<T, D> = {},
  ): Promise<DatabaseTypeMap<T>[D]> => {
    let name: string,
      manifest: any,
      accessController: AccessControllerInstance,
      address_: string = address,
      type_: D = type!,
      meta_: any = meta

    if (databases[address_!]) {
      return databases[address_!] as DatabaseTypeMap<T>[D]
    }

    if (isValidAddress(address_)) {
      const addr = OrbitDBAddress(address_)
      manifest = await manifestStore.get(addr.hash)
      const acType = manifest.accessController.split('/', 2).pop()
      const AccessControllerType = getAccessController(acType)({})
      accessController = await AccessControllerType({
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        orbitdb: {
          open,
          identity: finalIdentity,
          ipfs,
        } as OrbitDBInstance,
        identities: identities_,
        address: manifest.accessController,
      })
      name = manifest.name
      type_ = type_ || manifest.type
      meta_ = meta_ || manifest.meta
    } else {
      type_ = type_ || DEFAULT_DATABASE_TYPE
      const AccessControllerType = AccessController || DEFAULT_ACCESS_CONTROLLER
      accessController = await AccessControllerType({
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        orbitdb: { open, identity: finalIdentity, ipfs } as OrbitDBInstance,
        identities: identities_,
        name: address_,
      })
      const m = await manifestStore.create({
        name: address_,
        type: type_,
        accessController: accessController.address!,
        meta: meta_,
      })
      manifest = m.manifest
      address_ = m.hash
      name = manifest.name
      meta_ = meta_ || manifest.meta
      if (databases[address_!]) {
        return databases[address_!] as DatabaseTypeMap<T>[D]
      }
    }

    const DatabaseType = Database || getDatabaseType(type_!)

    if (!DatabaseType) {
      throw new Error(`Unsupported database type: '${type_}'`)
    }

    const db = await DatabaseType({
      ipfs,
      identity: finalIdentity,
      address: address_,
      name,
      meta: meta_,
      directory: defaultDirectory,
      accessController,
      syncAutomatically: sync,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
    })

    db.events.on('close', onDatabaseClosed(address_))

    databases[address_!] = db

    return db as DatabaseTypeMap<T>[D]
  }

  const onDatabaseClosed = (address: string) => (): void => {
    delete databases[address!]
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
    Object.keys(databases).forEach((key) => delete databases[key!])
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

export { OrbitDBAddress }
