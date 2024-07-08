import type { IdentityInstance } from '@orbitdb/core'

declare module 'ws' {
  export interface WebSocketServer {
    identity?: IdentityInstance
  }
  export interface WebSocket {
    identity?: IdentityInstance
  }
}

declare global {
  export interface WebSocket {
    identity?: IdentityInstance
  }
}
