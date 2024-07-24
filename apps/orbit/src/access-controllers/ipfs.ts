import * as dagCbor from '@ipld/dag-cbor'
import { base58btc } from 'multiformats/bases/base58'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'

import { ACCESS_CONTROLLER_IPFS_TYPE } from '../constants.js'
import {
  ComposedStorage,
  IPFSBlockStorage,
  LRUStorage,
  type StorageInstance,
} from '../storage/index.js'
import { join } from '../utils'

import type { AccessControllerInstance, AccessControllerType } from './index.js'
import type { EntryInstance } from '../oplog/entry.js'

const codec = dagCbor
const hasher = sha256
const hashStringEncoding = base58btc

const AccessControlList = async ({
  storage,
  type,
  params,
}: {
  storage: StorageInstance<any>
  type: string
  params: Record<string, any>
}) => {
  const manifest = {
    type,
    ...params,
  }
  const { cid, bytes } = await Block.encode({ value: manifest, codec, hasher })
  const hash = cid.toString(hashStringEncoding)
  await storage.put(hash, bytes)
  return hash
}

export interface IPFSAccessControllerInstance extends AccessControllerInstance {
  type: string
  address: string
  write: string[]

  canAppend: (entry: EntryInstance) => Promise<boolean>
}

export const IPFSAccessController: AccessControllerType<
  'ipfs',
  IPFSAccessControllerInstance
> =
  ({ write, storage }) =>
  async ({ orbitdb, identities, address }) => {
    let address_: string | undefined = address
    let write_ = write || [orbitdb.identity.id]

    const storage_ =
      storage ||
      (await ComposedStorage({
        storage1: await LRUStorage({ size: 1000 }),
        storage2: await IPFSBlockStorage({ ipfs: orbitdb.ipfs, pin: true }),
      }))

    if (address_) {
      const manifestBytes = await storage_.get(
        address_.replaceAll('/ipfs/', ''),
      )
      const { value } = await Block.decode<{ write: string[] }, 113, 18>({
        bytes: manifestBytes!,
        codec,
        hasher,
      })
      write_ = value.write
    } else {
      address_ = await AccessControlList({
        type: ACCESS_CONTROLLER_IPFS_TYPE,
        storage: storage_,
        params: { write: write_ },
      })
      address_ = join('/', ACCESS_CONTROLLER_IPFS_TYPE, address_)
    }

    const canAppend = async (entry: EntryInstance) => {
      const writerIdentity = await identities.getIdentity(entry.identity!)
      if (!writerIdentity) {
        return false
      }
      const { id } = writerIdentity
      // Allow if the write access list contain the writer's id or is '*'
      if (write_.includes(id) || write_.includes('*')) {
        // Check that the identity is valid
        return identities.verifyIdentity(writerIdentity)
      }
      return false
    }

    const accessController: IPFSAccessControllerInstance = {
      type: ACCESS_CONTROLLER_IPFS_TYPE,
      address: address_,
      write: write_,
      canAppend,
    }

    return accessController
  }

IPFSAccessController.type = ACCESS_CONTROLLER_IPFS_TYPE
