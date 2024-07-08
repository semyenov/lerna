import type { keys as CryptoKeys } from '@libp2p/crypto'
import type { PrivateKey } from '@libp2p/interface'
import type { HeliaLibp2p } from 'helia'
import type { Libp2p } from 'libp2p'

export type PrivateKeys = PrivateKey<CryptoKeys.KeyTypes>
export type Secp256k1PrivateKey = CryptoKeys.Secp256k1PrivateKey
export type IPFS = HeliaLibp2p<Libp2p<Record<string, unknown>>>

export type { PeerId } from '@libp2p/interface'
