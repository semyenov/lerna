// import * as a from '@regioni/lib/automerge'
// import { observable } from '@trpc/server/observable'
// import consola from 'consola'
// import { z } from 'zod'

// import { publicProcedure, rootRouter } from '../trpc'

// import type { LoroEvent } from 'loro-crdt'

// const logger = consola.withTag('server')

// export const docsRouter = rootRouter({
//   getKeys: publicProcedure
//     .query(async () => a.getKeys()),

//   getItem: publicProcedure
//     .input(z.undefined())
//     .query(async () => a.getItem()),

//   putItem: publicProcedure
//     .input(z.object({
//       id: z.string(),
//       doc: z.object({
//         name: z.string(),
//         ideas: z.array(z.string()),
//       }),
//     }))
//     .mutation(async ({ input: { id, doc } }) => {
//       a.putItem(id, doc)

//       return a.getItem()
//     }),

//   deleteItem: publicProcedure
//     .input(z.string())
//     .mutation(async ({ input: id }) => {
//       a.deleteItem(id)

//       return true
//     }),

//   onChange: publicProcedure
//     .subscription(async () => observable<LoroEvent>((emit) => {
//       a.onChange((change) => {
//         logger.success('onChange', change)
//         emit.next(change)
//       })
//     })),
// })

// export type DataRouter = typeof docsRouter
