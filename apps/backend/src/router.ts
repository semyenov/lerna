import { dataRouter } from './modules/data/router'
import { rootRouter } from './trpc'

// merge routers together
export const router = rootRouter({
  data: dataRouter,
})

export type Router = typeof router
