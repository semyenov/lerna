import { WebSocket as WebSocketNode } from 'ws'

import { wrapSocket } from './wrapper'

// import type { IJoseVerify } from '../jose/types'
import type { IdentityInstance } from '@orbitdb/core'
import type { ClientOptions } from 'ws'

export class WebSocketProxy extends WebSocketNode {
  public identity?: IdentityInstance
  public constructor(
    address: string | URL,
    protocols?: string | string[],
    options?: ClientOptions,
    identity?: IdentityInstance,
  ) {
    super(address, protocols, options)

    return wrapSocket(this, identity)
  }
}
