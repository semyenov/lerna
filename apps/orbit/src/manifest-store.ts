/* eslint-disable no-unused-vars */
import * as dagCbor from '@ipld/dag-cbor'
import { base58btc } from 'multiformats/bases/base58'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'

import {
  ComposedStorage,
  IPFSBlockStorage,
  LRUStorage,
  type StorageInstance,
} from './storage/index.js'

import type { DatabaseTypeMap } from './databases/index.js'
import type { HeliaInstance } from './vendor.js'

export interface Manifest {
  name: string
  type: keyof DatabaseTypeMap<any>
  accessController: string
  meta?: any
}

export interface ManifestStoreOptions {
  ipfs?: HeliaInstance
  storage?: StorageInstance<Uint8Array>
}
export interface ManifestStoreInstance {
  get: (address: string) => Promise<Manifest | null>
  create: (manifest: Manifest) => Promise<{ hash: string; manifest: Manifest }>
  close: () => Promise<void>
}

const codec = dagCbor
const hasher = sha256
const hashStringEncoding = base58btc

export const ManifestStore = async ({
  ipfs,
  storage,
}: ManifestStoreOptions = {}) => {
  const storage_ =
    storage ||
    (await ComposedStorage<Uint8Array>({
      storage1: await LRUStorage<Uint8Array>({ size: 1000 }),
      storage2: await IPFSBlockStorage<Uint8Array>({ ipfs, pin: true }),
    }))

  const instance: ManifestStoreInstance = {
    get: async (address) => {
      const bytes = await storage_.get(address)
      if (!bytes) {
        return null
      }

      const { value } = await Block.decode<Manifest, 113, 18>({
        bytes,
        codec,
        hasher,
      })
      return value
    },
    create: async ({ name, type, accessController, meta }) => {
      if (!name) {
        throw new Error('name is required')
      }
      if (!type) {
        throw new Error('type is required')
      }
      if (!accessController) {
        throw new Error('accessController is required')
      }

      const manifest = Object.assign(
        {
          name,
          type,
          accessController,
        },
        // meta field is only added to manifest if meta parameter is defined
        meta !== undefined ? { meta } : {},
      )

      const { cid, bytes } = await Block.encode({
        value: manifest,
        codec,
        hasher,
      })

      const hash = cid.toString(hashStringEncoding)
      await storage_.put(hash, bytes)

      return {
        hash,
        manifest,
      }
    },
    close: async () => {
      await storage_.close()
    },
  }

  return instance
}
