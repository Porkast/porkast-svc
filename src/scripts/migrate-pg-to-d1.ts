import pg from 'pg'
import { appendFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { EOL } from 'os'

const PG_URL = process.env.DATABASE_URL
if (!PG_URL) {
  console.error('Missing DATABASE_URL environment variable')
  process.exit(1)
}

const OUTPUT_DIR = resolve(import.meta.dir || __dirname, '../../migrations/data')
const BATCH_SIZE = 500

// SQL-escaping helper functions
function sqlString(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  const str = String(val).replace(/'/g, "''")
  return `'${str}'`
}

function sqlDate(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  if (val instanceof Date) {
    if (isDateOnly(val)) {
      return sqlString(val.toISOString().split('T')[0])
    }
    return sqlString(val.toISOString())
  }
  return sqlString(val)
}

function isDateOnly(d: Date): boolean {
  return (
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0
  )
}

function sqlBlob(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
    const hex = Buffer.from(val).toString('hex')
    return `X'${hex}'`
  }
  if (typeof val === 'object' && (val as any)?.type === 'Buffer') {
    const hex = Buffer.from((val as any).data).toString('hex')
    return `X'${hex}'`
  }
  return sqlString(val)
}

function sqlInt(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  const n = Number(val)
  return Number.isNaN(n) ? 'NULL' : String(Math.floor(n))
}

function sqlBool(val: unknown): string {
  if (val === null || val === undefined) return 'NULL'
  return val ? '1' : '0'
}

interface TableConfig {
  name: string
  columns: string[]
  transform: (row: any) => string[]
}

const TABLES: TableConfig[] = [
  {
    name: 'feed_channel',
    columns: ['id', 'title', 'channel_desc', 'image_url', 'link', 'feed_link', 'copyright', 'language', 'author', 'owner_name', 'owner_email', 'feed_type', 'categories', 'source', 'feed_id'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.title), sqlString(r.channel_desc),
      sqlString(r.image_url), sqlString(r.link), sqlString(r.feed_link),
      sqlString(r.copyright), sqlString(r.language), sqlString(r.author),
      sqlString(r.owner_name), sqlString(r.owner_email), sqlString(r.feed_type),
      sqlString(r.categories), sqlString(r.source), sqlString(r.feed_id),
    ],
  },
  {
    name: 'feed_item',
    columns: ['id', 'channel_id', 'guid', 'title', 'link', 'pub_date', 'author', 'input_date', 'image_url', 'enclosure_url', 'enclosure_type', 'enclosure_length', 'duration', 'episode', 'explicit', 'season', 'episodetype', 'description', 'channel_title', 'feed_id', 'feed_link', 'source'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.channel_id), sqlString(r.guid),
      sqlString(r.title), sqlString(r.link), sqlDate(r.pub_date),
      sqlString(r.author), sqlDate(r.input_date), sqlString(r.image_url),
      sqlString(r.enclosure_url), sqlString(r.enclosure_type),
      sqlString(r.enclosure_length), sqlString(r.duration),
      sqlString(r.episode), sqlString(r.explicit), sqlString(r.season),
      sqlString(r.episodetype), sqlBlob(r.description),
      sqlString(r.channel_title), sqlString(r.feed_id),
      sqlString(r.feed_link), sqlString(r.source),
    ],
  },
  {
    name: 'keyword_subscription',
    columns: ['id', 'keyword', 'feed_channel_id', 'feed_item_id', 'create_time', 'country', 'source', 'exclude_feed_id'],
    transform: (r) => [
      sqlInt(r.id), sqlString(r.keyword), sqlString(r.feed_channel_id),
      sqlString(r.feed_item_id), sqlDate(r.create_time),
      sqlString(r.country), sqlString(r.source), sqlString(r.exclude_feed_id),
    ],
  },
  {
    name: 'user_info',
    columns: ['id', 'username', 'nickname', 'password', 'email', 'phone', 'reg_date', 'update_date', 'avatar', 'telegram_id'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.username), sqlString(r.nickname),
      sqlString(r.password), sqlString(r.email), sqlString(r.phone),
      sqlDate(r.reg_date), sqlDate(r.update_date),
      sqlString(r.avatar), sqlString(r.telegram_id),
    ],
  },
  {
    name: 'verification_token',
    columns: ['id', 'email', 'token', 'expires_at', 'created_at'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.email), sqlString(r.token),
      sqlDate(r.expires_at), sqlDate(r.created_at),
    ],
  },
  {
    name: 'app_session',
    columns: ['id', 'user_id', 'token_hash', 'expires_at', 'created_at', 'revoked_at'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.user_id), sqlString(r.token_hash),
      sqlDate(r.expires_at), sqlDate(r.created_at), sqlDate(r.revoked_at),
    ],
  },
  {
    name: 'user_listen_later',
    columns: ['id', 'user_id', 'item_id', 'channel_id', 'reg_date', 'status'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.user_id), sqlString(r.item_id),
      sqlString(r.channel_id), sqlDate(r.reg_date), sqlInt(r.status),
    ],
  },
  {
    name: 'user_playlist',
    columns: ['id', 'playlist_name', 'description', 'user_id', 'reg_date', 'status', 'creator_id', 'orig_playlist_id'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.playlist_name), sqlBlob(r.description),
      sqlString(r.user_id), sqlDate(r.reg_date), sqlInt(r.status),
      sqlString(r.creator_id), sqlString(r.orig_playlist_id),
    ],
  },
  {
    name: 'user_playlist_item',
    columns: ['id', 'playlist_id', 'item_id', 'channel_id', 'reg_date', 'status'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.playlist_id), sqlString(r.item_id),
      sqlString(r.channel_id), sqlDate(r.reg_date), sqlInt(r.status),
    ],
  },
  {
    name: 'user_subscription',
    columns: ['id', 'user_id', 'create_time', 'status', 'keyword', 'order_by_date', 'lang', 'country', 'exclude_feed_id', 'source', 'ref_id', 'ref_name', 'type', 'latest_id', 'update_time', 'total_count'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.user_id), sqlDate(r.create_time),
      sqlInt(r.status), sqlString(r.keyword), sqlInt(r.order_by_date),
      sqlString(r.lang), sqlString(r.country), sqlString(r.exclude_feed_id),
      sqlString(r.source), sqlString(r.ref_id), sqlString(r.ref_name),
      sqlString(r.type), sqlInt(r.latest_id), sqlDate(r.update_time),
      sqlInt(r.total_count),
    ],
  },
  {
    name: 'user_membership',
    columns: ['id', 'user_id', 'product_id', 'tier', 'original_transaction_id', 'latest_transaction_id', 'expires_date', 'is_active', 'will_renew', 'is_in_billing_retry', 'environment', 'created_at', 'updated_at'],
    transform: (r) => [
      sqlString(r.id), sqlString(r.user_id), sqlString(r.product_id),
      sqlString(r.tier), sqlString(r.original_transaction_id),
      sqlString(r.latest_transaction_id), sqlDate(r.expires_date),
      sqlBool(r.is_active), sqlBool(r.will_renew),
      sqlBool(r.is_in_billing_retry), sqlString(r.environment),
      sqlDate(r.created_at), sqlDate(r.updated_at),
    ],
  },
]

