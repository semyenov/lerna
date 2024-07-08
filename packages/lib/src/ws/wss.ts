import consola from 'consola'
import { WebSocketServer } from 'ws'

import { wrapSocket } from './wrapper'

import type { IdentityInstance } from '@orbitdb/core'
import type { ServerOptions, WebSocket } from 'ws'

const logger = consola.withTag('wss')

export class WebSocketServerProxy extends WebSocketServer {
  identity?: IdentityInstance
  public constructor(options?: ServerOptions, identity?: IdentityInstance, callback?: () => void) {
    super(options, callback)
    this.identity = identity
    logger.info('new WebSocketServer', identity)

    return wrapSocketServer(this)
  }
}

export function wrapSocketServer(wss: WebSocketServer) {
  return new Proxy(wss, {
    get: (target, prop, receiver) => {
      if (prop === 'on') {
        return customOn.bind(target)
      }

      return Reflect.get(target, prop, receiver)
    },
  })
}

async function customOn(
  this: WebSocketServer,
  event: string,
  listener: (...args: any[]) => void,
) {
  this.on(event, async (...args: any[]) => {
    if (event === 'connection') {
      logger.info('Connection')
      args[0] = wrapSocket(args[0] as WebSocket, this.identity)
    }

    listener.call(this, ...args)
  })
}
