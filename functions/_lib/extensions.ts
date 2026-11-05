/** Non-destructive tables added to existing D1 installations. */
export const EXTENSION_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS site_pages (
    slug TEXT PRIMARY KEY, draft_json TEXT, published_json TEXT,
    published_version INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL, published_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS site_page_versions (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL, version INTEGER NOT NULL,
    document_json TEXT NOT NULL, published_at TEXT NOT NULL,
    published_by TEXT REFERENCES users(id), UNIQUE(slug, version)
  )`,
  `CREATE TABLE IF NOT EXISTS recurring_plans (
    id TEXT PRIMARY KEY, title TEXT NOT NULL,
    start_period TEXT NOT NULL, next_period TEXT NOT NULL,
    repetitions INTEGER NOT NULL CHECK(repetitions BETWEEN 1 AND 36),
    processed INTEGER NOT NULL DEFAULT 0,
    due_day INTEGER NOT NULL CHECK(due_day BETWEEN 1 AND 28),
    amount_cents INTEGER CHECK(amount_cents IS NULL OR amount_cents > 0),
    channels TEXT NOT NULL DEFAULT 'portal',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','completed')),
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS recurring_plan_members (
    plan_id TEXT NOT NULL REFERENCES recurring_plans(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    PRIMARY KEY(plan_id,member_id)
  )`,
  `CREATE INDEX IF NOT EXISTS recurring_plans_queue ON recurring_plans(status,next_period)`,
  `CREATE TABLE IF NOT EXISTS recurring_charge_links (
    plan_id TEXT NOT NULL REFERENCES recurring_plans(id) ON DELETE CASCADE,
    charge_id TEXT NOT NULL REFERENCES charges(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL, PRIMARY KEY(plan_id,charge_id)
  )`,
  `CREATE TABLE IF NOT EXISTS site_media_assets (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK(mime_type='image/webp'),
    width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 4096),
    height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 4096),
    size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 1 AND 921600),
    data BLOB NOT NULL,
    created_at TEXT NOT NULL,
    uploaded_by TEXT REFERENCES users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS site_media_created ON site_media_assets(created_at)`,
  `CREATE TABLE IF NOT EXISTS notice_logs (
    id TEXT PRIMARY KEY, charge_id TEXT NOT NULL REFERENCES charges(id),
    channel TEXT NOT NULL, status TEXT NOT NULL,
    detail TEXT, created_at TEXT NOT NULL,
    UNIQUE(charge_id, channel, status)
  )`
] as const;

export type D1Query = {
  bind: (...values: unknown[]) => D1Query;
  first: <T = any>() => Promise<T | null>;
  all: <T = any>() => Promise<{ results: T[] }>;
  run: () => Promise<any>;
};
export type D1Like = {
  prepare: (sql: string) => D1Query;
  batch: (queries: D1Query[]) => Promise<unknown>;
};
export async function ensureExtensionSchema(db: D1Like): Promise<void> {
  const result = await db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name IN ('site_pages','site_page_versions','recurring_plans','recurring_plan_members','recurring_charge_links','notice_logs','site_media_assets')").first<{total:number}>();
  if (Number(result?.total || 0) !== 7) {
    await db.batch(EXTENSION_SCHEMA.map(sql => db.prepare(sql)));
  }
}
