import { type GossipSub, gossipsub } from '@chainsafe/libp2p-gossipsub'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bitswap } from '@helia/block-brokers'
import { type Identify, identify } from '@libp2p/identify'
import { mdns } from '@libp2p/mdns'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { all } from '@libp2p/websockets/filters'
import { createLogger } from '@regioni/lib/logger'
import { LevelBlockstore } from 'blockstore-level'
import { createHelia } from 'helia'
import { type Libp2pOptions, createLibp2p } from 'libp2p'

import { createOrbitDB } from './index.js'

import type { ServiceMap } from '@libp2p/interface'

export type Options<T extends ServiceMap = ServiceMap> = Libp2pOptions<T>

const logger = createLogger({
  defaultMeta: {
    service: 'orbitdb',
    label: 'test',
  },
})

const directory = './orbitdb'
const options: Options<{
  identify: Identify
  pubsub: GossipSub
}> = {
  addresses: {
    listen: ['/ip4/127.0.0.1/tcp/0/ws'],
  },
  logger: {
    forComponent(name: string) {
      const l = (formatter: any, ...args: any) => {
        logger.info(formatter, { label: name, ...args })
      }

      l.enabled = true
      l.error = (formatter: any, ...args: any[]) => {
        logger.error(formatter, { label: name, ...args })
      }
      l.trace = (formatter: any, ...args: any[]) => {
        logger.debug(formatter, { label: name, ...args })
      }

      return l
    },
  },
  peerDiscovery: [mdns()],
  transports: [tcp(), webSockets({ filter: all })],
  streamMuxers: [yamux()],

  services: {
    identify: identify(),
    pubsub: gossipsub({
      allowPublishToZeroTopicPeers: true,
    }),
  },
}

const main = async () => {
  const ipfs = await createHelia<Options>({
    libp2p: await createLibp2p({ ...options }),
    blockstore: new LevelBlockstore(`${directory}/ipfs/blocks`),
    blockBrokers: [bitswap()],
  })
  const orbit = await createOrbitDB({
    id: 'test',
    directory: './orbitdb',
    ipfs,
  })

  const db = await orbit.open<{ test: string }, 'documents'>('test')

  db.events.on('update', (entry) => {
    console.log(entry)
  })

  db.put({ test: 'test' })

  const result = await db.get('test')
  console.log(result)
}

main()
