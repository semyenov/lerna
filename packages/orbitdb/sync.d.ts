import type { SyncEvents } from './events'
import type { LogInstance } from './log'
import type { IPFS, PeerId } from './vendor'

interface SyncOptions<T> {
  ipfs: IPFS
  log: LogInstance<T>
  events?: SyncEvents<T>
  start?: boolean
  timestamp?: number
  timeout?: number

  onSynced?: (peerId: PeerId, heads: EntryInstance<T>[]) => void
}
interface SyncInstance<T> {
  events: SyncEvents<T>
  peers: Set<PeerId>

  start: () => Promise<void>
  stop: () => Promise<void>
  add: (entry: EntryInstance<T>) => void
}
