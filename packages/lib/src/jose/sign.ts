import { Buffer } from 'node:buffer'

import { Secp256k1PrivateKey } from '@libp2p/crypto/keys'
import elliptic from 'elliptic'
import { SignJWT as JWT, base64url, importJWK, jwtVerify } from 'jose'

import type { PrivateKeys } from '@orbitdb/core'
import type { BN } from 'bn.js'
import type { JWK, JWTPayload, JWTVerifyGetKey, VerifyOptions } from 'jose'

const { ec: EC } = elliptic

const alg = 'ES256K'
const ec = new EC('secp256k1')

const options = {
  issuer: 'urn:example:issuer',
  audience: 'urn:example:audience',
}

export async function secp256k1ToJWK(keyPair: PrivateKeys): Promise<JWK> {
  if (!keyPair) {
    throw new Error('No key pair provided')
  }

  const keys = ec.keyFromPrivate(keyPair.marshal())

  const publicKey = keys.getPublic()
  const privateKey = keys.getPrivate()

  const kid = await keyPair.id()

  return {
    alg,
    kty: 'EC',
    crv: 'secp256k1',
    kid: kid || 'unknown',
    x: encode(publicKey.getX()),
    y: encode(publicKey.getY()),
    d: encode(privateKey),
  }
}

export function jwkToSecp256k1(jwk: JWK): Promise<PrivateKeys> {
  if (!jwk.d || !jwk.x || !jwk.y) {
    throw new Error('Invalid JWK')
  }

  const publicKey = ec.keyFromPublic({ x: jwk.x, y: jwk.y }, 'hex')
  const privateKey = ec.keyFromPrivate(base64url.decode(jwk.d), 'hex')

  const pub = decode(publicKey.getPublic('hex'))
  const priv = decode(privateKey.getPrivate('hex'))

  const keys = ec.keyPair({
    pubEnc: 'hex',
    privEnc: 'hex',
    pub,
    priv,
  })

  const keyPair = new Secp256k1PrivateKey(decode(keys.getPrivate('hex')))

  return Promise.resolve(keyPair)
}

export async function sign(jwk: JWK, payload: JWTPayload) {
  const signKey = await importJWK(jwk, alg)
  return new JWT(payload)
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setProtectedHeader({
      alg,
      typ: 'JWT',
      kid: jwk.kid,
      jti: crypto.randomUUID(),
    })
    .setExpirationTime('10m')
    .setIssuedAt(new Date())
    .sign(signKey)
}

export function verify(
  jwt: string,
  keyset: JWTVerifyGetKey,
  options?: VerifyOptions,
) {
  return jwtVerify(jwt, keyset, options)
}

function encode(data: typeof BN.prototype) {
  return base64url.encode(data.toArrayLike(Buffer, 'be', 32))
}

function decode(data: string) {
  return Buffer.from(data, 'hex')
}
