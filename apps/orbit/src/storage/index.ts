import { ComposedStorage, type ComposedStorageOptions } from './composed.js'
import { IPFSBlockStorage, type IPFSBlockStorageOptions } from './ipfs-block.js'
import { LevelStorage, type LevelStorageOptions } from './level.js'
import { LRUStorage, type LRUStorageOptions } from './lru.js'
import { MemoryStorage, type MemoryStorageOptions } from './memory.js'

import type { StorageInstance } from './types.js'

interface StorageTypeMap<T = unknown> {
  composed: ComposedStorage<T>
  ipfs: IPFSBlockStorage<T>
  lru: LRUStorage<T>
  level: LevelStorage<T>
  memory: MemoryStorage<T>
}
type StorageType = keyof StorageTypeMap

export {
  ComposedStorage,
  IPFSBlockStorage,
  LevelStorage,
  LRUStorage,
  MemoryStorage,
}
export type {
  ComposedStorageOptions,
  IPFSBlockStorageOptions,
  LevelStorageOptions,
  LRUStorageOptions,
  MemoryStorageOptions,
  StorageInstance,
  StorageType,
  StorageTypeMap,
}
