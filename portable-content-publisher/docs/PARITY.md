# Functional parity

| Capability | Portable implementation |
| --- | --- |
| Automated topic research | `SearchAdapter.discover` plus weighted ranking |
| Generation and correction | Structured `AiAdapter` with bounded retries and repairs |
| Multiple content families | Arbitrary configured content types and categories |
| Multilingual versions | Locale configuration and missing-translation workflow |
| Draft stock and quotas | Deficit calculation by type and locale |
| Localized publication | Timezone-aware windows, including midnight crossing |
| Search analytics | Performance metrics, ranked result gaps and refresh report |
| Existing content optimization | Opportunity report with protected paths and competitor gaps |
| Performance learning | Persistent metrics contract and dashboard budget snapshot |
| Image control | Dimensions, size, MIME type and source diversity gate |
| Duplicate and link checks | Stable fingerprints and external source audit |
| Dashboards and logs | JSON dashboard, structured logs and persistent state |
| Recovery | TTL locks, optimistic revisions, retries and circuit breaker |
| Workers and PM2 | Separate portable generation, publication and search processes |

Project-specific database statements, infrastructure commands, URLs, identities, categories and editorial assumptions are deliberately absent. Production integrations belong in project adapters.
