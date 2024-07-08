interface OrbitDBAddress {
  protocol: string
  hash: string
  address: string
  toString: () => string
}

export type { OrbitDBAddress }

export function isValidAddress(address: OrbitDBAddress | string): boolean
export function parseAddress(address: OrbitDBAddress | string): OrbitDBAddress
