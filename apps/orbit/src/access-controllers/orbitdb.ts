/**
 * @namespace AccessControllers-OrbitDB
 * @memberof module:AccessControllers
 */

import { ACCESS_CONTROLLER_ORBITDB_TYPE } from '../constants.js'
import { createId } from '../utils/index.js'

import { IPFSAccessController } from './ipfs.js'

import type { AccessControllerInstance, AccessControllerType } from './index.js'
import type { DatabaseEvents } from '../database.js'
import type { EntryInstance } from '../oplog/entry.js'

export interface OrbitDBAccessControllerInstance
  extends AccessControllerInstance {
  type: string
  events: DatabaseEvents
  address: string
  write: string[]

  close: () => Promise<void>
  drop: () => Promise<void>
  capabilities: () => Promise<Record<string, Set<string>>>
  get: (capability: string) => Promise<Set<string>>
  grant: (capability: string, key: string) => Promise<void>
  hasCapability: (capability: string, key: string) => Promise<boolean>
  revoke: (capability: string, key: string) => Promise<void>
}

export const OrbitDBAccessController: AccessControllerType<
  'orbitdb',
  OrbitDBAccessControllerInstance
> =
  ({ write }: { write?: string[] }) =>
  async ({ orbitdb, identities, address, name }) => {
    let address_ = address || name || (await createId(64))
    const write_ = write || [orbitdb.identity.id]

    // Open the database used for access information
    const db = await orbitdb.open<string[], 'keyvalue'>(address_, {
      type: 'keyvalue',
      AccessController: IPFSAccessController({ write: write_ }),
    })
    address_ = db.address!

    const canAppend = async (entry: EntryInstance) => {
      const writerIdentity = await identities.getIdentity(entry.identity!)
      if (!writerIdentity) {
        return false
      }

      const { id } = writerIdentity
      // If the ACL contains the writer's public key or it contains '*'
      const hasWriteAccess =
        (await hasCapability('write', id)) || (await hasCapability('admin', id))
      if (hasWriteAccess) {
        return identities.verifyIdentity(writerIdentity)
      }

      return false
    }

    const capabilities = async () => {
      const _capabilities: Record<string, Set<string>> = {}
      for await (const { key, value } of db.iterator()) {
        _capabilities[key!] = new Set(value)
      }

      const toSet = (e: [string, Set<string>]) => {
        const key = e[0]
        _capabilities[key!] = new Set([...(_capabilities[key!] || []), ...e[1]])
      }

      // Merge with the access controller of the database
      // and make sure all values are Sets
      Object.entries({
        ..._capabilities,
        // Add the root access controller's 'write' access list
        // as admins on this controller
        ...{
          admin: new Set([
            ...(_capabilities.admin || []),
            ...db.accessController.write,
          ]),
        },
      }).forEach(toSet)

      return _capabilities
    }

    const get = async (capability: string) => {
      const _capabilities = await capabilities()
      return _capabilities[capability!] || new Set([])
    }

    const close = async () => {
      await db.close()
    }

    const drop = async () => {
      await db.drop()
    }

    const hasCapability = async (capability: string, key: string) => {
      // Write keys and admins keys are allowed
      const access = new Set(await get(capability))
      return access.has(key) || access.has('*')
    }

    /**
     * Grants a capability to an identity, storing it to the access control
     * database.
     * @param {string} capability A capability (e.g. write).
     * @param {string} key An id of an identity.
     * @memberof module:AccessControllers.AccessControllers-OrbitDB
     * @instance
     */
    const grant = async (capability: string, key: string) => {
      // Merge current keys with the new key
      const capabilities = new Set([
        ...((await db.get(capability)) || []),
        ...[key],
      ])
      await db.put(capability, Array.from(capabilities.values()))
    }

    const revoke = async (capability: string, key: string) => {
      const capabilities = new Set((await db.get(capability)) || [])
      capabilities.delete(key)
      if (capabilities.size > 0) {
        await db.put(capability, Array.from(capabilities.values()))
      } else {
        await db.del(capability)
      }
    }

    const accessController: OrbitDBAccessControllerInstance = {
      type: ACCESS_CONTROLLER_ORBITDB_TYPE,
      address: address_,
      write: write_,
      canAppend,
      capabilities,
      hasCapability,
      get,
      grant,
      revoke,
      close,
      drop,
      events: db.events,
    }

    return accessController
  }

OrbitDBAccessController.type = ACCESS_CONTROLLER_ORBITDB_TYPE
