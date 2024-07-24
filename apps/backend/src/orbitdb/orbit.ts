import {
  type OrbitDBInstance,
  type OrbitDBOptions,
  createOrbitDB,
} from '@apps/orbit'
import { bitswap } from '@helia/block-brokers'
import { createLogger } from '@regioni/lib/logger'
import { LevelBlockstore } from 'blockstore-level'
import { createHelia } from 'helia'
import { type Libp2pOptions, createLibp2p } from 'libp2p'

import { DefaultLibp2pBrowserOptions, DefaultLibp2pOptions } from './config'

import type { ServiceMap } from '@libp2p/interface'

export type Options<T extends ServiceMap = ServiceMap> = Libp2pOptions<T>

const isBrowser = () => typeof window !== 'undefined'
const logger = createLogger({
  defaultMeta: {
    service: 'orbit',
    label: 'orbit',
  },
})

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
