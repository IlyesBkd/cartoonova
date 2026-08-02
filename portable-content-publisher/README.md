# Portable Content Publisher

An autonomous engine for multilingual topic discovery, editorial generation, validation, draft inventory, scheduled publication, search optimization, competitor analysis, media checks, performance learning and operational recovery.

The package is intentionally domain-neutral. Project identity and policy live in `config/project.json`; external systems are accessed only through adapters.

## Quick start

```bash
cp config/project.example.json config/project.json
cp .env.example .env
./scripts/install.sh
npm run dry-run
```

The example uses local fixtures, a mock AI adapter and a file CMS. It cannot publish to a public site.

## Main commands

```bash
npm run migrate
npm run verify
npm run dry-run
npm run check
node --import tsx src/app/cli.ts batch
node --import tsx src/app/cli.ts translate
node --import tsx src/app/cli.ts publish
node --import tsx src/app/cli.ts seo:analyze
node --import tsx src/app/cli.ts dashboard
```

## Ownership boundaries

Generic engine files:

- `src/core/`: atomic state, locks, budgets, retries and shared contracts.
- `src/engine/`: discovery, stock, quality, publication and search workflows.
- `src/adapters/contracts.ts`: interfaces that every integration implements.
- `src/app/cli.ts`: commands and worker loops.

Files to personalize:

- `config/project.json`: identity, editorial policy, locales, quotas and schedules.
- `.env`: secrets, endpoints and runtime paths.
- custom classes under `src/adapters/` for the target CMS, search provider, analytics, media store and distribution services.
- `ecosystem.config.cjs`: process count only when one worker per responsibility is insufficient.

Read [Architecture](docs/ARCHITECTURE.md), [Adapter contracts](docs/ADAPTERS.md), [Integration](docs/EXPORT-IMPORT.md), [Customization](docs/CUSTOMIZATION.md), [Differences](docs/DIFFERENCES.md) and [Parity](docs/PARITY.md) before enabling a real adapter.
