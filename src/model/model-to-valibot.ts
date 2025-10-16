/*--------------------------------------------------------------------------

@sinclair/typebox-codegen

The MIT License (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

---------------------------------------------------------------------------*/

import { Formatter, PropertyEncoder } from '../common/index'
import { TypeBoxModel } from './model'
import { ModelToTypeScript } from './model-to-typescript'
import * as Types from '@sinclair/typebox'

// --------------------------------------------------------------------------
// ModelToValibotSettings
// --------------------------------------------------------------------------
export interface ModelToValibotSettings {
  exactOptionalPropertyTypes: boolean
}
// --------------------------------------------------------------------------
// ModelToValibot
// --------------------------------------------------------------------------
// prettier-ignore
export namespace ModelToValibot {
  function IsDefined<T = any>(value: unknown): value is T {
    return value !== undefined
  }
  function Type(type: string, parameter: string | null, constraints: string[]) {
    if (constraints.length > 0) {
      if (typeof parameter === 'string') {
        return `v.pipe(${type}(${parameter}), ${constraints.join(', ')})`
      } else {
        return `v.pipe(${type}(), ${constraints.join(', ')})`
      }
    } else {
      if (typeof parameter === 'string') {
        return `${type}(${parameter})`
      } else {
        return `${type}()`
      }
    }
  }
  function Any(schema: Types.TAny) {
    return Type(`v.any`, null, [])
  }
  function Array(schema: Types.TArray) {
    const items = Visit(schema.items)
    const constraints: string[] = []
    if (IsDefined<number>(schema.minItems)) constraints.push(`v.minLength(${schema.minItems})`)
    if (IsDefined<number>(schema.maxItems)) constraints.push(`v.maxLength(${schema.maxItems})`)
    return Type(`v.array`, items, constraints)
  }
  function BigInt(schema: Types.TBigInt) {
    return Type(`v.bigint`, null, [])
  }
  function Boolean(schema: Types.TBoolean) {
    return Type(`v.boolean`, null, [])
  }
  function Date(schema: Types.TDate) {
    return Type(`v.date`, null, [])
  }
  function Constructor(schema: Types.TConstructor): string {
    return UnsupportedType(schema)
  }
  function Function(schema: Types.TFunction) {
    return UnsupportedType(schema)
  }
  function Integer(schema: Types.TInteger) {
    const constraints: string[] = [`v.integer()`]
    if (IsDefined<number>(schema.minimum)) constraints.push(`v.minValue(${schema.minimum})`)
    if (IsDefined<number>(schema.maximum)) constraints.push(`v.maxValue(${schema.maximum})`)
    if (IsDefined<number>(schema.exclusiveMinimum)) constraints.push(`v.minValue(${schema.exclusiveMinimum + 1})`)
    if (IsDefined<number>(schema.exclusiveMaximum)) constraints.push(`v.maxValue(${schema.exclusiveMaximum - 1})`)
    return Type(`v.number`, null, constraints)
  }
  function Intersect(schema: Types.TIntersect) {
    const inner = schema.allOf.map((inner) => Visit(inner))
    return Type(`v.intersect`, `[${inner.join(', ')}]`, [])
  }
  function Literal(schema: Types.TLiteral) {
    return typeof schema.const === `string`
      ? Type(`v.literal`, `'${schema.const}'`, [])
      : Type(`v.literal`, `${schema.const}`, [])
  }
  function Never(schema: Types.TNever) {
    return Type(`v.never`, null, [])
  }
  function Null(schema: Types.TNull) {
    return Type(`v.null`, null, [])
  }

  function processStringSchema(options: {
    format?: string
    pattern?: string
    minLength?: number
    maxLength?: number
  }): string {
    const { format, pattern, minLength, maxLength } = options
    const constraints: string[] = []

    const lengthConstraints = getLengthConstraints(minLength, maxLength)
    constraints.push(...lengthConstraints)

    const patternConstraints = getPatternConstraints(pattern)
    constraints.push(...patternConstraints)

    const formatValidator = getFormatValidator(format)
    const constraintsStr = constraints.length > 0 ? constraints.join(', ') : ''

    return createStringValidatorWithFormat(formatValidator, constraintsStr)
  }

  function createStringValidatorWithFormat(formatValidator: string | null, constraintsStr: string): string {
    if (formatValidator) {
      if (constraintsStr) {
        return `v.pipe(v.string(), ${formatValidator}, ${constraintsStr})`
      }
      return `v.pipe(v.string(), ${formatValidator})`
    }
    if (constraintsStr) {
      return `v.pipe(v.string(), ${constraintsStr})`
    }
    return 'v.string()'
  }

  function getLengthConstraints(minLength?: number, maxLength?: number): string[] {
    const constraints: string[] = []
    if (IsDefined<number>(maxLength)) constraints.push(`v.maxLength(${maxLength})`)
    if (IsDefined<number>(minLength)) constraints.push(`v.minLength(${minLength})`)
    return constraints
  }

