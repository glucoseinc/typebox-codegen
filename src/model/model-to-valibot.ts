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
// ModelToValibot
// --------------------------------------------------------------------------
export namespace ModelToValibot {
  /*
   * These Dialect classes may not be accurate.
   */
  type ValibotVersions = 'initial' | '0.29' | '0.30' | '0.31' | 'latest'

  interface ValibotDialect {
    InferOutput: string
    typeWithConstraints: (type: string, parameter: string | null, constraints: string[]) => string
  }
  const ValibotDialect_Initial: ValibotDialect = {
    InferOutput: 'Output',
    typeWithConstraints: (type: string, parameter: string | null, constraints: string[]) => {
      if (typeof parameter === 'string') {
        return `${type}(${parameter}, [${constraints.join(', ')}])`
      } else {
        return `${type}([${constraints.join(', ')}])`
      }
    },
  }
  const ValibotDialect_0_29: ValibotDialect = {
    ...ValibotDialect_Initial,
  }
  const ValibotDialect_0_30: ValibotDialect = {
    ...ValibotDialect_0_29,
  }
  const ValibotDialect_0_31: ValibotDialect = {
    ...ValibotDialect_0_30,
    InferOutput: 'InferOutput',
    typeWithConstraints: (type: string, parameter: string | null, constraints: string[]) => `v.pipe(${type}(${parameter ?? ''}), ${constraints.join(', ')})`,
  }
  const VALIBOT_DIALECTS: Record<ValibotVersions, ValibotDialect> = {
    initial: ValibotDialect_Initial,
    '0.29': ValibotDialect_0_29,
    '0.30': ValibotDialect_0_30,
    '0.31': ValibotDialect_0_31,
    latest: ValibotDialect_0_31,
  }

  interface ValibotOptions {
    version?: ValibotVersions
  }

  class ValibotVisitor {
    dialect: ValibotDialect
    reference_map: Map<string, Types.TSchema>
    recursive_set: Set<string>
    emitted_set: Set<string>

    constructor(version: ValibotVersions) {
      this.dialect = VALIBOT_DIALECTS[version]
      this.reference_map = new Map()
      this.recursive_set = new Set()
      this.emitted_set = new Set()
    }

