import { PublicKeyIdentityProvider } from './publickey.js'

import type { KeyStoreInstance } from '../../key-store.js'

export interface IdentityProviderGetIdOptions {
  id: string
}
export interface IdentityProviderOptions {
  keystore?: KeyStoreInstance
}
export interface IdentityProviderInstance {
  type: string
  getId: (options: IdentityProviderGetIdOptions) => Promise<string>
  signIdentity: (
    data: string,
    options: IdentityProviderGetIdOptions,
  ) => Promise<string>
}
export type IdentityProvider<
  T extends string,
  U extends IdentityProviderInstance,
> = {
  (options: IdentityProviderOptions): () => U
  verifyIdentity: (data: any) => Promise<boolean>
  type: T
}

export const identityProviders: Record<
  string,
  IdentityProvider<string, any>
> = {}

export const isProviderSupported = (type: string) => {
  return Object.keys(identityProviders).includes(type)
}

export const getIdentityProvider = (type: string) => {
  if (!isProviderSupported(type)) {
    throw new Error(`IdentityProvider type '${type}' is not supported`)
  }

  return identityProviders[type!]
}

export const useIdentityProvider = (
  identityProvider: IdentityProvider<string, any>,
) => {
  if (!identityProvider.type || typeof identityProvider.type !== 'string') {
    throw new Error("Given IdentityProvider doesn't have a field 'type'.")
  }

  if (!identityProvider.verifyIdentity) {
    throw new Error(
      "Given IdentityProvider doesn't have a function 'verifyIdentity'.",
    )
  }

  identityProviders[identityProvider.type] = identityProvider
}

useIdentityProvider(PublicKeyIdentityProvider)

export * from './publickey.js'
