import type {
  ComposedStorageInstance,
  IPFSBlockStorageInstance,
  LRUStorageInstance,
  LevelStorageInstance,
  LevelStorageOptions,
  MemoryStorageInstance,
  StorageInstance,
  StorageType,
  StorageTypeMap,
} from './level.js'

/**
 * @module Storage
 * @description
 * Storage backends for OrbitDB.
 */
export { default as ComposedStorage } from './composed.js'
export { default as IPFSBlockStorage } from './ipfs-block.js'
export { default as LevelStorage } from './level.js'
export { default as LRUStorage } from './lru.js'
export { default as MemoryStorage } from './memory.js'

export type {
  ComposedStorageInstance,
  IPFSBlockStorageInstance,
  LevelStorageOptions,
  LevelStorageInstance,
  LRUStorageInstance,
  MemoryStorageInstance,
  StorageInstance,
  StorageType,
  StorageTypeMap,
}
