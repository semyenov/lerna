import { base58btc } from 'multiformats/bases/base58'
import { CID } from 'multiformats/cid'

import { posixJoin } from './utils/path-join.js'

export interface OrbitDBAddressInstance {
  protocol: string
  hash: string
  address: string
  toString: () => string
}

export const OrbitDBAddress = (address: string | OrbitDBAddressInstance) => {
  if (typeof address !== 'string') {
    return address
  }

  const protocol = 'orbitdb'
  const hash = address.replace('/orbitdb/', '').replace('\\orbitdb\\', '')

  const toString = () => {
    return posixJoin('/', protocol, hash)
  }

  return {
    protocol,
    hash,
    address,
    toString,
  }
}

export const isValidAddress = (address: string): boolean => {
  let address_ = address.toString()

  if (
    !address_.startsWith('/orbitdb') &&
    !address_.startsWith(String.raw`\orbitdb`)
  ) {
    return false
  }

  address_ = address_.replaceAll('/orbitdb/', '')
  address_ = address_.replaceAll('\\orbitdb\\', '')
  address_ = address_.replaceAll('/', '')
  address_ = address_.replaceAll('\\', '')

  let cid
  try {
    cid = CID.parse(address_, base58btc)
  } catch {
    return false
  }

  return cid !== undefined
}

export function parseAddress(address: string) {
  if (!address) {
    throw new Error(`Not a valid OrbitDB address: ${address}`)
  }

  if (!isValidAddress(address)) {
    throw new Error(`Not a valid OrbitDB address: ${address}`)
  }

  return OrbitDBAddress(address)
}
