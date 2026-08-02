# Architecture

## Layers

1. **Project configuration** defines identity, subject, language markets, editorial constraints, source policy, quotas, windows and budgets.
2. **Adapter contracts** isolate all external systems. The engine never issues database-specific statements or infrastructure commands.
3. **Core runtime** provides atomic JSON writes, expiring locks, optimistic revisions, bounded retries, daily AI budgets and a failure circuit breaker.
4. **Editorial engine** ranks topics, computes stock deficits, generates only missing content, validates it and applies a bounded repair pass.
5. **Publication engine** rechecks quality, daily quotas and localized windows before an atomic status transition.
6. **Search engine** combines performance history and competitor result headings into prioritized refresh opportunities.
7. **Operations** expose independent generation, publication and search workers plus structured logs and a dashboard snapshot.

## Safety invariants

- A content fingerprint is unique for project, topic, type and locale.
- A repeated generation run returns the existing draft instead of creating a duplicate.
- A publish transition requires the expected revision and an eligible status.
- The quality gate runs after generation and again immediately before publication.
- AI retries and corrections are finite. Daily call and token ceilings are persistent.
- Repeated AI failures open a time-limited circuit breaker.
- Worker locks expire after a configured TTL to permit recovery after crashes.
- Dry-run mode does not invoke CMS mutation or distribution methods.

## Adding an adapter

Implement the relevant interface from `src/adapters/contracts.ts`, register it in `src/adapters/registry.ts`, then add adapter contract tests. Keep authentication and endpoints in environment-expanded configuration values.
