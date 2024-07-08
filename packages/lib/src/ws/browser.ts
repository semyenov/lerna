import consola from 'consola'

import type { IdentityInstance } from '@orbitdb/core'

export * from './types'

const logger = consola.withTag('ws/browser')
export class WebSocketBrowserProxy extends WebSocket {
  identity?: IdentityInstance
  public constructor(
    address: string | URL,
    protocols?: string | string[],
    identity?: IdentityInstance,
  ) {
    super(address, protocols)
    this.identity = identity

    return wrapSocket(this)
  }
}

export function wrapSocket(ws: WebSocketBrowserProxy) {
  return new Proxy(ws, {
    get: (target, prop) => {
      logger.debug('Getting', prop, target)
      switch (prop) {
        case 'addEventListener':
          return customOn.bind(target)
        case 'send':
          return customSend.bind(target)
      }

      return Reflect.get(target, prop)
    },
  })
}

type BufferLike = string | ArrayBufferView | ArrayBufferLike | Blob

async function customOn(
  this: WebSocketBrowserProxy,
  event: string,
  listener: (...args: any[]) => void,
) {
  this.addEventListener(event, customListener)

  async function customListener(this: WebSocketBrowserProxy, ...args: any[]) {
    if (event === 'message') {
      const [event] = args as [MessageEvent<string>]
      const data = event.data

      if (!this.identity) {
        logger.debug('Receiving: jose not initialized', data)

        return listener.call(this, event)
      }
      try {
        // const { payload, ..._jws } = await verify(data.toString(), this.identity.jwks)

        // const newEvent = createMessageEvent(event, payload)

        // logger.debug('Receiving payload"', { payload, event: newEvent })

        return listener.call(this, ...args)
      }
      catch (error) {
        const newEvent = createMessageEvent(event, {})

        return listener.call(this, newEvent)
      }
    }

    logger.debug('Receiving', event, args)

    return listener.call(this, ...args)
  }
}

function createMessageEvent(event: MessageEvent, payload: unknown) {
  return new MessageEvent('message', {
    data: JSON.stringify(payload),
    origin: event.origin,
    source: event.source,
    lastEventId: event.lastEventId,
    ports: [...event.ports],
  })
}

async function customSend(this: WebSocketBrowserProxy, data: BufferLike) {
  if (!this.identity) {
    logger.debug('Sending: jose not initialized', data)
    this.send(data)

    return
  }

  logger.debug('Signing payload: ', { payload: data, jose: this.identity })

  // const jws = await sign(this.identity.key, {
  //   payload: JSON.parse(data.toString()),
  // })

  // logger.debug('Sending', jws)

  this.send(data)
}
