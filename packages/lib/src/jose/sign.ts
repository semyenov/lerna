import { Buffer } from 'node:buffer'

import Elliptic from 'elliptic'
import { SignJWT, base64url, importJWK, jwtVerify } from 'jose'

import type { KeyPair } from './types'
import type { PrivateKeys } from '@orbitdb/core'
import type { JWK, JWTPayload, JWTVerifyGetKey, VerifyOptions } from 'jose'

const EC = Elliptic.ec

const alg = 'ES256K'

const options = {
  issuer: 'urn:example:issuer',
  audience: 'urn:example:audience',
}

export async function sign(
  keyPair: KeyPair,
  payload: JWTPayload,
) {
  const { privateKey } = keyPair
  const { kid } = privateKey

  const signKey = await importJWK(privateKey)

  return new SignJWT(payload)
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setProtectedHeader({ alg, kid })
    .setExpirationTime('10m')
    .setIssuedAt()
    .sign(signKey)
}

export async function verify(
  jwt: string,
  keySet: JWTVerifyGetKey,
  verifyOptions?: VerifyOptions,
) {
  const { payload } = await jwtVerify(
    jwt,
    keySet,
    verifyOptions,
  )

  return payload
}

export async function secp256k1ToJoseJWK(keyPair: PrivateKeys): Promise<JWK> {
  if (!keyPair) {
    throw new Error('No key pair provided')
  }

  const ec = new EC('secp256k1')

  const publicKey = ec.keyFromPublic(keyPair.public.marshal())
  const privateKey = ec.keyFromPrivate(keyPair.marshal())

  const arrayLikeOptions = [Buffer, 'be', 32] as const
  const x = base64url.encode(
    publicKey.getPublic().getX()
      .toArrayLike(...arrayLikeOptions),
  )
  const y = base64url.encode(
    publicKey.getPublic().getY()
      .toArrayLike(...arrayLikeOptions),
  )
  const d = base64url.encode(
    privateKey.getPrivate().toArrayLike(...arrayLikeOptions),
  )

  const test: JWK = {
    kty: 'EC',
    crv: 'secp256k1',
    x,
    y,
  }

  return {
    publicKey: test,
    privateKey: test.d = d,
  }
}
