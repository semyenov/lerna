import { TypedEventEmitter } from '@libp2p/interface'

import { ACCESS_CONTROLLER_ORBITDB_TYPE } from '../constants.js'
import { createId } from '../utils/index.js'

import { IPFSAccessController } from './ipfs.js'

import type { AccessControllerInstance, AccessControllerType } from './index.js'
import type { DatabaseEvents, DatabaseInstance } from '../database.js'
import type { DatabaseType } from '../databases/index.js'
import type { IdentitiesInstance } from '../identities/index.js'
import type { EntryInstance } from '../oplog/entry.js'
import type { OrbitDBInstance } from '../orbitdb.js'

export interface OrbitDBAccessControllerInstance<
  E extends DatabaseEvents<Record<string, string[]>>,
> extends AccessControllerInstance {
  type: string
  events: TypedEventEmitter<E>
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

interface OrbitDBAccessControllerOptions {
  orbitdb: OrbitDBInstance
  identities: IdentitiesInstance
  address?: string
  name?: string
  write?: string[]
}

export class OrbitDBAccessController
  implements
    OrbitDBAccessControllerInstance<DatabaseEvents<Record<string, string[]>>>
{
  static type = ACCESS_CONTROLLER_ORBITDB_TYPE

  type: string
  events: TypedEventEmitter<DatabaseEvents<Record<string, string[]>>>
  address: string
  write: string[]
  private db: DatabaseInstance<
    Record<string, string[]>,
    DatabaseEvents<Record<string, string[]>>
  >
  private orbitdb: OrbitDBInstance
  private identities: IdentitiesInstance

  constructor({
    orbitdb,
    identities,
    address,
    name,
    write,
  }: OrbitDBAccessControllerOptions) {
    this.type = ACCESS_CONTROLLER_ORBITDB_TYPE
    this.orbitdb = orbitdb
    this.identities = identities
    this.write = write || [orbitdb.identity.id]
    this.address = address || name || ''
    this.events = new TypedEventEmitter<
      DatabaseEvents<Record<string, string[]>>
    >()
  }

  async initialize(): Promise<void> {
    const address_ = this.address || (await createId(64))
    this.db = await this.orbitdb.open<Record<string, string[]>, 'keyvalue'>(
      address_,
      {
        type: 'keyvalue',
        AccessController: IPFSAccessController({ write: this.write }),
      },
    )
    this.address = this.db.address!
    this.events = this.db.events
  }

  async canAppend(entry: EntryInstance): Promise<boolean> {
    const writerIdentity = await this.identities.getIdentity(entry.identity!)
    if (!writerIdentity) {
      return false
    }

    const { id } = writerIdentity
    const hasWriteAccess =
      (await this.hasCapability('write', id)) ||
      (await this.hasCapability('admin', id))
    if (hasWriteAccess) {
      return this.identities.verifyIdentity(writerIdentity)
    }

    return false
  }

  async capabilities(): Promise<Record<string, Set<string>>> {
    const _capabilities: Record<string, Set<string>> = {}
    for await (const { key, value } of this.db.iterator()) {
      _capabilities[key!] = new Set(value)
    }

    const toSet = (e: [string, Set<string>]) => {
      const key = e[0]
      _capabilities[key!] = new Set([...(_capabilities[key!] || []), ...e[1]])
    }

    Object.entries({
      ..._capabilities,
      ...{
        admin: new Set([
          ...(_capabilities.admin || []),
          ...this.db.accessController.write,
        ]),
      },
    }).forEach(toSet)

    return _capabilities
  }

  async get(capability: string): Promise<Set<string>> {
    const _capabilities = await this.capabilities()
    return _capabilities[capability!] || new Set([])
  }

  async close(): Promise<void> {
    await this.db.close()
  }

  async drop(): Promise<void> {
    await this.db.drop()
  }

  async hasCapability(capability: string, key: string): Promise<boolean> {
    const access = new Set(await this.get(capability))
    return access.has(key) || access.has('*')
  }

  async grant(capability: string, key: string): Promise<void> {
    const capabilities = new Set([
      ...((await this.db.get(capability)) || []),
      key,
    ])
    await this.db.put(capability, Array.from(capabilities))
  }

  async revoke(capability: string, key: string): Promise<void> {
    const capabilities = new Set((await this.db.get(capability)) || [])
    capabilities.delete(key)
    if (capabilities.size > 0) {
      await this.db.put(capability, Array.from(capabilities))
    } else {
      await this.db.del(capability)
    }
  }
}

export const createOrbitDBAccessController: AccessControllerType<
  'orbitdb',
  OrbitDBAccessControllerInstance
> =
  ({ write }: { write?: string[] }) =>
  async (options: OrbitDBAccessControllerOptions) => {
    const controller = new OrbitDBAccessController({ ...options, write })
    await controller.initialize()
    return controller
  }

createOrbitDBAccessController.type = ACCESS_CONTROLLER_ORBITDB_TYPE
