import {giftGuideMeasurementRequest} from "../../../../lib/giftGuideServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deliberately has NO consent/store/checkout adapter. Setting a public flag,
 * sending consent:true, or even enabling the server gate cannot start collection.
 * The disposable executable contract is tests/gift-guide-server-postgres.test.mjs.
 */
export async function POST(request: Request) {
  return giftGuideMeasurementRequest(request, {enabled: process.env.GIFT_GUIDE_SERVER_MEASUREMENT === "1"});
}
export async function DELETE(request: Request) {
  return POST(request);
}
