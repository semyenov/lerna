import * as dagCbor from '@ipld/dag-cbor'
import { base58btc } from 'multiformats/bases/base58'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'

import { Clock, type ClockInstance } from './clock.js'

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
  hash?: string
  identity?: string
  bytes?: Uint8Array
  sig?: string
}

export class Entry<T = unknown> implements EntryInstance<T> {
  id: string
  payload: T
  next: string[]
  refs: string[]
  clock: ClockInstance
  v: number = 2
  key?: string
  hash?: string
  identity?: string
  bytes?: Uint8Array
  sig?: string

  private constructor(
    id: string,
    payload: T,
    clock: ClockInstance,
    next: string[],
    refs: string[] = [],
  ) {
    this.id = id
    this.payload = payload
    this.clock = clock
    this.next = next
    this.refs = refs
  }

  static async create<T>(
    identity: IdentityInstance,
    id: string,
    payload: T,
    clock?: ClockInstance,
    next?: Array<string>,
    refs: Array<string> = [],
  ): Promise<Entry<T>> {
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

    const clock_ = clock || new Clock(identity.publicKey)
    const entry = new Entry(id, payload, clock_, next, refs)

    const { bytes } = await Block.encode({ value: entry, codec, hasher })
    const signature = await identity.sign!(bytes)

    entry.key = identity.publicKey
    entry.identity = identity.hash
    entry.sig = signature

    return entry.encode()
  }

  static async verify<T>(
    identities: {
      verify?: (
        signature: string,
        publicKey: string,
        data: string | Uint8Array,
      ) => Promise<boolean>
    },
    entry: EntryInstance<T>,
  ): Promise<boolean> {
    if (!identities) {
      throw new Error('Identities is required, cannot verify entry')
    }
    if (!Entry.isEntry(entry)) {
      throw new Error('Invalid Log entry')
    }
    if (!entry.key) {
      throw new Error("Entry doesn't have a key")
    }
    if (!entry.sig) {
      throw new Error("Entry doesn't have a signature")
    }

    const value = {
      id: entry.id,
      payload: entry.payload,
      next: entry.next,
      refs: entry.refs,
      clock: entry.clock,
      v: entry.v,
    }

    const { bytes } = await Block.encode<EntryInstance<T>, 113, 18>({
      value,
      codec,
      hasher,
    })

    return identities.verify!(entry.sig, entry.key, bytes)
  }

  static isEntry(obj: any): obj is EntryInstance {
    return (
      obj &&
      obj.id !== undefined &&
      obj.next !== undefined &&
      obj.payload !== undefined &&
      obj.v !== undefined &&
      obj.clock !== undefined &&
      obj.refs !== undefined
    )
  }

  static isEqual<T>(a: EntryInstance<T>, b: EntryInstance<T>): boolean {
    return a && b && a.hash === b.hash
  }

  static async decode<T>(bytes: Uint8Array): Promise<Entry<T>> {
    const { value } = await Block.decode<EntryInstance<T>, 113, 18>({
      bytes,
      codec,
      hasher,
    })
    return new Entry(
      value.id,
      value.payload,
      value.clock,
      value.next,
      value.refs,
    ).encode()
  }

  async encode(): Promise<this> {
    const { cid, bytes } = await Block.encode({ value: this, codec, hasher })
    this.hash = cid.toString(hashStringEncoding)
    this.clock = new Clock(this.clock.id, this.clock.time)
    this.bytes = bytes

    return this
  }
}
