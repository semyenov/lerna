import type * as jose from 'jose'
import type { JWTVerifyGetKey } from 'jose'

export type KeyPair = jose.GenerateKeyPairResult<
  jose.KeyLike & jose.JWK
>


export interface IJoseVerify {
  key: KeyPair
  jwks: JWTVerifyGetKey
}
