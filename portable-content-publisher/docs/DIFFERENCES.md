# Differences from the source system

This package is a clean extraction rather than a renamed copy.

| Source behavior | Portable behavior |
| --- | --- |
| Direct CMS schema access | Versioned `CmsAdapter` contract |
| Host commands in workflows | No infrastructure command in the engine |
| Fixed site identity and URLs | Project configuration and environment expansion |
| Sector-specific categories and vocabulary | Arbitrary content types, categories and editorial policy |
| Fixed language assumptions | Arbitrary locales, markets and midnight-crossing windows |
| Runtime paths embedded in process definitions | Root-relative or environment-provided paths |
| Provider choices spread across workers | Central adapter registry |
| Generation pressure driven by process settings | Persistent daily budget, finite corrections and circuit breaker |
| Publication coupled to generated records | Revalidated atomic transition with revision control |
| Search reports tied to one data source | Search and analytics contracts with versioned refresh backups |

The extraction preserves stock deficit calculation, quotas, language scheduling, idempotency, deduplication, quality gates, bounded repair, image checks, competitor gaps, performance cohorts, link audits, outbox distribution, structured logs, worker locks and recovery controls.
