import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

import { signMessage, verifyMessage } from '../../key-store.js'

import type { IdentityInstance } from '../identity.js'
import type { IdentityProvider, IdentityProviderInstance } from '../providers'

const type = 'publickey'

const verifyIdentity = async (identity: IdentityInstance) => {
  const { id, publicKey, signatures } = identity
  return verifyMessage(signatures.publicKey, id, publicKey + signatures.id)
}

const PublicKeyIdentityProvider: IdentityProvider<
  'publickey',
  IdentityProviderInstance
> =
  ({ keystore }) =>
  () => {
    if (!keystore) {
      throw new Error('PublicKeyIdentityProvider requires a keystore parameter')
    }

    const identityProvider: IdentityProviderInstance = {
      type,
      getId: async ({ id }) => {
        if (!id) {
          throw new Error('id is required')
        }

        const key =
          (await keystore.getKey(id)) || (await keystore.createKey(id))
        return uint8ArrayToString(key.public.marshal(), 'base16')
      },
      signIdentity: async (data, { id }) => {
        if (!id) {
          throw new Error('id is required')
        }

        const key = await keystore.getKey(id)
        if (!key) {
          throw new Error(`Signing key for '${id}' not found`)
        }

        return signMessage(key, data)
      },
    }

    return identityProvider
  }

PublicKeyIdentityProvider.verifyIdentity = verifyIdentity
PublicKeyIdentityProvider.type = type

export { PublicKeyIdentityProvider }
