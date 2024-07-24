import {
  type OrbitDBInstance,
  type OrbitDBOptions,
  createOrbitDB,
} from '@apps/orbit'
import { bitswap } from '@helia/block-brokers'
import { createLogger } from '@regioni/lib/logger'
import { LevelBlockstore } from 'blockstore-level'
import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { type GossipSub, gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import {
  circuitRelayServer,
  circuitRelayTransport,
} from '@libp2p/circuit-relay-v2'
import { type Identify, identify } from '@libp2p/identify'
import { mdns } from '@libp2p/mdns'
import { tcp } from '@libp2p/tcp'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { all } from '@libp2p/websockets/filters'
import { createLogger } from '@regioni/lib/logger'
import { DefaultLibp2pBrowserOptions, DefaultLibp2pOptions } from './config'
import type { ServiceMap } from '@libp2p/interface'
import type { Libp2pOptions } from 'libp2p'

export type Options<T extends ServiceMap = ServiceMap> = Libp2pOptions<T>
const logger = createLogger()

let spied: any

const isBrowser = () => typeof window !== 'undefined'
export async function startOrbitDB({
  id,
  identity,
  identities,
  directory = '.',
}: Omit<OrbitDBOptions, 'ipfs'>) {
  const options = isBrowser()
    ? DefaultLibp2pBrowserOptions
    : DefaultLibp2pOptions

  const ipfs = await createHelia({
    libp2p: await createLibp2p({ ...options }),
    blockstore: new LevelBlockstore(`${directory}/ipfs/blocks`),
    blockBrokers: [bitswap()],
  })

  return createOrbitDB({
    id,
    identity,
    identities,
    directory,
    ipfs: ipfs as any,
  })
}

export async function stopOrbitDB(orbitdb: OrbitDBInstance): Promise<void> {
  await orbitdb.stop()
  await orbitdb.ipfs.stop()

  logger.debug('orbitdb stopped', spied.calls, spied.returns)
}

const orbitdb = await startOrbitDB({
  id: 'test',
  directory: '.',
})

const db = await orbitdb.open<{ test: string }, 'documents'>('test')

db.events.on('update', (entry) => {
  console.log(entry)
})

db.put({ test: 'test' })

const result = await db.get('test')
console.log(result)

await stopOrbitDB(orbitdb)
