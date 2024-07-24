/* eslint-disable no-unused-vars */
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
async function create<T>(
  identity: IdentityInstance,
  id: string,
  payload: T,
  clock?: ClockInstance,
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

  const _clock = clock || Clock(identity.publicKey)

  const entry: EntryInstance<T> = {
    id, // For determining a unique chain
    v: 2, // To tag the version of this data structure

    payload, // Can be any dag-cbor encodeable data

    refs, // Array of strings of CIDs
    next, // Array of strings of CIDs
    clock: _clock, // Clock
  }

  const { bytes } = await Block.encode({ value: entry, codec, hasher })
  const signature = await identity.sign!(bytes)

  entry.key = identity.publicKey
  entry.identity = identity.hash
  entry.sig = signature

  return encode(entry)
}

export async function verify<T>(
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
  if (!isEntry(entry)) {
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

const isEntry = (obj: any): obj is EntryInstance => {
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

const isEqual = (a: EntryInstance, b: EntryInstance) => {
  return a && b && a.hash === b.hash
}

const decode = async <T>(bytes: Uint8Array) => {
  const { value } = await Block.decode<EntryInstance<T>, 113, 18>({
    bytes,
    codec,
    hasher,
  })
  return encode(value)
}

const encode = async <T>(entry: EntryInstance<T>) => {
  const { cid, bytes } = await Block.encode({ value: entry, codec, hasher })
  const hash = cid.toString(hashStringEncoding)
  const clock = Clock(entry.clock.id, entry.clock.time)

  return {
    ...entry,
    clock,
    hash,
    bytes,
  }
}

export const Entry = {
  create,
  verify,
  decode,
  encode,
  isEntry,
  isEqual,
}
