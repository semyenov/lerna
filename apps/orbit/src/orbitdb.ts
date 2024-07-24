import { getAccessController } from './access-controllers/index.js'
import IPFSAccessController from './access-controllers/ipfs.js'
import { OrbitDBAddress, isValidAddress } from './address.js'
import { getDatabaseType } from './databases/index.js'
import { Identities } from './identities/index.js'
import { KeyStore } from './key-store.js'
import { ManifestStore } from './manifest-store.js'
import { createId } from './utils/index.js'
import pathJoin from './utils/path-join.js'

const DefaultDatabaseType = 'events'

const DefaultAccessController = IPFSAccessController

const OrbitDB = async ({ ipfs, id, identity, identities, directory } = {}) => {
  /**
   * @namespace module:OrbitDB~OrbitDB
   * @description The instance returned by {@link module:OrbitDB}.
   */

  if (ipfs == null) {
    throw new Error('IPFS instance is a required argument.')
  }

  id = id || (await createId())
  const peerId = ipfs.libp2p.peerId
  directory = directory || './orbitdb'

  let keystore

  if (identities) {
    keystore = identities.keystore
  } else {
    keystore = await KeyStore({ path: pathJoin(directory, './keystore') })
    identities = await Identities({ ipfs, keystore })
  }

  if (identity) {
    if (typeof identity.provider === 'function') {
      identity = await identities.createIdentity({ ...identity })
    }
  } else {
    identity = await identities.createIdentity({ id })
  }

  const manifestStore = await ManifestStore({ ipfs })

  let databases = {}

  const open = async (
    address,
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
    } = {},
  ) => {
    let name, manifest, accessController

    if (databases[address]) {
      return databases[address]
    }

    if (isValidAddress(address)) {
      // If the address given was a valid OrbitDB address, eg. '/orbitdb/zdpuAuK3BHpS7NvMBivynypqciYCuy2UW77XYBPUYRnLjnw13'
      const addr = OrbitDBAddress(address)
      manifest = await manifestStore.get(addr.hash)
      const acType = manifest.accessController.split('/', 2).pop()
      AccessController = getAccessController(acType)()
      accessController = await AccessController({
        orbitdb: { open, identity, ipfs },
        identities,
        address: manifest.accessController,
      })
      name = manifest.name
      type = type || manifest.type
      meta = manifest.meta
    } else {
      // If the address given was not valid, eg. just the name of the database
      type = type || DefaultDatabaseType
      AccessController = AccessController || DefaultAccessController()
      accessController = await AccessController({
        orbitdb: { open, identity, ipfs },
        identities,
        name: address,
      })
      const m = await manifestStore.create({
        name: address,
        type,
        accessController: accessController.address,
        meta,
      })
      manifest = m.manifest
      address = OrbitDBAddress(m.hash)
      name = manifest.name
      meta = manifest.meta
      // Check if we already have the database open and return if it is
      if (databases[address]) {
        return databases[address]
      }
    }

    Database = Database || getDatabaseType(type)()

    if (!Database) {
      throw new Error(`Unsupported database type: '${type}'`)
    }

    address = address.toString()

    const db = await Database({
      ipfs,
      identity,
      address,
      name,
      access: accessController,
      directory,
      meta,
      syncAutomatically: sync,
      headsStorage,
      entryStorage,
      indexStorage,
      referencesCount,
    })

    db.events.on('close', onDatabaseClosed(address))

    databases[address] = db

    return db
  }

  const onDatabaseClosed = (address) => () => {
    delete databases[address]
  }

  /**
   * Stops OrbitDB, closing the underlying keystore and manifest store.
   * @function stop
   * @memberof module:OrbitDB~OrbitDB
   * @instance
   * @async
   */
  const stop = async () => {
    for (const db of Object.values(databases)) {
      await db.close()
    }
    if (keystore) {
      await keystore.close()
    }
    if (manifestStore) {
      await manifestStore.close()
    }
    databases = {}
  }

  return {
    id,
    open,
    stop,
    ipfs,
    directory,
    keystore,
    identity,
    peerId,
  }
}

export { OrbitDB as default, OrbitDBAddress }
