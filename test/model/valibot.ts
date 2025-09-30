import { ModelToValibot } from '@sinclair/typebox-codegen'
import * as Types from '@sinclair/typebox'
import { Assert } from '../assert'
import { test } from 'node:test'

test('ModelToValibot:String', () => {
  const code = ModelToValibot.Generate({
    types: [Types.String({ $id: 'Test' })],
  })
  const expect =
`import * as v from 'valibot'

export type Test = v.InferOutput<typeof Test>
export const Test = v.string()
`
  Assert.IsEqual(code, expect)
})

test('ModelToValibot:Transform String to Number', () => {
  const TestSchema = Types.Transform(Types.Number({ minimum: 1, maximum: 50, $id: 'Test' }))
    .Decode((value) => String(value))
    .Encode((value) => Number(value))
  const code = ModelToValibot.Generate({
    types: [TestSchema],
  })
  const expect =
`import * as v from 'valibot'

export type Test = v.InferOutput<typeof Test>
export const Test = v.pipe(
  v.string(),
  v.transform((value) => Number(value)),
  v.number(),
  v.minValue(1),
  v.maxValue(50)
)
`
  Assert.IsEqual(code, expect)
})

test('ModelToValibot:Transform String to Boolean', () => {
  const TestSchema = Types.Transform(Types.Boolean({$id: 'Test' }))
    .Decode((value) => String(value))
    .Encode((value) => value === 'true')
  const code = ModelToValibot.Generate({
    types: [TestSchema],
  })
  const expect =
`import * as v from 'valibot'

export type Test = v.InferOutput<typeof Test>
export const Test = v.pipe(
  v.string(),
  v.transform((value) => value === 'true'),
  v.boolean()
)
`
  Assert.IsEqual(code, expect)
})

test('ModelToValibot:Transform Object to Array', () => {
  const TestSchema = Types.Transform(Types.Array(Types.String(), { $id: 'Test' }))
    .Decode((v) => {
      if (!Array.isArray(v)) {
        return {}
      }
      return v.reduce((object, key) => {
        object[key] = true
        return object
      }, {} as Record<string, boolean>)
    })
    .Encode((v) => Object.keys(v))

  const code = ModelToValibot.Generate({
    types: [TestSchema],
  })
  const expect =
`import * as v from 'valibot'

export type Test = v.InferOutput<typeof Test>
export const Test = v.pipe(
  v.object({}),
  v.transform((v) => Object.keys(v)),
  v.array(v.string())
)
`
  Assert.IsEqual(code, expect)
})

test('ModelToValibot:Transform Object', () => {
  const PageSchema = Types.Transform(Types.Number({ minimum: 1, $id: 'Page' }))
    .Decode((v) => String(v))
    .Encode((v) => Number(v))
  const TestSchema = Types.Object(
    {
      Page: PageSchema,
      OptionalPage: Types.Optional(PageSchema),
    },
    {
      $id: 'Test',
    },
  )

  const code = ModelToValibot.Generate({
    types: [TestSchema],
  })
  const expect =
`import * as v from 'valibot'

export type Test = v.InferOutput<typeof Test>
export const Test = v.object({
  Page: v.pipe(
    v.string(),
    v.transform((v) => Number(v)),
    v.number(),
    v.minValue(1)
  ),
  OptionalPage: v.optional(
    v.pipe(
      v.string(),
      v.transform((v) => Number(v)),
      v.number(),
      v.minValue(1)
    )
  )
})
`
  Assert.IsEqual(code, expect)
})

