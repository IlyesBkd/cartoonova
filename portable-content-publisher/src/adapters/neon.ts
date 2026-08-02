import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { ContentRecord, ProjectConfig } from "../core/types.js";
import type { CmsAdapter } from "./contracts.js";

interface ArticleRow {
  id: string;
  project_id: string;
  topic_id: string;
  kind: string;
  locale: string;
  category: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  images: ContentRecord["images"];
  source_urls: string[];
  seo: ContentRecord["seo"];
  status: ContentRecord["status"];
  fingerprint: string;
  revision: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  scheduled_at: string | null;
}

function rowToRecord(row: ArticleRow): ContentRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    topicId: row.topic_id,
    kind: row.kind,
    locale: row.locale,
    category: row.category,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    images: row.images,
    sourceUrls: row.source_urls,
    seo: row.seo,
    status: row.status,
    fingerprint: row.fingerprint,
    revision: row.revision,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    ...(row.published_at ? { publishedAt: new Date(row.published_at).toISOString() } : {}),
    ...(row.scheduled_at ? { scheduledAt: new Date(row.scheduled_at).toISOString() } : {}),
  };
}

/**
 * Stores articles in the same Neon/Postgres database already used by the main site,
 * so the deployed (serverless) frontend can read published content directly with SQL
 * instead of relying on a shared local filesystem. Revision checks are enforced with a
 * single atomic `UPDATE ... WHERE id = ? AND revision = ?`, and fingerprint idempotency
 * with `INSERT ... ON CONFLICT ... DO NOTHING` — both race-free under concurrent workers,
 * unlike the bundled FileCmsAdapter which needs an explicit lock for the same guarantee.
 */
export class NeonCmsAdapter implements CmsAdapter {
  private readonly sql: NeonQueryFunction<false, false>;

  constructor(config: ProjectConfig) {
    const connectionString = String(config.adapters.cms.options.connectionString ?? process.env.DATABASE_URL ?? "");
    if (!connectionString) throw new Error("Neon CMS adapter requires adapters.cms.options.connectionString or DATABASE_URL");
    this.sql = neon(connectionString);
  }

  async initialize(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        locale TEXT NOT NULL,
        category TEXT NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        body TEXT NOT NULL,
        images JSONB NOT NULL DEFAULT '[]',
        source_urls JSONB NOT NULL DEFAULT '[]',
        seo JSONB NOT NULL,
        status TEXT NOT NULL,
        fingerprint TEXT NOT NULL UNIQUE,
        revision INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        published_at TIMESTAMPTZ,
        scheduled_at TIMESTAMPTZ
      )
    `;
    await this.sql`CREATE INDEX IF NOT EXISTS articles_status_kind_locale_idx ON articles (status, kind, locale)`;
    await this.sql`CREATE INDEX IF NOT EXISTS articles_locale_slug_idx ON articles (locale, slug)`;
  }

  async list(filters: Partial<Pick<ContentRecord, "status" | "kind" | "locale">> = {}): Promise<ContentRecord[]> {
    const rows = (await this.sql`SELECT * FROM articles ORDER BY created_at DESC`) as unknown as ArticleRow[];
    return rows.map(rowToRecord).filter((record) => Object.entries(filters).every(([key, value]) => record[key as keyof typeof filters] === value));
  }

  async get(id: string): Promise<ContentRecord | null> {
    const rows = (await this.sql`SELECT * FROM articles WHERE id = ${id}`) as unknown as ArticleRow[];
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async findByFingerprint(fingerprint: string): Promise<ContentRecord | null> {
    const rows = (await this.sql`SELECT * FROM articles WHERE fingerprint = ${fingerprint}`) as unknown as ArticleRow[];
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async createDraft(record: ContentRecord): Promise<{ record: ContentRecord; created: boolean }> {
    const rows = (await this.sql`
      INSERT INTO articles (
        id, project_id, topic_id, kind, locale, category, slug, title, excerpt, body,
        images, source_urls, seo, status, fingerprint, revision, created_at, updated_at
      ) VALUES (
        ${record.id}, ${record.projectId}, ${record.topicId}, ${record.kind}, ${record.locale}, ${record.category},
        ${record.slug}, ${record.title}, ${record.excerpt}, ${record.body},
        ${JSON.stringify(record.images)}::jsonb, ${JSON.stringify(record.sourceUrls)}::jsonb, ${JSON.stringify(record.seo)}::jsonb,
        ${record.status}, ${record.fingerprint}, ${record.revision}, ${record.createdAt}, ${record.updatedAt}
      )
      ON CONFLICT (fingerprint) DO NOTHING
      RETURNING *
    `) as unknown as ArticleRow[];
    if (rows[0]) return { record: rowToRecord(rows[0]), created: true };
    const existing = await this.findByFingerprint(record.fingerprint);
    if (!existing) throw new Error(`Failed to create or find draft: ${record.fingerprint}`);
    return { record: existing, created: false };
  }

  async update(record: ContentRecord, expectedRevision: number): Promise<ContentRecord> {
    const rows = (await this.sql`
      UPDATE articles SET
        title = ${record.title},
        excerpt = ${record.excerpt},
        body = ${record.body},
        images = ${JSON.stringify(record.images)}::jsonb,
        source_urls = ${JSON.stringify(record.sourceUrls)}::jsonb,
        seo = ${JSON.stringify(record.seo)}::jsonb,
        status = ${record.status},
        revision = revision + 1,
        updated_at = ${new Date().toISOString()},
        published_at = ${record.publishedAt ?? null},
        scheduled_at = ${record.scheduledAt ?? null}
      WHERE id = ${record.id} AND revision = ${expectedRevision}
      RETURNING *
    `) as unknown as ArticleRow[];
    if (rows[0]) return rowToRecord(rows[0]);
    const current = await this.get(record.id);
    if (!current) throw new Error(`Content not found: ${record.id}`);
    throw new Error(`Revision conflict: ${record.id}`);
  }

  async publish(id: string, expectedRevision: number, publishedAt: string): Promise<ContentRecord> {
    const current = await this.get(id);
    if (!current) throw new Error(`Content not found: ${id}`);
    if (current.status === "published") return current;
    if (current.status !== "draft" && current.status !== "scheduled") throw new Error(`Invalid publish transition: ${current.status}`);
    return this.update({ ...current, status: "published", publishedAt }, expectedRevision);
  }
}
