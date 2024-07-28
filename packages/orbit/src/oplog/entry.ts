/* eslint-disable no-console */
import * as dagCbor from '@ipld/dag-cbor'
import { base58btc } from 'multiformats/bases/base58'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'

import { verifyMessage } from '../key-store.js'

import { Clock } from './clock.js'

// eslint-disable-next-line no-duplicate-imports
import type { ClockInstance } from './clock.js'
// eslint-disable-next-line perfectionist/sort-imports
import type { IdentityInstance } from '../identities'

const codec = dagCbor
const hasher = sha256
const hashStringEncoding = base58btc

export interface EntryInstance<T = unknown> {
  id: string
  payload: T
  next: string[]
  refs: string[]
  clock: ClockInstance
  v: number
  key?: string
  hash: string
  identity?: string
  bytes?: Uint8Array
  sig?: string
}

export const Entry = {
  async create<T>(
    identity: IdentityInstance,
    sign: (data: Uint8Array) => Promise<string>,
    id: string,
    payload: T,
    clock: ClockInstance,
    next?: Array<string>,
    refs: Array<string> = [],
  ): Promise<EntryInstance<T>> {
    if (!identity) {
      throw new Error('Identity is required, cannot create entry')
    }
    if (!id) {
      throw new Error('Entry requires an id')
    }
    if (!payload) {
      throw new Error('Entry requires a payload')
    }
    if (!next || !Array.isArray(next)) {
      throw new Error("'next' argument is not an array")
    }

    const entry: EntryInstance<T> = await this.encode({
      id,
      v: 2,
      payload,
      clock,
      next,
      refs,
    })

    const { bytes } = await Block.encode({
      value: entry,
      codec,
      hasher,
    })
    const signature = await sign(bytes)

    entry.key = identity.publicKey
    entry.identity = identity.hash
    entry.sig = signature

    console.log('create entry', entry)

    return this.encode(entry)
  },

  async verify<T>(entry: EntryInstance<T>): Promise<boolean> {
    if (!Entry.isEntry(entry)) {
      throw new Error('Invalid Log entry')
    }
    if (!entry.key) {
      throw new Error("Entry doesn't have a key")
    }
    if (!entry.sig) {
      throw new Error("Entry doesn't have a signature")
    }

    const { bytes } = await Block.encode({
      value: {
        id: entry.id,
        payload: entry.payload,
        next: entry.next,
        refs: entry.refs,
        clock: entry.clock,
        v: entry.v,
      },
      codec,
      hasher,
    })

    return verifyMessage(entry.sig, entry.key, bytes.toString())
  },

  isEntry(obj: any): obj is EntryInstance {
    return (
      obj &&
      obj.id !== undefined &&
      obj.next !== undefined &&
      obj.payload !== undefined &&
      obj.v !== undefined &&
      obj.clock !== undefined &&
      obj.refs !== undefined
    )
  },

  isEqual<T>(a: EntryInstance<T>, b: EntryInstance<T>): boolean {
    return a && b && a.hash === b.hash
  },

  async decode<T>(bytes: Uint8Array): Promise<EntryInstance<T>> {
    const { value } = await Block.decode<EntryInstance<T>, 113, 18>({
      bytes,
      codec,
      hasher,
    })

    return this.encode(value)
  },

  async encode<T>(
    entry: Omit<EntryInstance<T>, 'hash' | 'bytes'>,
  ): Promise<EntryInstance<T>> {
    const { cid, bytes } = await Block.encode({ value: entry, codec, hasher })
    const hash = cid.toString(hashStringEncoding)
    const clock = new Clock(entry.clock.id, entry.clock.time)

    return {
      ...entry,
      clock,
      hash,
      bytes,
    }
  },
}
