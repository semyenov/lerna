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
import type { StorageInstance } from '../storage'
import type { OrbitDBInstance } from 'packages/orbitdb/index.js'

export interface CreateAccessControllerOptions {
  write?: string[]
  storage?: StorageInstance<Uint8Array>
}

interface AccessControllerOptions {
  orbitdb: OrbitDBInstance
  identities: IdentitiesInstance
  address?: string
  name?: string
}

interface AccessControllerInstance {
  canAppend: (entry: EntryInstance) => Promise<boolean>
  close?: () => Promise<void>
  drop?: () => Promise<void>
}

type AccessController<T extends string, U extends AccessControllerInstance> = {
  type: T
  (
    options: CreateAccessControllerOptions,
  ): (options: AccessControllerOptions) => Promise<U>
}

const accessControllers: Record<
  string,
  ReturnType<AccessController<string, AccessControllerInstance>>
> = {}

const getAccessController = <T extends keyof typeof accessControllers>(
  type: T,
): AccessController<any, any> => {
  if (!accessControllers[type!]) {
    throw new Error(`AccessController type '${type}' is not supported`)
  }

  return accessControllers[type!]
}

const useAccessController = (accessController: AccessController<any, any>) => {
  if (!accessController.type) {
    throw new Error("AccessController does not contain required field 'type'.")
  }

  accessControllers[accessController.type] = accessController
}

useAccessController(IPFSAccessController)
useAccessController(OrbitDBAccessController)

export type {
  AccessController,
  AccessControllerOptions,
  AccessControllerInstance,
  IPFSAccessControllerInstance,
  OrbitDBAccessControllerInstance,
}
export {
  getAccessController,
  useAccessController,
  IPFSAccessController,
  OrbitDBAccessController,
}
