import { NextRequest, NextResponse } from 'next/server';
import { refuserSiPasAdmin } from '@/lib/adminAuth';
import { withFreshDatabaseClient } from '@/lib/db';
import { CustomerHistoryError, getCustomerHistory, parseHistoryInput } from '@/lib/customerHistory';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie, Authorization' };
export async function GET(request: NextRequest) {
  const refusal = await refuserSiPasAdmin(request);
  if (refusal) { refusal.headers.set('Cache-Control','private, no-store'); return refusal; }
  try {
    const input = parseHistoryInput(new URL(request.url).searchParams);
    const history = await withFreshDatabaseClient(db => getCustomerHistory(db,input));
    return NextResponse.json(history,{headers});
  } catch (error) {
    if (error instanceof CustomerHistoryError) return NextResponse.json({error:error.message},{status:error.status,headers});
    console.error('[customer-history] history source read unavailable');
    return NextResponse.json({error:'Historique momentanément indisponible.'},{status:503,headers});
  }
}
