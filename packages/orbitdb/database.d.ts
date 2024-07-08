import type { AccessControllerInstance } from './access-controller'
import type { DatabaseEvents } from './events'
import type { IdentityInstance } from './identities'
import type { Entry, LogInstance } from './log'
import type { StorageInstance } from './storage'
import type { SyncInstance } from './sync'
import type { IPFS, PeerId } from './vendor'

interface DatabaseOptions<T> {
  ipfs: IPFS
  address?: string
  name?: string
  directory?: string
  referencesCount?: number
  syncAutomatically?: boolean
  meta?: any

  accessController?: AccessControllerInstance
  identity?: IdentityInstance
  headsStorage?: StorageInstance
  entryStorage?: StorageInstance
  indexStorage?: StorageInstance
  onUpdate?: (entry: Entry.Instance<T>) => void
}
interface DatabaseInstance<T = unknown> {
  address?: string
  name?: string
  type: string
  peers: Set<PeerId>
  indexBy: keyof T
  meta: any

  events: DatabaseEvents<T>
  access?: AccessControllerInstance
  identity?: IdentityInstance
  log: LogInstance<T>
  sync: SyncInstance<T>

  addOperation(op: any): Promise<string>
  close(): Promise<void>
  drop(): Promise<void>
}
declare function Database<T>(
  options: DatabaseOptions<T>,
): Promise<DatabaseInstance<T>>

export type { DatabaseInstance, DatabaseOptions }
export { Database }
