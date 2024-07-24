import {
  IPFSAccessController,
  type IPFSAccessControllerInstance,
} from './ipfs.js'
import {
  OrbitDBAccessController,
  type OrbitDBAccessControllerInstance,
} from './orbitdb.js'

import type { IdentitiesInstance } from '../identities/identities.js'
import type { EntryInstance } from '../oplog/entry'
import type { OrbitDBInstance } from '../orbitdb.js'
import type { StorageInstance } from '../storage'

export interface CreateAccessControllerOptions {
  write?: string[]
  storage?: StorageInstance<Uint8Array>
}

export interface AccessControllerOptions {
  orbitdb: OrbitDBInstance
  identities: IdentitiesInstance
  address?: string
  name?: string
}

export interface AccessControllerInstance {
  type: string
  write: string[]
  address?: string

  canAppend: (entry: EntryInstance) => Promise<boolean>
  close?: () => Promise<void>
  drop?: () => Promise<void>
}

export type AccessControllerType<
  T extends string,
  U extends AccessControllerInstance,
> = {
  type: T
  (
    options: CreateAccessControllerOptions,
  ): (options: AccessControllerOptions) => Promise<U>
}

export type AccessControllerTypeMap = {
  ipfs: IPFSAccessControllerInstance
  orbitdb: OrbitDBAccessControllerInstance
}

const accessControllers: Record<
  string,
  AccessControllerType<
    keyof AccessControllerTypeMap,
    AccessControllerTypeMap[keyof AccessControllerTypeMap]
  >
> = {}

export const getAccessController = <D extends keyof AccessControllerTypeMap>(
  type: D,
) => {
  if (!accessControllers[type!]) {
    throw new Error(`AccessController type '${type}' is not supported`)
  }

  return accessControllers[type!]
}

export const useAccessController = <D extends keyof AccessControllerTypeMap>(
  accessController: AccessControllerType<D, AccessControllerTypeMap[D]>,
) => {
  if (!accessController.type) {
    throw new Error("AccessController does not contain required field 'type'.")
  }

  accessControllers[accessController.type] = accessController
}

useAccessController(IPFSAccessController)
useAccessController(OrbitDBAccessController)

export type { IPFSAccessControllerInstance, OrbitDBAccessControllerInstance }
export { IPFSAccessController, OrbitDBAccessController }
