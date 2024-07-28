/* eslint-disable no-console */
import { identify } from '@libp2p/identify'

import {
  KeyStore,
  signMessage,
  verifyMessage,
  type KeyStoreInstance,
} from '../key-store.js'
import {
  ComposedStorage,
  IPFSBlockStorage,
  LRUStorage,
  type StorageInstance,
} from '../storage'
import { join } from '../utils'

import { Identity, type IdentityInstance } from './identity.js'
import { IdentityProviders, type IdentityProviderInstance } from './providers'

import type { HeliaInstance } from '../vendor.js'
interface IdentitiesCreateIdentityOptions {
  id?: string
  provider?: IdentityProviderInstance
}

export interface IdentitiesOptions {
  path?: string
  ipfs?: HeliaInstance
  keystore?: KeyStoreInstance
  storage?: StorageInstance<Uint8Array>
}

export interface IdentitiesInstance {
  createIdentity: (
    options?: IdentitiesCreateIdentityOptions,
  ) => Promise<IdentityInstance>
  getIdentity: (id: string) => Promise<IdentityInstance | null>
  verifyIdentity: (identity: IdentityInstance) => Promise<boolean>
  keystore: KeyStoreInstance
  sign: (identity: IdentityInstance, data: string) => Promise<string>
  verify: (
    signature: string,
    publickey: string,
    data: string,
  ) => Promise<boolean>
}

const DEFAULT_KEYS_PATH = join('./orbitdb', 'identities')

export class Identities implements IdentitiesInstance {
  keystore: KeyStoreInstance
  private storage: StorageInstance<Uint8Array>
  private verifiedIdentitiesCache: LRUStorage<
    Omit<IdentityInstance, 'getKey' | 'sign' | 'verify' | 'provider'>
  >

  private constructor(
    keystore: KeyStoreInstance,
    storage: StorageInstance<Uint8Array>,
    verifiedIdentitiesCache: LRUStorage<
      Omit<IdentityInstance, 'getKey' | 'sign' | 'verify' | 'provider'>
    >,
  ) {
    this.keystore = keystore
    this.storage = storage
    this.verifiedIdentitiesCache = verifiedIdentitiesCache
  }

  static async create(
    options: IdentitiesOptions = { path: DEFAULT_KEYS_PATH },
  ): Promise<Identities> {
    const keys =
      options.keystore ||
      (await KeyStore.create({ path: options.path || DEFAULT_KEYS_PATH }))

    const storage: StorageInstance<Uint8Array> = options.storage
      ? options.storage
      : ComposedStorage.create({
          storage1: await LRUStorage.create<Uint8Array>({ size: 1000 }),
          storage2: await IPFSBlockStorage.create({
            ipfs: options.ipfs!,
            pin: true,
          }),
        })

    const verifiedIdentitiesCache = await LRUStorage.create<
      Omit<IdentityInstance, 'getKey' | 'sign' | 'verify' | 'provider'>
    >({
      size: 1000,
    })

    return new Identities(keys, storage, verifiedIdentitiesCache)
  }

  async createIdentity(
    options: IdentitiesCreateIdentityOptions = {},
  ): Promise<Identity> {
    const DefaultIdentityProvider =
      IdentityProviders.getIdentityProvider('publickey')
    const identityProvider: IdentityProviderInstance =
      options.provider ||
      new DefaultIdentityProvider({ keystore: this.keystore })

    if (!IdentityProviders.getIdentityProvider(identityProvider.type)) {
      throw new Error(
        'Identity provider is unknown. Use useIdentityProvider(provider) to register the identity provider',
      )
    }

    const id = await identityProvider.getId({ id: options.id! })
    const privateKey =
      (await this.keystore.getKey(id)) || (await this.keystore.createKey(id))
    const publicKey = this.keystore.getPublic(privateKey)
    const idSignature = await signMessage(privateKey, id)
    const publicKeyAndIdSignature = await identityProvider.signIdentity(
      publicKey + idSignature,
      { id: options.id! },
    )
    const signatures = {
      id: idSignature,
      publicKey: publicKeyAndIdSignature,
    }

    const identity = await Identity.create({
      id,
      publicKey,
      signatures,
      type: identityProvider.type,
      provider: identityProvider,
      sign: signFactory(this.keystore, id),
    })

    // console.log('get identity', identity.bytes, identity.hash)
    await this.storage.put(identity.hash, identity.bytes)

    return identity
  }

  async verifyIdentity(identity: IdentityInstance): Promise<boolean> {
    if (!Identity.isIdentity(identity)) {
      return false
    }

    // console.log('*******verifyIdentity', identity)

    const { id, publicKey, signatures } = identity
    const idSignatureVerified = await verifyMessage(
      signatures.id,
      publicKey,
      id,
    )

    // console.log('idSignatureVerified', idSignatureVerified)

    if (!idSignatureVerified) {
      return false
    }

    const cachedIdentity = await this.verifiedIdentitiesCache.get(id)
    const verifiedIdentity =
      cachedIdentity &&
      (await Identity.create({
        ...cachedIdentity,
        sign: signFactory(this.keystore, id),
        provider: identity.provider,
      }))

    // console.log('verifiedIdentity', verifiedIdentity, signatures)

    if (verifiedIdentity) {
      return Identity.isEqual(identity, verifiedIdentity)
    }

    // console.log('not Equal', identity)

    const Provider = IdentityProviders.getIdentityProvider(identity.type)
    // console.log('Provider', Provider)

    const identityVerified = await Provider.verifyIdentity(identity)
    if (identityVerified) {
      // console.log('identity verified', signatures.id, identity)
      await this.verifiedIdentitiesCache.put(signatures.id, identity)
    }

    return identityVerified
  }

  async getIdentity(hash: string): Promise<IdentityInstance | null> {
    const bytes = await this.storage.get(hash)
    // console.log('get identity', bytes, hash)
    if (bytes) {
      return await Identity.decode(bytes, signFactory(this.keystore, hash))
    }

    return null
  }

  async sign(identity: IdentityInstance, data: string): Promise<string> {
    const privateKey = await this.keystore.getKey(identity.id)
    if (!privateKey) {
      throw new Error('Private key not found')
    }

    return signMessage(privateKey, data)
  }

  async verify(
    signature: string,
    publicKey: string,
    data: string,
  ): Promise<boolean> {
    return await verifyMessage(signature, publicKey, data)
  }
}

const signFactory = (keystore: KeyStoreInstance, id: string) => {
  return async (data: Uint8Array): Promise<string> => {
    const privateKey = await keystore.getKey(id)
    if (!privateKey) {
      throw new Error('Private key not found')
    }

    console.log('sign', data, privateKey)
    return signMessage(privateKey, data)
  }
}
