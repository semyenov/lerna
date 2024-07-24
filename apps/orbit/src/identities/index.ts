export type { IdentitiesInstance, IdentitiesOptions } from './identities.js'
export { Identities } from './identities.js'

export type { IdentityInstance, IdentityOptions } from './identity.js'
export { Identity, isIdentity, isEqual } from './identity.js'

export {
  useIdentityProvider,
  getIdentityProvider,
  PublicKeyIdentityProvider,
} from './providers/index.js'
