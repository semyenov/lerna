/* eslint-disable unused-imports/no-unused-vars */
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

export class IPFSBlockStorage<T = unknown> implements StorageInstance<T> {
  private ipfs: any
  private readonly pin: boolean
  private readonly timeout: number

  constructor(options: IPFSBlockStorageOptions) {
    if (!options.ipfs) {
      throw new Error('An instance of ipfs is required.')
    }
    this.ipfs = options.ipfs
    this.pin = options.pin || false
    this.timeout = options.timeout || STORAGE_IPFS_BLOCKSTORAGE_TIMEOUT
  }

  static async create<T = unknown>(
    options: IPFSBlockStorageOptions,
  ): Promise<IPFSBlockStorage<T>> {
    return new IPFSBlockStorage<T>(options)
  }

  async put(hash: string, data: any): Promise<void> {
    const cid = CID.parse(hash, base58btc)
    const { signal } = new TimeoutController(this.timeout)

    await this.ipfs.blockstore.put(cid, data, { signal })
    if (this.pin && !(await this.ipfs.pins.isPinned(cid))) {
      drain(this.ipfs.pins.add(cid))
    }
  }

  async del(hash: string): Promise<void> {
    // No-op for IPFS Block Storage
  }

  async get(hash: string): Promise<T | null> {
    const cid = CID.parse(hash, base58btc)
    const { signal } = new TimeoutController(this.timeout)
    const block = await this.ipfs.blockstore.get(cid, { signal })
    return block || null
  }

  async *iterator(): AsyncIterableIterator<[string, T]> {
    // No-op for IPFS Block Storage
  }

  async merge(): Promise<void> {
    // No-op for IPFS Block Storage
  }

  async clear(): Promise<void> {
    // No-op for IPFS Block Storage
  }

  async close(): Promise<void> {
    // No-op for IPFS Block Storage
  }
}
