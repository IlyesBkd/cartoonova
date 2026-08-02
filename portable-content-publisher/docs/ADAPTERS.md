# HTTP adapter contract

The bundled `http-json` adapters make the engine independent of database and vendor choices. A project gateway can use any database internally as long as it exposes these contracts.

## CMS

- `POST /initialize` receives `{ schemaVersion }`.
- `POST /content/query` receives optional status, type and locale filters.
- `GET /content/:id` returns a record or `null`.
- `GET /content/by-fingerprint/:fingerprint` returns a record or `null`.
- `POST /content` creates a draft idempotently and returns `{ record, created }`.
- `PUT /content/:id` receives `{ record, expectedRevision }`.
- `POST /content/:id/publish` receives `{ expectedRevision, publishedAt }`.

The gateway must enforce a unique fingerprint and compare revisions atomically.

## Search and analytics

- `POST /discover` returns topic candidates.
- `POST /serp` receives `{ query, locale, limit }` and returns ranked results.
- `POST /metrics` receives `{ from, to }` and returns page-level metrics.

## Media and distribution

- `POST /media/select` receives a query, media rules, used sources and allowed domains.
- `POST /outbox` receives a content record and an idempotency key.
- `POST /outbox/drain` returns `{ sent }`.

All endpoints accept an optional bearer token configured through environment-expanded adapter options.
