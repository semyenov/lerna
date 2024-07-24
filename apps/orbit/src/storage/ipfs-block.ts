import drain from 'it-drain'
import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'
import { TimeoutController } from 'timeout-abort-controller'

import { STORAGE_IPFS_BLOCKSTORAGE_TIMEOUT } from '../constants'

import type { StorageInstance } from './types'

export interface IPFSBlockStorageOptions {
  ipfs: any
  pin?: boolean
  timeout?: number
}
export interface IPFSBlockStorageInstance<T> extends StorageInstance<T> {}

export const IPFSBlockStorage = async <T = unknown>({
  ipfs,
  pin,
  timeout = STORAGE_IPFS_BLOCKSTORAGE_TIMEOUT,
}: IPFSBlockStorageOptions): Promise<IPFSBlockStorageInstance<T>> => {
  if (!ipfs) {
    throw new Error('An instance of ipfs is required.')
  }

  const instance: IPFSBlockStorageInstance<T> = {
    put: async (hash: string, data: any) => {
      const cid = CID.parse(hash, base58btc)
      const { signal } = new TimeoutController(timeout)

      await ipfs.blockstore.put(cid, data, { signal })
      if (pin && !(await ipfs.pins.isPinned(cid))) {
        drain(ipfs.pins.add(cid))
      }
    },
    del: async () => {},
    get: async (hash: string) => {
      const cid = CID.parse(hash, base58btc)
      const { signal } = new TimeoutController(
        timeout || STORAGE_IPFS_BLOCKSTORAGE_TIMEOUT,
      )
      const block = await ipfs.blockstore.get(cid, { signal })
      if (block) {
        return block
      }
    },
    async *iterator() {},
    merge: async () => {},
    clear: async () => {},
    close: async () => {},
  }

  return instance
}
