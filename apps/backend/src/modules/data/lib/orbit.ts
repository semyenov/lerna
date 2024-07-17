import { createLogger } from '@regioni/lib/logger'

import type {
  AccessController,
  AccessControllerInstance,
  AccessControllerOptions,
  Entry,
} from '@orbitdb/core'

const logger = createLogger({
  defaultMeta: {
    service: 'orbitdb',
    label: 'access-controller',
  },
})

const CUSTOM_ACCESS_CONTROLLER_TYPE = 'custom' as const

type op = 'put' | 'del' | '*';

// Define a type for the ACL structure
type ACL = Record<string, op[]>;

// Define a type for the database
type ACLDatabase = {
  get: (key: string) => Promise<ACL | null>;
  put: (key: string, value: ACL) => Promise<string>;
};


export const CustomAccessController = (): ((
  options: AccessControllerOptions,
) => AccessController<'custom', AccessControllerInstance>) => {
  return ({ orbitdb, address, identities }) => {
    const accessController = async () => {
      const db: ACLDatabase = await orbitdb.open<ACL, 'keyvalue'>('acl', { type: 'keyvalue' });

      async function canAppend({
        identity,
        payload,
      }: Entry.Instance): Promise<boolean> {
        logger.info(`Checking if user ${identity} can append to ${payload.key}`)

        const writerIdentity = await identities.getIdentity(identity)
        if (!writerIdentity) {
          return false
        }

        const { id } = writerIdentity

        const hasWriteAccess =
          (await hasCapability(id, payload.key, payload.op as op)) ||
          (await hasCapability(id, payload.key, '*'))

        if (hasWriteAccess) {
          return identities.verifyIdentity(writerIdentity)
        }

        return false
      }

      async function grant(id: string, key: string, ops: op[]): Promise<void> {
        logger.info(`Granting ${key} ops ${ops} to user ${id} for ${address}`);

        const acl = await db.get(id + address) || { [key]: [] };
        const updatedOps = ops.includes('*') ? ['*'] as op[] : [...new Set([...(acl[key] || []), ...ops])] as op[];

        await db.put(id + address, {
          ...acl,
          [key]: updatedOps,
        });
      }

      async function revoke(id: string, key: string, ops: op[]): Promise<void> {
        logger.info(`Revoking ${key} ops ${ops} from user ${id} for ${address}`);

        const acl = await db.get(id + address);
        if (!acl || !(key in acl)) {
          return;
        }

        const currentOps = acl[key] || [];
        const updatedOps = ops.includes('*')
          ? [] as op[]
          : currentOps.includes('*')
            ? (['put', 'del'] as op[]).filter(op => !ops.includes(op)) as op[]
            : currentOps.filter(op => !ops.includes(op));

        await db.put(id + address, {
          ...acl,
          [key]: updatedOps,
        });
      }

      const hasCapability = async (id: string, key: string, op: op) => {
        logger.info(`Checking op ${op} for identity ${id} for ${key}`)

        const acl = await db.get(id + address)
        if (!acl) {
          return false
        }

        const c = acl[key!]
        if (!c) {
          return false
        }

        if (c.includes('*')) {
          return true
        }

        return c.includes(op)
      }

      return {
        canAppend,

        grant,
        revoke,
      }
    }

    accessController.type = CUSTOM_ACCESS_CONTROLLER_TYPE

    return accessController
  }
}
