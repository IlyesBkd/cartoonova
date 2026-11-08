import { storageReadRoute } from "@/lib/storageRoutes";
export const runtime = "nodejs";
export async function GET(req: Request) { return storageReadRoute(req, true); }
