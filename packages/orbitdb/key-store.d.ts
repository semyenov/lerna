import type { StorageInstance } from './storage'
import type { PrivateKeys, Secp256k1PrivateKey } from './vendor'

interface KeyObject {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

interface KeyStoreOptions {
  storage?: StorageInstance
  path?: string
}
interface KeyStoreInstance {
  addKey(id: string, key: KeyObject): Promise<void>
  clear(): Promise<void>
  close(): Promise<void>
  createKey(id: string): Promise<PrivateKeys>
  getKey(id: string): Promise<Secp256k1PrivateKey>
  getPublic(keys: PrivateKeys, options?: { format: 'hex' }): Promise<string>
  getPublic(
    keys: PrivateKeys,
    options?: { format: 'buffer' },
  ): Promise<Uint8Array>
  hasKey(id: string): Promise<boolean>
}
declare function KeyStore(options?: KeyStoreOptions): Promise<KeyStoreInstance>

export type {
  KeyObject,
  KeyStoreInstance,
  KeyStoreOptions,
  PrivateKeys,
  Secp256k1PrivateKey,
}
export { KeyStore }

export function verifyMessage(
  signature: string,
  publicKey: string,
  data: string | Uint8Array,
): Promise<boolean>
export function signMessage(
  key: Secp256k1PrivateKey,
  data: string | Uint8Array,
): Promise<string>
