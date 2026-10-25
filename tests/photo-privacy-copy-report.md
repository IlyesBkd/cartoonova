# CRO-05 — local implementation and evidence

## Decision
- No promotional-publication consent is collected by checkout or upload. No checkbox, consent column, opt-in UI or publication workflow is claimed or added.
- Source photos fulfil the order; final portraits are delivered works. Neither may be used for promotion without separate, explicit, revocable authorisation. Ordering/uploading does not grant it. Withdrawal of independently granted permission is routed to support.
- The existing portfolio is populated from `public/` through `galerieAvantApres`, not automatically from newly delivered orders. Existing assets' publication permissions were NOT audited.

## Storage findings (code inspection, no production access)
- `lib/uploadClient.ts` uses Vercel Blob `access: "public"`, including source-photo and final-image purposes. A person holding the URL can access the file; this change does not make storage private.
- Removing a source-photo thumbnail only updates React state (`setPhotos`); it does not delete the uploaded Blob.
- No fixed-schedule image-erasure mechanism was found in app/lib/scripts/cron paths. `vercel.json` is empty; app cron routes cover email/support, retouches and SEO, not image deletion. This does not establish what external infrastructure operators may run.
- Replaced unsupported 90-day promises in CGV/privacy and support-draft facts, plus the dormant 30-day reassurance in all ten message catalogues. Legal copy discloses lack of implemented fixed-schedule erasure, potential retention after delivery, manual request review at support and public-link access. No definite new retention duration is invented.
- Manual handling capability/procedures, copies/backups, external retention settings and real-world deletion outcomes were not verified. Retention governance still needs an operational and legal decision; transparent wording is not an erasure mechanism.

## Files
- Added `components/PhotoPrivacyNotice.tsx` and dedicated ten-language catalogue `lib/i18n/photoPrivacy.ts` (plain text, usable without an intl provider on token pages).
- Mounted notice beside uploads in product `FicheProduit.tsx`, post-payment `DepotClient.tsx`, and poster revision `ConfirmClient.tsx`.
- Targeted clauses in `lib/legal/{fr,en,de,es,it,nl,pl,sv,da,pt}.ts`: CGV 10/12, privacy purposes and storage.
- Only `product.photosDeletedAfter30Days` changed in each shared `messages/*.json`; identifier retained for compatibility, unsupported claim removed.
- `lib/aiReponse.ts`: facts only, no support/API/admin changes.
- Added `tests/photo-privacy-copy.test.mjs`.

## TDD and checks
- RED: actual PageLegale React rendering failed on old promotional opt-out policy; GREEN after ten legal translations aligned.
- RED: actual DepotClient rendering lacked notice/privacy link; GREEN after component+catalogue insertion.
- RED: isolated Chromium rendering of real FicheProduit lacked notice, then real poster revision form lacked it; GREEN after each insertion.
- RED: real next-intl rendering found the old 30-day claim; GREEN after targeted catalogue changes.
- RED: captured actual support-draft request payload still promised 90 days; GREEN after fact correction. Provider transport replaced with a synthetic local response, no external call.
- Final combined command: minimal environment, `node --test tests/photo-privacy-copy.test.mjs tests/product-prices-browser.test.mjs tests/delivery-promise.test.mjs tests/gift-prices-browser.test.mjs`: **44 passed, 0 failed**. Includes 5 CRO-05 tests, ten-language React/intl, mobile Chromium (390x844), real revision interaction, localized privacy destinations, no consent control, catalog parity/ICU and price-flow regressions.
- Existing delivery tests emit Node's MockTimers experimental warning. Browser shell/provider boundaries and CSS are stubbed; this is not a full Next production screenshot or live storage acceptance test.
- Focused ESLint passed. No shared build, commit, push, deployment, DB production access, real uploads or customer action.

## Legal limitation
No legal validation has been performed. The new clauses and translations require qualified legal review, especially retention limits/manual handling and publication authorisation scope. This work does not certify GDPR compliance or permissions for existing portfolio photos.
