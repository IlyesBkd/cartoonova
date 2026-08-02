import { sql } from "./db";

export interface BlogImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface BlogSeo {
  title: string;
  description: string;
  canonicalPath: string;
  keywords: string[];
}

export interface BlogArticle {
  id: string;
  locale: string;
  category: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  images: BlogImage[];
  seo: BlogSeo;
  publishedAt: string;
  updatedAt: string;
}

let blogSchemaReady: Promise<void> | null = null;

async function ensureBlogSchema(): Promise<void> {
  if (blogSchemaReady) return blogSchemaReady;
  blogSchemaReady = (async () => {
    await sql`
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
    await sql`CREATE INDEX IF NOT EXISTS articles_status_kind_locale_idx ON articles (status, kind, locale)`;
    await sql`CREATE INDEX IF NOT EXISTS articles_locale_slug_idx ON articles (locale, slug)`;
  })().catch((e) => {
    blogSchemaReady = null;
    throw e;
  });
  return blogSchemaReady;
}

function rowToArticle(row: Record<string, unknown>): BlogArticle {
  return {
    id: row.id as string,
    locale: row.locale as string,
    category: row.category as string,
    slug: row.slug as string,
    title: row.title as string,
    excerpt: row.excerpt as string,
    body: row.body as string,
    images: row.images as BlogImage[],
    seo: row.seo as BlogSeo,
    publishedAt: new Date(row.published_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function getPublishedArticles(locale: string, limit = 24, offset = 0): Promise<BlogArticle[]> {
  await ensureBlogSchema();
  const rows = await sql`
    SELECT * FROM articles
    WHERE locale = ${locale} AND status = 'published'
    ORDER BY published_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return (rows as Record<string, unknown>[]).map(rowToArticle);
}

export async function countPublishedArticles(locale: string): Promise<number> {
  await ensureBlogSchema();
  const rows = await sql`SELECT COUNT(*)::int AS c FROM articles WHERE locale = ${locale} AND status = 'published'`;
  return Number((rows[0] as { c: number })?.c ?? 0);
}

export async function getArticleBySlug(locale: string, slug: string): Promise<BlogArticle | null> {
  await ensureBlogSchema();
  const rows = await sql`
    SELECT * FROM articles WHERE locale = ${locale} AND slug = ${slug} AND status = 'published' LIMIT 1
  `;
  const row = (rows as Record<string, unknown>[])[0];
  return row ? rowToArticle(row) : null;
}

export async function getRelatedArticles(locale: string, category: string, excludeId: string, limit = 3): Promise<BlogArticle[]> {
  await ensureBlogSchema();
  const rows = await sql`
    SELECT * FROM articles
    WHERE locale = ${locale} AND status = 'published' AND category = ${category} AND id != ${excludeId}
    ORDER BY published_at DESC
    LIMIT ${limit}
  `;
  return (rows as Record<string, unknown>[]).map(rowToArticle);
}

export interface PublishedArticleRef {
  locale: string;
  slug: string;
  updatedAt: string;
}

export async function getAllPublishedArticleRefs(): Promise<PublishedArticleRef[]> {
  await ensureBlogSchema();
  const rows = await sql`SELECT locale, slug, updated_at FROM articles WHERE status = 'published'`;
  return (rows as Record<string, unknown>[]).map((row) => ({
    locale: row.locale as string,
    slug: row.slug as string,
    updatedAt: new Date(row.updated_at as string).toISOString(),
  }));
}
