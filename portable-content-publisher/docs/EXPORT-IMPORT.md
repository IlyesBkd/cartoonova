# Export and integration

## Export

```bash
./scripts/export.sh
```

The archive excludes credentials, dependencies, runtime state, generated content and logs.

## Import into a project

1. Extract the archive into a dedicated service directory.
2. Copy `config/project.example.json` to `config/project.json`.
3. Replace the sample identity, subject, categories, locales, source domains, quotas and windows.
4. Copy `.env.example` to `.env` and set absolute writable paths.
5. Implement or select adapters for the target CMS, AI API, search data, analytics, media and distribution.
6. Run `./scripts/install.sh` with `AI_ADAPTER=mock`.
7. Run `npm run dry-run` and inspect `.tmp/last-dry-run.json`.
8. Run `npm run audit:residue` and `npm run verify`.
9. Point `PROJECT_CONFIG` at the final configuration and start PM2 with `pm2 startOrReload ecosystem.config.cjs --update-env`.
10. Enable a real AI adapter first, then the real CMS adapter. Keep publication in dry mode until generated drafts pass review.

## Migration sequence

Use a staged rollout: local fixtures, read-only external adapters, draft-only CMS writes, one controlled publication, then independent workers. Retain the file adapter as a contract fixture for every future release.