async function main() {
  const pool = new pg.Pool({ connectionString: PG_URL })
  const client = await pool.connect()
  let totalRows = 0

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const masterFile = resolve(OUTPUT_DIR, '00-import-all.sql')
  writeFileSync(masterFile, [
    '-- Porkast PostgreSQL → D1 Data Migration',
    `-- Generated: ${new Date().toISOString()}`,
    '-- This script is READ-ONLY against PostgreSQL',
    '',
    'PRAGMA journal_mode = WAL;',
    'PRAGMA synchronous = OFF;',
    'PRAGMA foreign_keys = OFF;',
    '',
  ].join(EOL) + EOL)

  console.log('Starting read-only migration from PostgreSQL...')
  console.log(`Output directory: ${OUTPUT_DIR}`)
  console.log('')

  for (const table of TABLES) {
    console.log(`[${table.name}] Reading from PostgreSQL...`)
    const result = await client.query(`SELECT * FROM public.${table.name} ORDER BY 1`)
    const rows = result.rows
    console.log(`[${table.name}] ${rows.length} rows found`)

    if (rows.length === 0) {
      console.log(`[${table.name}] No data, skipping`)
      masterAppend(masterFile, `-- ${table.name}: 0 rows (skipped)`)
      console.log('')
      continue
    }

    const cols = table.columns.join(', ')
    let writtenCount = 0

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const statements = batch.map((row) => {
        const values = table.transform(row).join(', ')
        return `INSERT OR IGNORE INTO ${table.name} (${cols}) VALUES (${values});`
      })

      const chunkFile = resolve(OUTPUT_DIR, `${table.name}.sql`)
      const mode = i === 0 ? 'w' : 'a'
      const content = statements.join(EOL) + EOL
      if (mode === 'w') writeFileSync(chunkFile, content)
      else appendFileSync(chunkFile, content)

      writtenCount += batch.length
      process.stdout.write(`\r[${table.name}] ${writtenCount}/${rows.length} rows written`)
    }

    masterAppend(masterFile, `.read ${table.name}.sql`)
    totalRows += rows.length
    console.log(`\n[${table.name}] Done`)
    console.log('')
  }

  masterAppend(masterFile, [
    '',
    'PRAGMA foreign_keys = ON;',
    'PRAGMA synchronous = NORMAL;',
    'PRAGMA journal_mode = DELETE;',
    '',
    '-- Migration complete',
  ].join(EOL) + EOL)

  await client.release()
  await pool.end()

  console.log('═══════════════════════════════════════════')
  console.log(` Migration complete: ${totalRows} total rows migrated`)
  console.log(` SQL files in: ${OUTPUT_DIR}`)
  console.log('')
  console.log(' To import into D1:')
  console.log(`   wrangler d1 execute porkast-db --remote --file=${masterFile}`)
  console.log('')
  console.log(' To import locally:')
  console.log('   wrangler d1 execute porkast-db --local --file=<(cat migrations/data/*.sql)')
  console.log('═══════════════════════════════════════════')
}

function masterAppend(file: string, content: string) {
  appendFileSync(file, content + EOL)
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
