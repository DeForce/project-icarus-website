import type { Document, Node } from 'yaml'
import { isAlias, isMap, isNode, isSeq, LineCounter, parseAllDocuments } from 'yaml'
import { z } from 'zod'
import {
  KEY_PATTERN,
  MAX_ARTICLE_BODY_CHARS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_CHANGES,
  MAX_KEY_CHARS,
  MAX_PACKAGE_TITLE_CHARS,
  MIN_IMPORT_CHANGES,
  UUID_PATTERN,
} from '../../../shared/constants.ts'
import type { ReferenceProblem } from '../../../shared/types.ts'

export class ImportParseError extends Error {
  readonly problems: readonly ReferenceProblem[]

  constructor(problems: readonly ReferenceProblem[]) {
    super(`Invalid import document: ${problems.map((problem) => `${problem.path}: ${problem.message}`).join('; ')}`)
    this.name = 'ImportParseError'
    this.problems = problems
  }
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid calendar date')

const keyString = z
  .string()
  .max(MAX_KEY_CHARS, `Key exceeds ${MAX_KEY_CHARS} characters`)
  .regex(KEY_PATTERN, 'Keys use ASCII letters, digits and . _ -, starting with a letter or digit')

const reference = z.string().refine((value) => KEY_PATTERN.test(value) || UUID_PATTERN.test(value), 'Expected a key or an entity UUID')

const recordMeta = {
  source: z.string().optional(),
  effectiveDate: dateString.nullable().optional(),
}

const categorySchema = z.strictObject({
  key: keyString,
  name: z.string().min(1),
  parent: reference.nullable().default(null),
  order: z.number().int().default(0),
  ...recordMeta,
})

const articleSchema = z.strictObject({
  key: keyString,
  title: z.string().min(1),
  category: reference,
  body: z.string().min(1).max(MAX_ARTICLE_BODY_CHARS, `Body exceeds ${MAX_ARTICLE_BODY_CHARS} characters`),
  relatedArticles: z.array(reference).default([]),
  ...recordMeta,
})

const astronomySchema = z.strictObject({
  designation: z.string().min(1),
  raDegrees: z.number().min(0).lt(360, 'raDegrees must be in [0, 360)'),
  decDegrees: z.number().min(-90, 'decDegrees must be in [-90, 90]').max(90, 'decDegrees must be in [-90, 90]'),
  distancePc: z.number().min(0, 'distancePc must be >= 0'),
  spectralType: z.string().nullable(),
  catalogSource: z.string().min(1),
  epoch: z.string().min(1),
})

const systemSchema = z.strictObject({
  key: keyString,
  name: z.string().min(1),
  astronomy: astronomySchema.nullable().default(null),
  faction: z.string().nullable().default(null),
  worldClass: z.enum(['central', 'middle', 'outer', 'uncolonized', 'unknown']).default('unknown'),
  population: z.number().int().min(0).nullable().default(null),
  economy: z.string().nullable().default(null),
  anchors: z.string().nullable().default(null),
  description: z.string().default(''),
  article: reference.nullable().default(null),
  ...recordMeta,
})

const routeSchema = z.strictObject({
  key: keyString,
  from: reference,
  to: reference,
  type: z.enum(['main', 'secondary', 'experimental', 'historical']).default('secondary'),
  status: z.enum(['open', 'closed', 'dangerous', 'unknown']).default('unknown'),
  direction: z.enum(['both', 'forward']).default('both'),
  operator: z.string().nullable().default(null),
  minimumJumpOrder: z.number().int().min(0).nullable().default(null),
  description: z.string().default(''),
  article: reference.nullable().default(null),
  ...recordMeta,
})

const removeEntrySchema = z.strictObject({
  kind: z.enum(['category', 'article', 'system', 'route']),
  key: reference,
  ...recordMeta,
})

const packageHeaderSchema = z.strictObject({
  key: keyString,
  title: z.string().min(1).max(MAX_PACKAGE_TITLE_CHARS, `Title exceeds ${MAX_PACKAGE_TITLE_CHARS} characters`),
  receivedDate: dateString,
  publicSummary: z.string().default(''),
  source: z.string().default(''),
  effectiveDate: dateString.nullable().default(null),
})

const importDocumentSchema = z.strictObject({
  version: z.literal(1),
  package: packageHeaderSchema,
  categories: z.array(categorySchema).default([]),
  articles: z.array(articleSchema).default([]),
  systems: z.array(systemSchema).default([]),
  routes: z.array(routeSchema).default([]),
  remove: z.array(removeEntrySchema).default([]),
})

export type ImportDocument = z.infer<typeof importDocumentSchema>

function locate(lineCounter: LineCounter, node: Node): string {
  const position = lineCounter.linePos(node.range?.[0] ?? 0)
  return position ? `line ${position.line}, column ${position.col}` : 'document'
}

/** Rejects aliases (`*`), anchors (`&`) and explicit tags (`!`) before converting to JS. */
function collectForbiddenNodes(doc: Document, lineCounter: LineCounter, problems: ReferenceProblem[]): void {
  const visit = (node: unknown): void => {
    if (isAlias(node)) {
      problems.push({ path: 'document', message: `Aliases are not supported (${locate(lineCounter, node)})` })
      return
    }
    if (isNode(node)) {
      if (node.anchor) {
        problems.push({ path: 'document', message: `Anchors are not supported (${locate(lineCounter, node)})` })
      }
      if (node.tag) {
        problems.push({ path: 'document', message: `Explicit YAML tags are not supported (${locate(lineCounter, node)})` })
      }
    }
    if (isMap(node)) {
      for (const pair of node.items) {
        if (isNode(pair.key)) visit(pair.key)
        visit(pair.value)
      }
    } else if (isSeq(node)) {
      for (const item of node.items) {
        visit(item)
      }
    }
  }
  if (doc.contents) visit(doc.contents)
}

function collectSchemaProblems(error: z.ZodError): ReferenceProblem[] {
  return error.issues.map((issue) => ({
    path:
      issue.path.length > 0
        ? issue.path
            .map((segment) => (typeof segment === 'number' ? `[${segment}]` : `.${String(segment)}`))
            .join('')
            .replace(/^\./, '')
        : 'document',
    message: issue.message,
  }))
}

function checkDuplicateKeys(document: ImportDocument): ReferenceProblem[] {
  const problems: ReferenceProblem[] = []
  const sections = [
    ['categories', document.categories],
    ['articles', document.articles],
    ['systems', document.systems],
    ['routes', document.routes],
  ] as const
  for (const [section, records] of sections) {
    const seen = new Map<string, number>()
    records.forEach((record, index) => {
      const first = seen.get(record.key)
      if (first !== undefined) {
        problems.push({ path: `${section}[${index}].key`, message: `Duplicate key "${record.key}" (first used at ${section}[${first}])` })
      } else {
        seen.set(record.key, index)
      }
    })
  }
  return problems
}

export interface ParsedImport {
  document: ImportDocument
  changeCount: number
}

/** Parses and validates one YAML import document without touching the database. */
export function parseImportYaml(text: string): ParsedImport {
  const problems: ReferenceProblem[] = []

  if (Buffer.byteLength(text, 'utf8') > MAX_IMPORT_BYTES) {
    throw new ImportParseError([{ path: 'document', message: `File exceeds ${MAX_IMPORT_BYTES} bytes` }])
  }

  // A shared LineCounter instance gives positions both for parser errors and for the
  // forbidden-node walk below (passing `lineCounter: true` breaks yaml error handling).
  const lineCounter = new LineCounter()
  const documents = parseAllDocuments(text, { uniqueKeys: true, lineCounter })
  if (documents.length !== 1) {
    throw new ImportParseError([{ path: 'document', message: `Expected exactly one YAML document, found ${documents.length}` }])
  }
  const doc = documents[0]
  if (!doc) {
    throw new ImportParseError([{ path: 'document', message: 'Empty YAML document' }])
  }
  for (const error of doc.errors) {
    const position = error.linePos?.[0]
    problems.push({
      path: 'document',
      message: `${error.message.replace(/ at line \d+, column \d+:$/, '')}${position ? ` (line ${position.line}, column ${position.col})` : ''}`,
    })
  }
  if (doc.contents) collectForbiddenNodes(doc, lineCounter, problems)
  if (problems.length > 0) throw new ImportParseError(problems)

  const raw: unknown = doc.toJS()
  const result = importDocumentSchema.safeParse(raw)
  if (!result.success) {
    throw new ImportParseError(collectSchemaProblems(result.error))
  }
  const document = result.data

  problems.push(...checkDuplicateKeys(document))
  const changeCount =
    document.categories.length + document.articles.length + document.systems.length + document.routes.length + document.remove.length
  if (changeCount < MIN_IMPORT_CHANGES || changeCount > MAX_IMPORT_CHANGES) {
    problems.push({
      path: 'document',
      message: `Expected between ${MIN_IMPORT_CHANGES} and ${MAX_IMPORT_CHANGES} changes, found ${changeCount}`,
    })
  }
  if (problems.length > 0) throw new ImportParseError(problems)

  return { document, changeCount }
}
