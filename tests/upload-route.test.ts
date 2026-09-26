import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/upload/route";

process.env.ADMIN_PASSWORD = "test-only-admin-password";
process.env.BLOB_READ_WRITE_TOKEN = "";
process.env.NEWSLETTER_SECRET = "test-only-order-secret";

function requeteUpload(
  pathname: string,
  clientPayload: string,
  options: { origin?: string; adminPassword?: string; ip?: string } = {}
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.origin) headers.set("origin", options.origin);
  if (options.adminPassword) headers.set("x-admin-password", options.adminPassword);
  headers.set("x-forwarded-for", options.ip ?? "198.51.100.20");

  return new NextRequest("https://www.cartoonova.com/api/upload", {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: { pathname, multipart: false, clientPayload },
    }),
  });
}

test("refuse une émission de jeton checkout depuis une autre origine", async () => {
  const request = requeteUpload(
    "orders/123e4567-e89b-12d3-a456-426614174000.jpg",
    JSON.stringify({ scope: "checkout" }),
    { origin: "https://site-attaquant.example" }
  );

  const response = await POST(request);
  assert.equal(response.status, 403);
});

test("exige l'authentification admin pour le dossier des images finales", async () => {
  const request = requeteUpload(
    "final/cartoonova-123e4567-e89b-12d3-a456-426614174000.jpg",
    JSON.stringify({ scope: "admin" }),
    { origin: "https://www.cartoonova.com" }
  );

  const response = await POST(request);
  assert.equal(response.status, 401);
});

test("refuse un jeton de commande invalide avant de contacter Blob", async () => {
  const request = requeteUpload(
    "orders/123e4567-e89b-12d3-a456-426614174000.jpg",
    JSON.stringify({ scope: "order", token: `123e4567-e89b-12d3-a456-426614174000.${"0".repeat(32)}` }),
    { origin: "https://www.cartoonova.com" }
  );

  const response = await POST(request);
  assert.equal(response.status, 403);
});

test("les jetons de commande invalides ne consomment pas le quota d'émission autorisée", async () => {
  const jetonInvalide = `123e4567-e89b-12d3-a456-426614174000.${"0".repeat(32)}`;

  for (let tentative = 0; tentative < 25; tentative += 1) {
    const request = requeteUpload(
      "orders/123e4567-e89b-12d3-a456-426614174000.jpg",
      JSON.stringify({ scope: "order", token: jetonInvalide }),
      { origin: "https://www.cartoonova.com", ip: "198.51.100.22" }
    );
    const response = await POST(request);
    assert.equal(response.status, 403, `tentative ${tentative + 1}`);
  }
});
