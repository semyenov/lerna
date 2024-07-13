import { Type } from '@sinclair/typebox'

export const PostItemInputSchema = Type.Object({
  id: Type.String(),
  path: Type.String(),
  data: Type.Unknown(),
})

export const GetItemInputSchema = Type.Object({
  id: Type.String(),
})
