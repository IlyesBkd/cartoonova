# Next.js storage integration

## Public server exports (`@/lib/storage`)
- `isVpsReference(value): boolean` — strict canonical parser; client must duplicate grammar, never import server module.
- `vpsStorageEnabled(): boolean` — exact `CARTOONOVA_STORAGE_PROVIDER === 'vps'`; default false.
- `uploadVpsServerObject(bytes, namespace, contentType): Promise<string>` — trusted server-only generated files, new immutable reference, completed only after the VPS bytes are read back and their SHA-256 verified. No secondary copy anywhere. Namespace `extras` or `extras/<orderUUID>` supports PDF.
- `readStoredObject(reference): Promise<{bytes: Buffer, contentType: string}>` — trusted server-only read, mandatory complete registry for VPS, read from the VPS only (no fallback copy). Legacy public Vercel Blob URLs of the configured store are still read as before. Not an authorization boundary; caller must authorize user first.
- `storageEmailUrl(reference): string` — synchronous; legacy unchanged; VPS durable file/version READ-only capability at `/api/storage/email`, no order token or VPS grant.

## Browser contract
`POST /api/upload/context` adds `provider:'vps'` only while feature enabled. Legacy remains unchanged otherwise.
Browser computes SHA-256, calls `POST /api/upload/vps-grant` with `{pathname,context,sha256,size,contentType}`, then raw PUT to returned `{url,grant,reference}`, Authorization `Bearer <grant>`. Finally `POST /api/upload/complete` with `{reference,context}`. Only completed references can be attached/read. An upload failure consumes its immutable path/quota: start with a fresh file UUID, never replay PUT.

Canonical references: `vps://private/{orders|retouches|final|extras}/{contextUUID}/{fileUUID}.{extension}`. URL pathname remains compatible with reservation ledger. Service id = SHA-256(canonical pathname).slice(0,32). Service origin configured exclusively by `STORAGE_VPS_ORIGIN`, HTTPS exact origin. All grants expire in <=120 seconds.

Display: `/api/storage/read?ref=<encoded canonical>&token=<tracking>&posterToken=<preview>`; include only relevant tokens, same-origin cookies automatic. No generic signer, redirects, URL hosts, grants or namespace-level capabilities in reads/emails.

## Rollout
Additive migration must be applied separately before flag activation. No migration application or infrastructure mutation by this integration. Runtime secrets only: `STORAGE_HMAC_SECRET` (the existing Blob credential stays for legacy uploads/reads only). Legacy URLs and data remain unchanged. Decision 2026-11-08: no copy of new VPS files is made in Vercel Blob or elsewhere; new files exist only on the VPS, so losing the VPS disk loses them unless a separate VPS-level backup is set up. Losing/rotating the secret without retaining the old key invalidates durable email signatures. Completed VPS references remain readable when feature is switched off; new VPS writes are disabled.

## Verified scope and remaining activation work
- `tests/vps-storage-backend.test.mjs`: 21 isolated tests; VPS service/database mocked, no external network, and any request outside the VPS origin fails the test. With `tests/storage-ui-email.test.mjs` and `tests/storage-ui-browser.test.mjs`: **46 passed, 0 failed** (2026-11-08). `npm run lint`: **0 errors**.
- The PUT `201` alone never completes a file: the VPS object is fetched back with a signed GET, without redirects, and its size, SHA-256 and content type compared with the registry before the transaction commits. Concurrent/retried finalization uses a row lock; a failed check leaves the row `pending`.
- If the VPS read fails or the bytes do not match, the read fails closed: there is no fallback copy. Nothing from new VPS writes goes to Vercel Blob. Existing legacy public files are not deleted, rewritten, or made private by this change.
- Migration includes nullable unique `legacy_url` for a future progressive copier. No copier/migration runner or runtime legacy-to-VPS mapping is supplied here; parent owns that follow-up. Existing legacy delivery references/snapshots/fingerprints are untouched.
- User-facing read requires admin session, matching checkout reservation/session, or paid order tracking membership / current preview snapshot. Extras generated server-side are delivered through their per-file email capability, not a guessed namespace. Final attachment requires completed metadata plus the exact `admin:<orderId>` reservation.
- Ordinary photo MIME/size/hash are verified, not transcoded or malware-scanned. Final portraits retain existing Sharp signature, full decode, dimension, pixel and timeout checks.
- HTTPS/service activation, migration rehearsal/application, deployment and live provider verification remain separate approval steps. No claim of a live installation is made.
