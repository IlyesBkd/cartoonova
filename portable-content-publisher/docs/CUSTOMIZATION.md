# Customization checklist

## Required

- Project ID, name, public URL, timezone, subject and audience.
- Content types, categories, minimum quality and image counts.
- Locale language, market and publication windows.
- Allowed and denied sources plus attribution rules.
- Daily publication and draft reserve targets for every type and locale.
- AI endpoint, models, attempt limits and daily budgets.
- Search title and description limits, history horizon and protected paths.
- Runtime directories and credentials.

## Adapter responsibilities

- **CMS:** preserve fingerprints, revisions and atomic publish transitions.
- **AI:** return the exact structured generation contract and never bypass budget accounting.
- **Search:** provide fresh candidates and ranked competitor pages.
- **Analytics:** return page-level impressions, clicks, position and engagement.
- **Media:** return verified dimensions, MIME type, byte size and attribution source.
- **Distribution:** use an idempotent outbox and retry failed destinations separately.

## Production acceptance

Do not enable publication until configuration validation, unit tests, residue audit, migration, verification and dry-run all pass. Test one locale and one content type through the target CMS before raising quotas.
