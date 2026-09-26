import assert from "node:assert/strict";
import test from "node:test";
import { creerCheminPhoto, TYPES_PHOTO_AUTORISES } from "../lib/photoUpload";

test("ne met pas le nom d'origine de la photo dans le chemin public", () => {
  const photo = creerCheminPhoto("orders", "image/jpeg", "nom-personnel.jpg");
  assert.match(photo?.pathname ?? "", /^orders\/[0-9a-f-]{36}\.jpg$/i);
  assert.equal(photo?.contentType, "image/jpeg");
  assert.notEqual(photo?.pathname, creerCheminPhoto("orders", "image/jpeg")?.pathname);
});

test("utilise des extensions cohérentes avec les MIME acceptés", () => {
  assert.equal(creerCheminPhoto("retouches", "image/heic")?.pathname.endsWith(".heic"), true);
  assert.equal(creerCheminPhoto("final", "image/webp")?.pathname.startsWith("final/cartoonova-"), true);
  assert.equal(creerCheminPhoto("orders", "image/gif"), null);
  assert.equal(creerCheminPhoto("orders", "", "photo.HEIC")?.contentType, "image/heic");
  assert.equal(creerCheminPhoto("orders", "", "document.gif"), null);
  assert.deepEqual(TYPES_PHOTO_AUTORISES, [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);
});
