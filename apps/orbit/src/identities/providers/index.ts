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
  (options: IdentityProviderOptions): U
  verifyIdentity: (data: any) => Promise<boolean>
  type: T
}

const identityProviders: Record<string, IdentityProvider<string, any>> = {}

const isProviderSupported = (type: string) => {
  return Object.keys(identityProviders).includes(type)
}

const getIdentityProvider = (type: string) => {
  if (!isProviderSupported(type)) {
    throw new Error(`IdentityProvider type '${type}' is not supported`)
  }

  return identityProviders[type!]
}

/**
 * Adds an identity provider.
 * @param {IdentityProvider} identityProvider The identity provider to add.
 * @throws Given IdentityProvider doesn\'t have a field \'type\'.
 * @throws Given IdentityProvider doesn\'t have a function \'verifyIdentity\'.
 * @throws IdentityProvider ${IdentityProvider.type} already added.
 * @static
 * @memberof module:Identities
 */
const useIdentityProvider = (
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

export { useIdentityProvider, getIdentityProvider, PublicKeyIdentityProvider }
