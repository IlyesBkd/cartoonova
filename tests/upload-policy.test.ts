import assert from "node:assert/strict";
import test from "node:test";
import {
  consommerQuotaUpload,
  FENETRE_UPLOAD_MS,
  lireCorpsBorne,
  parseUploadIntent,
  pathnameAutoriseUpload,
} from "../lib/uploadPolicy";

const uuid = "123e4567-e89b-12d3-a456-426614174000";
const tokenCommande = `${uuid}.${"a".repeat(32)}`;
const tokenRetouche = "a".repeat(48);

test("refuse une intention d'upload absente, mal formée ou inconnue", () => {
  assert.equal(parseUploadIntent(null), null);
  assert.equal(parseUploadIntent("pas du JSON"), null);
  assert.equal(parseUploadIntent(JSON.stringify({ scope: "admin", token: "secret" })), null);
  assert.equal(parseUploadIntent(JSON.stringify({ scope: "order", token: "invalide" })), null);
});

test("reconnaît les intentions publiques et les jetons de commande/retouche au bon format", () => {
  assert.deepEqual(parseUploadIntent(JSON.stringify({ scope: "checkout" })), { scope: "checkout" });
  assert.deepEqual(parseUploadIntent(JSON.stringify({ scope: "order", token: tokenCommande })), {
    scope: "order",
    token: tokenCommande,
  });
  assert.deepEqual(parseUploadIntent(JSON.stringify({ scope: "retouch", token: tokenRetouche })), {
    scope: "retouch",
    token: tokenRetouche,
  });
  assert.deepEqual(parseUploadIntent(JSON.stringify({ scope: "admin" })), { scope: "admin" });
});

test("borne chaque intention à son dossier Blob et refuse les chemins traversants", () => {
  assert.equal(pathnameAutoriseUpload("checkout", `orders/${uuid}.jpg`), true);
  assert.equal(pathnameAutoriseUpload("order", `orders/${uuid}.heic`), true);
  assert.equal(pathnameAutoriseUpload("retouch", `retouches/${uuid}.png`), true);
  assert.equal(pathnameAutoriseUpload("admin", `final/cartoonova-${uuid}.webp`), true);
  assert.equal(pathnameAutoriseUpload("checkout", `final/cartoonova-${uuid}.jpg`), false);
  assert.equal(pathnameAutoriseUpload("retouch", `retouches/../orders/${uuid}.jpg`), false);
  assert.equal(pathnameAutoriseUpload("admin", `final/${uuid}.svg`), false);
});

test("limite les émissions de jetons par clé puis libère le quota après la fenêtre", () => {
  const key = `test-upload-${uuid}`;
  const now = 1_900_000_000_000;
  assert.equal(consommerQuotaUpload(key, 2, now).autorise, true);
  assert.equal(consommerQuotaUpload(key, 2, now + 1).autorise, true);

  const bloque = consommerQuotaUpload(key, 2, now + 2);
  assert.equal(bloque.autorise, false);
  assert.equal(bloque.reessayerDans, 600);

  assert.equal(consommerQuotaUpload(key, 2, now + FENETRE_UPLOAD_MS + 1).autorise, true);
});

test("interrompt la lecture du corps dès que la taille maximale est dépassée", async () => {
  let lectures = 0;
  let annule = false;
  const corps = new ReadableStream<Uint8Array>({
    pull(controller) {
      lectures += 1;
      controller.enqueue(new Uint8Array(1024));
    },
    cancel() {
      annule = true;
    },
  });

  assert.equal(await lireCorpsBorne(corps, 512), null);
  assert.equal(lectures, 1);
  assert.equal(annule, true);
});