    IsDefined<T = any>(value: unknown): value is T {
      return value !== undefined
    }
    Type(type: string, parameter: string | null, constraints: string[]) {
      if (constraints.length > 0) {
        return this.dialect.typeWithConstraints(type, parameter, constraints)
      } else {
        if (typeof parameter === 'string') {
          return `${type}(${parameter})`
        } else {
          return `${type}()`
        }
      }
    }
    Any(schema: Types.TAny) {
      return this.Type(`v.any`, null, [])
    }
    Array(schema: Types.TArray) {
      const items = this.Visit(schema.items)
      const constraints: string[] = []
      if (this.IsDefined<number>(schema.minItems)) constraints.push(`v.minLength(${schema.minItems})`)
      if (this.IsDefined<number>(schema.maxItems)) constraints.push(`v.maxLength(${schema.maxItems})`)
      return this.Type(`v.array`, items, constraints)
    }
    BigInt(schema: Types.TBigInt) {
      return this.Type(`v.bigint`, null, [])
    }
    Boolean(schema: Types.TBoolean) {
      return this.Type(`v.boolean`, null, [])
    }
    Date(schema: Types.TDate) {
      return this.Type(`v.date`, null, [])
    }
    Constructor(schema: Types.TConstructor): string {
      return this.UnsupportedType(schema)
    }
    Function(schema: Types.TFunction) {
      return this.UnsupportedType(schema)
    }
    Integer(schema: Types.TInteger) {
      return this.Type(`v.number`, null, [`v.integer()`])
    }
    Intersect(schema: Types.TIntersect) {
      const inner = schema.allOf.map((inner) => this.Visit(inner))
      return this.Type(`v.intersect`, `[${inner.join(', ')}]`, [])
    }
    Literal(schema: Types.TLiteral) {
      // prettier-ignore
      return typeof schema.const === `string`
        ? this.Type(`v.literal`, `'${schema.const}'`, [])
        : this.Type(`v.literal`, `${schema.const}`, [])
    }
    Never(schema: Types.TNever) {
      return this.Type(`v.never`, null, [])
    }
    Null(schema: Types.TNull) {
      return this.Type(`v.null_`, null, [])
    }
    String(schema: Types.TString) {
      const constraints: string[] = []
      if (this.IsDefined<number>(schema.maxLength)) constraints.push(`v.maxLength(${schema.maxLength})`)
      if (this.IsDefined<number>(schema.minLength)) constraints.push(`v.minLength(${schema.minLength})`)
      return this.Type(`v.string`, null, constraints)
    }
    Number(schema: Types.TNumber) {
      const constraints: string[] = []
      if (this.IsDefined<number>(schema.minimum)) constraints.push(`v.minValue(${schema.minimum})`)
      if (this.IsDefined<number>(schema.maximum)) constraints.push(`v.maxValue(${schema.maximum})`)
      if (this.IsDefined<number>(schema.exclusiveMinimum)) constraints.push(`v.minValue(${schema.exclusiveMinimum + 1})`)
      if (this.IsDefined<number>(schema.exclusiveMaximum)) constraints.push(`v.maxValue(${schema.exclusiveMaximum - 1})`)
      return this.Type('v.number', null, constraints)
    }
    Object(schema: Types.TObject) {
      // prettier-ignore
      const properties = globalThis.Object.entries(schema.properties).map(([key, value]) => {
        const optional = Types.TypeGuard.IsOptional(value)
        const property = PropertyEncoder.Encode(key)
        return optional ? `${property}: v.optional(${this.Visit(value)})` : `${property}: ${this.Visit(value)}`
      }).join(`,`)
      const constraints: string[] = []
      return this.Type(`v.object`, `{\n${properties}\n}`, constraints)
    }
    Promise(schema: Types.TPromise) {
      return this.UnsupportedType(schema)
    }
    Record(schema: Types.TRecord) {
      for (const [key, value] of globalThis.Object.entries(schema.patternProperties)) {
        const type = this.Visit(value)
        if (key === `^(0|[1-9][0-9]*)$`) {
          return this.UnsupportedType(schema)
        } else {
          return this.Type(`v.record`, type, [])
        }
      }
      throw Error(`Unreachable`)
    }
    Ref(schema: Types.TRef) {
      if (!this.reference_map.has(schema.$ref!)) return this.UnsupportedType(schema)
      return schema.$ref
    }
    This(schema: Types.TThis) {
      return this.UnsupportedType(schema)
    }
    Tuple(schema: Types.TTuple) {
      if (schema.items === undefined) return `[]`
      const items = schema.items.map((schema) => this.Visit(schema)).join(`, `)
      return this.Type(`v.tuple`, `[${items}]`, [])
    }
    TemplateLiteral(schema: Types.TTemplateLiteral) {
      const constraint = this.Type(`v.regex`, `/${schema.pattern}/`, [])
      return this.Type(`v.string`, null, [constraint])
    }
    UInt8Array(schema: Types.TUint8Array): string {
      return this.UnsupportedType(schema)
    }
    Undefined(schema: Types.TUndefined) {
      return this.Type(`v.undefinedType`, null, [])
    }
    Union(schema: Types.TUnion) {
      const inner = schema.anyOf.map((schema) => this.Visit(schema)).join(`, `)
      return this.Type(`v.union`, `[${inner}]`, [])
    }
    Unknown(schema: Types.TUnknown) {
      return this.Type(`v.unknown`, null, [])
    }
    Void(schema: Types.TVoid) {
      return this.Type(`v.voidType`, null, [])
    }
    UnsupportedType(schema: Types.TSchema) {
      return `v.any(/* unsupported */)`
    }
    Visit(schema: Types.TSchema): string {
      if (schema.$id !== undefined) this.reference_map.set(schema.$id, schema)
      if (schema.$id !== undefined && this.emitted_set.has(schema.$id!)) return schema.$id!
      if (Types.TypeGuard.IsAny(schema)) return this.Any(schema)
      if (Types.TypeGuard.IsArray(schema)) return this.Array(schema)
      if (Types.TypeGuard.IsBigInt(schema)) return this.BigInt(schema)
      if (Types.TypeGuard.IsBoolean(schema)) return this.Boolean(schema)
      if (Types.TypeGuard.IsDate(schema)) return this.Date(schema)
      if (Types.TypeGuard.IsConstructor(schema)) return this.Constructor(schema)
      if (Types.TypeGuard.IsFunction(schema)) return this.Function(schema)
      if (Types.TypeGuard.IsInteger(schema)) return this.Integer(schema)
      if (Types.TypeGuard.IsIntersect(schema)) return this.Intersect(schema)
      if (Types.TypeGuard.IsLiteral(schema)) return this.Literal(schema)
      if (Types.TypeGuard.IsNever(schema)) return this.Never(schema)
      if (Types.TypeGuard.IsNull(schema)) return this.Null(schema)
      if (Types.TypeGuard.IsNumber(schema)) return this.Number(schema)
      if (Types.TypeGuard.IsObject(schema)) return this.Object(schema)
      if (Types.TypeGuard.IsPromise(schema)) return this.Promise(schema)
      if (Types.TypeGuard.IsRecord(schema)) return this.Record(schema)
      if (Types.TypeGuard.IsRef(schema)) return this.Ref(schema)
      if (Types.TypeGuard.IsString(schema)) return this.String(schema)
      if (Types.TypeGuard.IsTemplateLiteral(schema)) return this.TemplateLiteral(schema)
      if (Types.TypeGuard.IsThis(schema)) return this.This(schema)
      if (Types.TypeGuard.IsTuple(schema)) return this.Tuple(schema)
      if (Types.TypeGuard.IsUint8Array(schema)) return this.UInt8Array(schema)
      if (Types.TypeGuard.IsUndefined(schema)) return this.Undefined(schema)
      if (Types.TypeGuard.IsUnion(schema)) return this.Union(schema)
      if (Types.TypeGuard.IsUnknown(schema)) return this.Unknown(schema)
      if (Types.TypeGuard.IsVoid(schema)) return this.Void(schema)
      return this.UnsupportedType(schema)
    }
    Collect(schema: Types.TSchema) {
      return [...this.Visit(schema)].join(``)
    }
    GenerateType(model: TypeBoxModel, schema: Types.TSchema, references: Types.TSchema[]) {
      const output: string[] = []
      for (const reference of references) {
        if (reference.$id === undefined) return this.UnsupportedType(schema)
        this.reference_map.set(reference.$id, reference)
      }
      const type = this.Collect(schema)
      if (this.recursive_set.has(schema.$id!)) {
        output.push(`export ${ModelToTypeScript.GenerateType(model, schema.$id!)}`)
        output.push(`export const ${schema.$id || `T`}: v.${this.dialect.InferOutput}<${schema.$id}> = v.lazy(() => ${Formatter.Format(type)})`)
      } else {
        output.push(`export type ${schema.$id} = v.${this.dialect.InferOutput}<typeof ${schema.$id}>`)
        output.push(`export const ${schema.$id || `T`} = ${Formatter.Format(type)}`)
      }
      if (schema.$id) this.emitted_set.add(schema.$id)
      return output.join('\n')
    }
  }
  export function Generate(model: TypeBoxModel, options?: ValibotOptions): string {
    const visitor = new ValibotVisitor(options?.version || 'latest')
    const buffer: string[] = [`import * as v from 'valibot'`, '']
    for (const type of model.types.filter((type) => Types.TypeGuard.IsSchema(type))) {
      buffer.push(visitor.GenerateType(model, type, model.types))
    }
    return Formatter.Format(buffer.join('\n'))
  }
}
