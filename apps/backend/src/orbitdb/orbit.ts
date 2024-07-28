import { OrbitDB, type OrbitDBOptions } from '@apps/orbit'
import { bitswap } from '@helia/block-brokers'
import { createLogger } from '@regioni/lib/logger'
import { LevelBlockstore } from 'blockstore-level'
import { createHelia } from 'helia'
import { createLibp2p, type Libp2pOptions } from 'libp2p'

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

  return OrbitDB.create({
    id,
    identity,
    identities,
    directory,
    ipfs: ipfs as any,
  })
}

export async function stopOrbitDB(orbitdb: OrbitDB): Promise<void> {
  await orbitdb.stop()
  await orbitdb.ipfs.stop()
}

const orbitdb = await startOrbitDB({
  id: 'test',
  directory: '.',
})

const db = await orbitdb.open<{ __id: string; test: string }, 'documents'>({
  type: 'documents',
  address: 'test',
})

db.events.addEventListener('update', (event) => {
  console.log(event.detail)
})

db.put({ __id: '1', test: 'test' })

const result = await db.get('1')
console.log(result)

await stopOrbitDB(orbitdb)