  function getPatternConstraints(pattern?: string): string[] {
    const constraints: string[] = []
    if (pattern) {
      const escapedPattern = pattern.replace(/\//g, '\\/')
      constraints.push(`v.regex(/${escapedPattern}/)`)
    }
    return constraints
  }

  function getFormatValidator(format?: string): string | null {
    if (!format) return null

    const formatMap: Record<string, string> = {
      'date-time': 'v.isoTimestamp()',
      email: 'v.email()',
      uri: 'v.url()',
      url: 'v.url()',
      uuid: 'v.uuid()',
      date: 'v.isoDate()',
      time: 'v.isoTime()',
      ipv4: 'v.ipv4()',
      ipv6: 'v.ipv6()',
    }

    return formatMap[format] || null
  }

  function String(schema: Types.TString) {
    return processStringSchema({
      format: schema.format,
      pattern: schema.pattern,
      minLength: schema.minLength,
      maxLength: schema.maxLength,
    })
  }
  function Number(schema: Types.TNumber) {
    const constraints: string[] = []
    if (IsDefined<number>(schema.minimum)) constraints.push(`v.minValue(${schema.minimum})`)
    if (IsDefined<number>(schema.maximum)) constraints.push(`v.maxValue(${schema.maximum})`)
    if (IsDefined<number>(schema.exclusiveMinimum)) constraints.push(`v.minValue(${schema.exclusiveMinimum + 1})`)
    if (IsDefined<number>(schema.exclusiveMaximum)) constraints.push(`v.maxValue(${schema.exclusiveMaximum - 1})`)
    return Type('v.number', null, constraints)
  }
  function Object(schema: Types.TObject) {
    const properties = globalThis.Object.entries(schema.properties).map(([key, value]) => {
      const optional = Types.TypeGuard.IsOptional(value)
      const property = PropertyEncoder.Encode(key)
      return optional
        ? settings.exactOptionalPropertyTypes
          ? `${property}: v.exactOptional(${Visit(value)})`
          : `${property}: v.optional(${Visit(value)})`
        : `${property}: ${Visit(value)}`
    }).join(`,`)
    const constraints: string[] = []
    return Type(`v.object`, `{\n${properties}\n}`, constraints)
  }
  function Promise(schema: Types.TPromise) {
    return UnsupportedType(schema)
  }
  function Record(schema: Types.TRecord) {
    for (const [key, value] of globalThis.Object.entries(schema.patternProperties)) {
      const type = Visit(value)
      if (key === '^(0|[1-9][0-9]*)$') {
        return Type('v.record', `v.number(), ${type}`, [])
      }
      const keyValidator = processStringSchema({ pattern: key })
      return Type('v.record', `${keyValidator}, ${type}`, [])
    }
    throw Error('Unreachable')
  }
  function Ref(schema: Types.TRef) {
    if (!reference_map.has(schema.$ref!)) return UnsupportedType(schema)
    return schema.$ref
  }
  function This(schema: Types.TThis) {
    return UnsupportedType(schema)
  }
  function Tuple(schema: Types.TTuple) {
    if (schema.items === undefined) return `[]`
    const items = schema.items.map((schema) => Visit(schema)).join(`, `)
    return Type(`v.tuple`, `[${items}]`, [])
  }
  function TemplateLiteral(schema: Types.TTemplateLiteral) {
    const constaint = Type(`v.regex`, `/${schema.pattern}/`, [])
    return Type(`v.string`, null, [constaint])
  }
  function UInt8Array(schema: Types.TUint8Array): string {
    return UnsupportedType(schema)
  }
  function Undefined(schema: Types.TUndefined) {
    return Type(`v.undefined`, null, [])
  }
  function Union(schema: Types.TUnion) {
    const inner = schema.anyOf.map((schema) => Visit(schema)).join(`, `)
    return Type(`v.union`, `[${inner}]`, [])
  }
  function Unknown(schema: Types.TUnknown) {
    return Type(`v.unknown`, null, [])
  }
  function Void(schema: Types.TVoid) {
    return Type(`v.void`, null, [])
  }
  function Transform(schema: Types.TTransform) {
    const { [Types.TransformKind]: _, ...newSchema } = schema

    // Decodeを適当な引数で実行し、その返却された型から入力のSchemaを算出する
    let fromStr = ''
    try {
      fromStr = Visit(TypeToSchema(typeof schema[Types.TransformKind].Decode(1)))
    } catch (e) {
      console.warn(
        '[ModelToValibot] An error occurred while executing the Decode function with argument 1, so it was converted to "any"',
        {
          Decode: schema[Types.TransformKind].Decode.toString(),
          error: e
        }
      )
      fromStr = 'v.any(/* failed to convert from Decode function */)'
    }

    // transformの処理内容はEncodeをそのまま流用する
    const transformCallback = schema[Types.TransformKind].Encode.toString()

    // schemaから出力のSchemaを算出する
    const toStr = Visit(newSchema)
    const constraints: string[] = []

    // v.pipeの場合その中身のみ、v.pipeでない場合はその値を使用する
    const match = toStr.match(/v\.pipe\s*\((.*)\)/)
    if (match) {
      match[1].split(',').forEach(s => constraints.push(s.trim()))
    } else {
      constraints.push(toStr.trim())
    }

    // "()"が付与されてしまうので、Type関数は使わず自力で組み立てる
    return `v.pipe(
      ${fromStr},
      v.transform(${transformCallback}),
      ${constraints.join(', ')}
    )`
  }
  function UnsupportedType(schema: Types.TSchema) {
    return `v.any(/* unsupported */)`
  }
  function Visit(schema: Types.TSchema): string {
    if (schema.$id !== undefined) reference_map.set(schema.$id, schema)
    if (schema.$id !== undefined && emitted_set.has(schema.$id!)) return schema.$id!
    if (Types.TypeGuard.IsTransform(schema)) return Transform(schema)
    if (Types.TypeGuard.IsAny(schema)) return Any(schema)
    if (Types.TypeGuard.IsArray(schema)) return Array(schema)
    if (Types.TypeGuard.IsBigInt(schema)) return BigInt(schema)
    if (Types.TypeGuard.IsBoolean(schema)) return Boolean(schema)
    if (Types.TypeGuard.IsDate(schema)) return Date(schema)
    if (Types.TypeGuard.IsConstructor(schema)) return Constructor(schema)
    if (Types.TypeGuard.IsFunction(schema)) return Function(schema)
    if (Types.TypeGuard.IsInteger(schema)) return Integer(schema)
    if (Types.TypeGuard.IsIntersect(schema)) return Intersect(schema)
    if (Types.TypeGuard.IsLiteral(schema)) return Literal(schema)
    if (Types.TypeGuard.IsNever(schema)) return Never(schema)
    if (Types.TypeGuard.IsNull(schema)) return Null(schema)
    if (Types.TypeGuard.IsNumber(schema)) return Number(schema)
    if (Types.TypeGuard.IsObject(schema)) return Object(schema)
    if (Types.TypeGuard.IsPromise(schema)) return Promise(schema)
    if (Types.TypeGuard.IsRecord(schema)) return Record(schema)
    if (Types.TypeGuard.IsRef(schema)) return Ref(schema)
    if (Types.TypeGuard.IsString(schema)) return String(schema)
    if (Types.TypeGuard.IsTemplateLiteral(schema)) return TemplateLiteral(schema)
    if (Types.TypeGuard.IsThis(schema)) return This(schema)
    if (Types.TypeGuard.IsTuple(schema)) return Tuple(schema)
    if (Types.TypeGuard.IsUint8Array(schema)) return UInt8Array(schema)
    if (Types.TypeGuard.IsUndefined(schema)) return Undefined(schema)
    if (Types.TypeGuard.IsUnion(schema)) return Union(schema)
    if (Types.TypeGuard.IsUnknown(schema)) return Unknown(schema)
    if (Types.TypeGuard.IsVoid(schema)) return Void(schema)
    return UnsupportedType(schema)
  }
  // 型文字列からtypeboxのSchemaを作成する関数
  function TypeToSchema(type: string) {
    switch (type) {
      case 'string':
        return Types.String()
      case 'number':
        return Types.Number()
      case 'boolean':
        return Types.Boolean()
      case 'array':
        return Types.Array(Types.Any())
      case 'object':
        return Types.Object({})
      default:
        return Types.Any()
    }
  }
  function Collect(schema: Types.TSchema) {
    return [...Visit(schema)].join(``)
  }
  function GenerateType(model: TypeBoxModel, schema: Types.TSchema, references: Types.TSchema[]) {
    const output: string[] = []
    for (const reference of references) {
      if (reference.$id === undefined) return UnsupportedType(schema)
      reference_map.set(reference.$id, reference)
    }
    const type = Collect(schema)
    if (recursive_set.has(schema.$id!)) {
      output.push(`export ${ModelToTypeScript.GenerateType(model, schema.$id!)}`)
      output.push(`export const ${schema.$id || `T`}: v.InferOutput<${schema.$id}> = v.lazy(() => ${Formatter.Format(type)})`)
    } else {
      output.push(`export type ${schema.$id} = v.InferOutput<typeof ${schema.$id}>`)
      output.push(`export const ${schema.$id || `T`} = ${Formatter.Format(type)}`)
    }
    if (schema.$id) emitted_set.add(schema.$id)
    return output.join('\n')
  }
  const reference_map = new Map<string, Types.TSchema>()
  const recursive_set = new Set<string>()
  const emitted_set = new Set<string>()
  const settings: ModelToValibotSettings = {
    exactOptionalPropertyTypes: false
  }
  export function Generate(model: TypeBoxModel, options: ModelToValibotSettings = {
    exactOptionalPropertyTypes: false
  }): string {
    settings.exactOptionalPropertyTypes = options.exactOptionalPropertyTypes
    reference_map.clear()
    recursive_set.clear()
    emitted_set.clear()
    const buffer: string[] = [`import * as v from 'valibot'`, '']
    for (const type of model.types.filter((type) => Types.TypeGuard.IsSchema(type))) {
      buffer.push(GenerateType(model, type, model.types))
    }
    return Formatter.Format(buffer.join('\n'))
  }
}
