import { ACCESS_CONTROLLER_ORBITDB_TYPE } from '../constants.js'
import { createId } from '../utils/index.js'

import { IPFSAccessController } from './ipfs.js'

import type { AccessControllerInstance } from './index.js'
import type { DatabaseEvents } from '../database.js'
import type { DatabaseTypeMap } from '../databases/index.js'
import type { IdentitiesInstance } from '../identities/index.js'
import type { EntryInstance } from '../oplog/entry.js'
import type { OrbitDBInstance } from '../orbitdb.js'
import type { TypedEventEmitter } from '@libp2p/interface'

export interface OrbitDBAccessControllerInstance<
  E extends DatabaseEvents<string[]> = DatabaseEvents<string[]>,
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
  implements OrbitDBAccessControllerInstance<DatabaseEvents<string[]>>
{
  get type(): 'orbitdb' {
    return ACCESS_CONTROLLER_ORBITDB_TYPE
  }
  static get type(): 'orbitdb' {
    return ACCESS_CONTROLLER_ORBITDB_TYPE
  }

  public address: string
  public write: string[]
  public events: TypedEventEmitter<DatabaseEvents<string[]>>

  private database: DatabaseTypeMap<string[]>['keyvalue']
  private identities: IdentitiesInstance

  private constructor(
    orbitdb: OrbitDBInstance,
    identities: IdentitiesInstance,
    database: DatabaseTypeMap<string[]>['keyvalue'],
    address: string,
    write?: string[],
  ) {
    this.identities = identities
    this.database = database
    this.write = write || [orbitdb.identity.id]
    this.address = address
    this.events = database.events
  }

  static async create(
    options: OrbitDBAccessControllerOptions,
  ): Promise<OrbitDBAccessControllerInstance<DatabaseEvents<string[]>>> {
    const { orbitdb, identities, name, write } = options
    const address = options.address || name || (await createId(64))
    const database = await options.orbitdb.open<string[], 'keyvalue'>(
      'keyvalue',
      address,
      {
        type: 'keyvalue',
        AccessController: IPFSAccessController.create,
      },
    )

    return new OrbitDBAccessController(
      orbitdb,
      identities,
      database,
      address,
      write,
    )
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
    const caps: Record<string, Set<string>> = {}
    for await (const { key, value } of this.database.iterator()) {
      caps[key!] = new Set(value)
    }

    const toSet = (e: [string, Set<string>]) => {
      const key = e[0]
      caps[key!] = new Set([...(caps[key!] || []), ...e[1]])
    }

    Object.entries({
      ...caps,
      ...{
        admin: new Set([
          ...(caps.admin || []),
          ...this.database.accessController.write,
        ]),
      },
    }).forEach(toSet)

    return caps
  }

  async get(capability: string): Promise<Set<string>> {
    const caps = await this.capabilities()
    return caps[capability!] || new Set([])
  }

  async close(): Promise<void> {
    await this.database.close()
  }

  async drop(): Promise<void> {
    await this.database.drop()
  }

  async hasCapability(capability: string, key: string): Promise<boolean> {
    const access = await this.get(capability)
    return access.has(key) || access.has('*')
  }

  async grant(capability: string, key: string): Promise<void> {
    const caps = new Set([
      ...((await this.database.get(capability)) || []),
      key,
    ])
    await this.database.put(capability, Array.from(caps))
  }

  async revoke(capability: string, key: string): Promise<void> {
    const caps = new Set((await this.database.get(capability)) || [])
    caps.delete(key)
    if (caps.size > 0) {
      await this.database.put(capability, Array.from(caps))
    } else {
      await this.database.del(capability)
    }
  }
}
