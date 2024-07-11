import type { IJoseVerify } from '../jose/types'

declare module 'ws' {
  export interface WebSocketServer {
    jose?: IJoseVerify
  }
  export interface WebSocket {
    jose?: IJoseVerify
  }
}

declare global {
  export interface WebSocket {
    jose?: IJoseVerify
  }
}
