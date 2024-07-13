import { Buffer } from 'node:buffer'

import { Secp256k1PrivateKey } from '@libp2p/crypto/keys'
import elliptic from 'elliptic'
import { SignJWT, base64url, importJWK, jwtVerify } from 'jose'

import type { PrivateKeys } from '@orbitdb/core'
import type { JWK, JWTPayload, JWTVerifyGetKey, VerifyOptions } from 'jose'

const { ec: EC } = elliptic

const alg = 'ES256K'
const ec = new EC('secp256k1')

const options = {
  issuer: 'urn:example:issuer',
  audience: 'urn:example:audience',
  defaults: {
    alg,
    kty: 'EC',
    crv: 'secp256k1',
    kid: 'unknown',
    iat: true,
    nbf: true,
    jti: true,
  },
}

export async function secp256k1ToJWK(keyPair: PrivateKeys): Promise<JWK> {
  if (!keyPair) {
    throw new Error('No key pair provided')
  }

  const keys = ec.keyFromPrivate(keyPair.marshal())

  const privateKey = keys.getPrivate()
  const publicKey = keys.getPublic()

  const kid = await keyPair.id()
  const x = base64url.encode(publicKey.getX().toString('hex'))
  const y = base64url.encode(publicKey.getY().toString('hex'))
  const d = base64url.encode(privateKey.toString('hex'))

  return {
    ...options.defaults,
    kid,
    x,
    y,
    d,
  }
}

export function jwkToSecp256k1(jwk: JWK): Promise<PrivateKeys> {
  if (!jwk.d || !jwk.x || !jwk.y) {
    throw new Error('Invalid JWK')
  }

  const priv = ec.keyFromPrivate(jwk.d, 'hex')
  const pub = ec.keyFromPublic({
    x: jwk.x,
    y: jwk.y,
  })

  const keys = ec.keyPair({
    privEnc: 'hex',
    priv: Buffer.from(priv.getPrivate('hex'), 'hex'),

    pubEnc: 'hex',
    pub: Buffer.from(pub.getPublic('hex'), 'hex'),
  })

  const keyPair = new Secp256k1PrivateKey(
    Buffer.from(keys.getPrivate('hex'), 'hex'),
  )

  return Promise.resolve(keyPair)
}

export async function sign(jwk: JWK, payload: JWTPayload) {
  const signKey = await importJWK(jwk)

  return new SignJWT(payload)
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setProtectedHeader({
      alg,
      kid: jwk.kid,
      nbf: new Date(),
      jti: crypto.randomUUID(),
      iat: new Date(),
    })
    .setExpirationTime('10m')
    .setIssuedAt(new Date())
    .sign(signKey)
}

export async function verify(
  jwt: string,
  keyset: JWTVerifyGetKey,
  options?: VerifyOptions,
) {
  const { payload, key, protectedHeader } = await jwtVerify(
    jwt,
    keyset,
    options,
  )

  return { payload, key, protectedHeader }
}
