/* eslint-disable no-unused-vars */
import { EventEmitter } from 'node:events'

import { PeerSet } from '@libp2p/peer-collections'
import { pipe } from 'it-pipe'
import PQueue from 'p-queue'
import { TimeoutController } from 'timeout-abort-controller'

import { SYNC_PROTOCOL, SYNC_TIMEOUT } from './constants'
import { join } from './utils'

import type { EntryInstance } from './oplog/entry.js'
import type { LogInstance } from './oplog/log'
import type { HeliaInstance, PeerId } from './vendor'
import type {
  EventHandler,
  Message,
  SignedMessage,
  StreamHandler,
  SubscriptionChangeData,
} from '@libp2p/interface'
import type { Sink, Source } from 'it-stream-types'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface SyncEvents<T> extends EventEmitter {
  on: ((
    event: 'join',
    listener: (peerId: string, heads: EntryInstance<T>[]) => void,
  ) => this) &
    ((event: 'leave', listener: (peerId: string) => void) => this) &
    ((event: 'error', listener: (error: Error) => void) => this)
}

export interface SyncOptions<T> {
  ipfs: HeliaInstance
  log: LogInstance<T>
  events?: SyncEvents<T>
  start?: boolean
  timestamp?: number
  timeout?: number

  onSynced?: (peerId: PeerId, heads: EntryInstance<T>[]) => Promise<void>
}

export interface SyncInstance<T> {
  events: SyncEvents<T>
  peers: PeerSet

  start: () => Promise<void>
  stop: () => Promise<void>
  add: (entry: EntryInstance<T>) => Promise<void>
}

export const Sync = async <T>({
  ipfs,
  log,
  onSynced,
  start = true,
  timeout = SYNC_TIMEOUT,
  events = new EventEmitter() as SyncEvents<T>,
}: SyncOptions<T>): Promise<SyncInstance<T>> => {
  if (!ipfs) {
    throw new Error('An instance of ipfs is required.')
  }
  if (!log) {
    throw new Error('An instance of log is required.')
  }

  const libp2p = ipfs.libp2p
  const pubsub = ipfs.libp2p.services.pubsub

  const address = log.id
  const headsSyncAddress = join(SYNC_PROTOCOL, address)

  const queue = new PQueue({ concurrency: 1 })
  const peers: PeerSet = new PeerSet()

  let started = false

  const onPeerJoined = async (peerId: PeerId) => {
    const heads = await log.heads()
    events.emit('join', peerId, heads)
  }

  const sendHeads = (): Source<Uint8Array> => {
    return (async function* () {
      const heads = await log.heads()
      for await (const { bytes } of heads) {
        yield bytes!
      }
    })()
  }

  const receiveHeads =
    (peerId: PeerId): Sink<AsyncIterable<Uint8ArrayList>, void> =>
    async (source) => {
      for await (const value of source) {
        const headBytes = value.subarray()
        if (headBytes && onSynced) {
          await onSynced(peerId, [headBytes as unknown as EntryInstance<T>])
        }
      }
      if (started) {
        await onPeerJoined(peerId)
      }
    }

  const handleReceiveHeads: StreamHandler = async ({ connection, stream }) => {
    const peerId = connection.remotePeer
    try {
      peers.add(peerId)
      await pipe(stream, receiveHeads(peerId), sendHeads, stream)
    } catch (error) {
      peers.delete(peerId)
      events.emit('error', error)
    }
  }

  const handlePeerSubscribed: EventHandler<
    CustomEvent<SubscriptionChangeData>
  > = async (event) => {
    const task = async () => {
      const { peerId: remotePeer, subscriptions } = event.detail
      const peerId = remotePeer
      const subscription = subscriptions.find((e: any) => e.topic === address)
      if (!subscription) {
        return
      }
      if (subscription.subscribe) {
        if (peers.has(peerId)) {
          return
        }
        const timeoutController = new TimeoutController(timeout)
        const { signal } = timeoutController
        try {
          peers.add(peerId)
          const stream = await libp2p.dialProtocol(
            remotePeer,
            headsSyncAddress,
            { signal },
          )
          await pipe(sendHeads, stream, receiveHeads(peerId))
        } catch (error: any) {
          console.error(error)
          peers.delete(peerId)
          if (error.code === 'ERR_UNSUPPORTED_PROTOCOL') {
            // Skip peer, they don't have this database currently
          } else {
            events.emit('error', error)
          }
        } finally {
          if (timeoutController) {
            timeoutController.clear()
          }
        }
      } else {
        peers.delete(peerId)
        events.emit('leave', peerId)
      }
    }
    queue.add(task)
  }

  const handleUpdateMessage: EventHandler<CustomEvent<Message>> = async (
    message,
  ) => {
    const { topic, data } = message.detail

    const task = async () => {
      try {
        const detail = message.detail as SignedMessage
        if (detail.from && data && onSynced) {
          await onSynced(detail.from as PeerId, [await Entry.decode(data)])
        }
      } catch (error) {
        console.error('error', error)
        events.emit('error', error)
      }
    }

    if (topic === address) {
      queue.add(task)
    }
  }

  // Start Sync automatically
  if (start !== false) {
    await (async () => {
      if (!started) {
        // Exchange head entries with peers when connected
        await libp2p.handle(headsSyncAddress, handleReceiveHeads)
        pubsub.addEventListener('subscription-change', handlePeerSubscribed)
        pubsub.addEventListener('message', handleUpdateMessage)

        // Subscribe to the pubsub channel for this database through which updates are sent
        await Promise.resolve(pubsub.subscribe(address))

        started = true
      }
    })()
  }

  const instance: SyncInstance<T> = {
    add: async (entry: EntryInstance<T>) => {
      if (started) {
        await pubsub.publish(address, entry.bytes!)
      }
    },
    stop: async () => {
      if (started) {
        started = false
        await queue.onIdle()
        pubsub.removeEventListener('subscription-change', handlePeerSubscribed)
        pubsub.removeEventListener('message', handleUpdateMessage)
        await libp2p.unhandle(headsSyncAddress)
        await Promise.resolve(pubsub.unsubscribe(address))
        peers.clear()
      }
    },
    start: async () => {
      if (!started) {
        // Exchange head entries with peers when connected
        await libp2p.handle(headsSyncAddress, handleReceiveHeads)
        pubsub.addEventListener('subscription-change', handlePeerSubscribed)
        pubsub.addEventListener('message', handleUpdateMessage)

        // Subscribe to the pubsub channel for this database through which updates are sent
        await Promise.resolve(pubsub.subscribe(address))

        started = true
      }
    },

    events,
    peers,
  }

  return instance
}
