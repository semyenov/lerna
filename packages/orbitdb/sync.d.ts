import type { SyncEvents } from './events'
import type { Entry, LogInstance } from './log'
import type { IPFS, PeerId } from './vendor'

interface SyncOptions<T> {
  ipfs: IPFS
  log: LogInstance<T>
  events?: SyncEvents<T>
  start?: boolean

  onSynced?: (peerId: PeerId, heads: Entry.Instance<T>[]) => void
}
interface SyncInstance<T> {
  events: SyncEvents<T>
  peers: Set<PeerId>

  start: () => Promise<void>
  stop: () => Promise<void>
  add(entry: Entry.Instance<T>): void
}
declare function Sync<T>(options: SyncOptions<T>): Promise<SyncInstance<T>>

export type { SyncInstance, SyncOptions }
export { Sync }
