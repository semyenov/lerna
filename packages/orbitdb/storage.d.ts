interface StorageInstance<T> {
  put: (hash: string, data: any) => Promise<void>
  get: (hash: string) => Promise<T>
  del: (hash: string) => Promise<void>
  close: () => Promise<void>
  clear: () => Promise<void>
  iterator: () => AsyncGenerator<[string, T]>
  merge: (other: StorageInstance) => Promise<void>
}

interface ComposedStorageInstance extends StorageInstance {}
declare function ComposedStorage(
  storage1: StorageInstance,
  storage2: StorageInstance,
): Promise<ComposedStorageInstance>

interface IPFSBlockStorageOptions {
  ipfs: any
  pin?: boolean
  timeout?: number
}
interface IPFSBlockStorageInstance extends StorageInstance {
  get: (hash: string) => Promise<Uint8Array>
}
declare function IPFSBlockStorage(
  options: IPFSBlockStorageOptions,
): Promise<IPFSBlockStorageInstance>

interface LRUStorageOptions {
  size?: string
}
interface LRUStorageInstance extends StorageInstance {}
declare function LRUStorage(
  options?: LRUStorageOptions,
): Promise<LRUStorageInstance>

interface LevelStorageOptions {
  path?: string
  valueEncoding?: string
}
interface LevelStorageInstance<T> extends StorageInstance<T> {}
declare function LevelStorage<T = unknown>(
  options?: LevelStorageOptions,
): Promise<LevelStorageInstance<T>>

interface MemoryStorageInstance extends StorageInstance {}
declare function MemoryStorage(): Promise<MemoryStorageInstance>

interface StorageTypeMap {
  composed: StorageInstance
  ipfs: IPFSBlockStorageInstance
  lru: LRUStorageInstance
  level: LevelStorageInstance
  memory: MemoryStorageInstance
}

type StorageType = keyof StorageTypeMap

export type {
  ComposedStorageInstance,
  IPFSBlockStorageInstance,
  LevelStorageInstance,
  LevelStorageOptions,
  LRUStorageInstance,
  MemoryStorageInstance,
  StorageInstance,
  StorageType,
  StorageTypeMap,
}
export {
  ComposedStorage,
  IPFSBlockStorage,
  LevelStorage,
  LRUStorage,
  MemoryStorage,
}
