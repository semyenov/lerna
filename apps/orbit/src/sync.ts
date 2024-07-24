import { EventEmitter } from 'events'

import { pipe } from 'it-pipe'
import PQueue from 'p-queue'
import { TimeoutController } from 'timeout-abort-controller'

import { join } from './utils'

import type { EntryInstance } from './oplog/entry.js'
import type { LogInstance } from './oplog/log'
import type { HeliaInstance, PeerId } from './vendor'
import type { Sink } from 'it-stream-types'
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
  peers: Set<PeerId>

  start: () => Promise<void>
  stop: () => Promise<void>
  add: (entry: EntryInstance<T>) => Promise<void>
}

const DEFAULT_TIMEOUT = 30000 // 30 seconds

export const Sync = async <T>({
  ipfs,
  log,
  events = new EventEmitter() as SyncEvents<T>,
  onSynced,
  start,
  timeout = DEFAULT_TIMEOUT,
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
  const headsSyncAddress = join('/orbitdb/heads/', address)

  const queue = new PQueue({ concurrency: 1 })

  const peers: Set<PeerId> = new Set()

  let started = false

  const onPeerJoined = async (peerId: PeerId) => {
    const heads = await log.heads()
    events.emit('join', peerId, heads)
  }

  const sendHeads = (): AsyncIterable<Uint8Array> => {
    return (async function* () {
      const heads = await log.heads()
      for await (const { bytes } of heads) {
        yield bytes!
      }
    })()
  }

  const receiveHeads =
    (peerId: PeerId): Sink<AsyncIterable<Uint8ArrayList>, void> =>
    async (source: AsyncIterable<Uint8ArrayList>) => {
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

  const handleReceiveHeads = async ({
    connection,
    stream,
  }: {
    connection: any
    stream: any
  }) => {
    const peerId = String(connection.remotePeer)
    try {
      peers.add(peerId as unknown as PeerId)
      await pipe(
        stream,
        receiveHeads(peerId as unknown as PeerId),
        sendHeads,
        stream,
      )
    } catch (error) {
      peers.delete(peerId as unknown as PeerId)
      events.emit('error', error)
    }
  }

  const handlePeerSubscribed = async (event: any) => {
    const task = async () => {
      const { peerId: remotePeer, subscriptions } = event.detail
      const peerId = String(remotePeer)
      const subscription = subscriptions.find((e: any) => e.topic === address)
      if (!subscription) {
        return
      }
      if (subscription.subscribe) {
        if (peers.has(peerId as unknown as PeerId)) {
          return
        }
        const timeoutController = new TimeoutController(timeout)
        const { signal } = timeoutController
        try {
          peers.add(peerId as unknown as PeerId)
          const stream = await libp2p.dialProtocol(
            remotePeer,
            headsSyncAddress,
            { signal },
          )
          await pipe(
            sendHeads,
            stream,
            receiveHeads(peerId as unknown as PeerId),
          )
        } catch (error: any) {
          console.error(error)
          peers.delete(peerId as unknown as PeerId)
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
        peers.delete(peerId as unknown as PeerId)
        events.emit('leave', peerId as unknown as PeerId)
      }
    }
    queue.add(task)
  }

  const handleUpdateMessage = async (message: any) => {
    const { topic, data } = message.detail

    const task = async () => {
      try {
        if (data && onSynced) {
          await onSynced(message.detail.from as PeerId, [
            data as unknown as EntryInstance<T>,
          ])
        }
      } catch (error) {
        events.emit('error', error)
      }
    }

    if (topic === address) {
      queue.add(task)
    }
  }

  const add = async (entry: EntryInstance<T>) => {
    if (started) {
      await pubsub.publish(address, entry.bytes!)
    }
  }

  const stopSync = async () => {
    if (started) {
      started = false
      await queue.onIdle()
      pubsub.removeEventListener('subscription-change', handlePeerSubscribed)
      pubsub.removeEventListener('message', handleUpdateMessage)
      await libp2p.unhandle(headsSyncAddress)
      await pubsub.unsubscribe(address)
      peers.clear()
    }
  }

  /**
   * Start the Sync Protocol.
   * @function start
   * @memberof module:Sync~Sync
   * @instance
   */
  const startSync = async () => {
    if (!started) {
      // Exchange head entries with peers when connected
      await libp2p.handle(headsSyncAddress, handleReceiveHeads)
      pubsub.addEventListener('subscription-change', handlePeerSubscribed)
      pubsub.addEventListener('message', handleUpdateMessage)
      // Subscribe to the pubsub channel for this database through which updates are sent
      await pubsub.subscribe(address)
      started = true
    }
  }

  // Start Sync automatically
  if (start !== false) {
    await startSync()
  }

  return {
    add,
    stop: stopSync,
    start: startSync,
    events,
    peers,
  }
}
