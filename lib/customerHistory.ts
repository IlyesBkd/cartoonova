import type postgres from 'postgres';
import type { CustomerHistory, CustomerHistoryEvent } from './customerHistoryTypes';
export class CustomerHistoryError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
type Cursor = { v: 1; scope: string; snapshot: string; at: string | null; id: string };
export type HistoryInput = { orderId: string | null; supportMessageId: number | null; limit: number; cursor: Cursor | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseHistoryInput(params: URLSearchParams): HistoryInput {
  const orderId = params.get('orderId'); const support = params.get('supportMessageId');
  const limitRaw = params.get('limit'); const limit = limitRaw === null ? 50 : Number(limitRaw);
  if (params.getAll('orderId').length > 1 || params.getAll('supportMessageId').length > 1 ||
      Boolean(orderId) === Boolean(support) || (orderId !== null && !uuid.test(orderId)) ||
      (support !== null && (!/^[1-9]\d{0,9}$/.test(support) || Number(support) > 2147483647)) ||
      (limitRaw !== null && !/^\d+$/.test(limitRaw)) || !Number.isInteger(limit) || limit < 20 || limit > 100) {
    throw new CustomerHistoryError('Paramètres invalides.', 400);
  }
  let cursor: Cursor | null = null;
  const raw = params.get('cursor');
  if (raw !== null) {
    try {
      if (raw.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw Error();
      cursor = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      const scope = orderId ? `order:${orderId}` : `support:${support}`;
      if (!cursor || cursor.v !== 1 || cursor.scope !== scope || typeof cursor.snapshot !== 'string' ||
          !/^\d{4}-\d\d-\d\dT/.test(cursor.snapshot) || !Number.isFinite(Date.parse(cursor.snapshot)) ||
          (cursor.at !== null && (typeof cursor.at !== 'string' || !Number.isFinite(Date.parse(cursor.at)))) ||
          typeof cursor.id !== 'string' || cursor.id.length > 512) throw Error();
    } catch { throw new CustomerHistoryError('Curseur invalide.', 400); }
  }
  return { orderId, supportMessageId: support ? Number(support) : null, limit, cursor };
}
const lit = (s: string) => `'${s.replaceAll("'", "''")}'`;
const states: Record<string, string> = {
  pending: 'En attente', confirmed: 'Validé', retouch: 'Retouche demandée', retouch_requested: 'Retouche demandée',
  revision_requested: 'Retouche demandée', changes_requested: 'Retouche demandée', in_progress: 'En cours', paid: 'Payée', completed: 'Terminée',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée', canceled: 'Annulée',
  awaiting_photos: 'En attente des photos', awaiting_payment: 'En attente du paiement', PENDING: 'En attente du paiement',
  non_payee: 'Non payée', a_traiter: 'À traiter', photos: 'En attente des photos', retouche: 'Retouche à réaliser',
  a_imprimer: 'À imprimer', attente_client: 'En attente du client', new: 'Nouvelle', envoi_programme: 'Envoi programmé', a_envoyer: 'À envoyer',
  publie: 'Publié', en_attente: 'En attente', rejete: 'Refusé',
};
const absent = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
function readable(v: unknown, field = ''): string {
  if (absent(v)) return 'Aucun';
  if (Array.isArray(v)) return v.map(x => readable(x, field)).join('\n');
  if (typeof v === 'object') {
    // Shipping presentation is allowlisted: no supplier payload / foreign IDs.
    const x = v as Record<string, unknown>;
    return ['number','url','carrier','trackingNumber','trackingUrl','transporteur','numero'].flatMap(k =>
      absent(x[k]) ? [] : [String(x[k])]).join(' — ') || 'Informations enregistrées';
  }
  const text = String(v);
  if (field.includes('status') || field === 'statut_force' || field === 'statut') return states[text] ?? 'Autre état enregistré';
  if (field === 'cout') return `${text} €`;
  if (field.endsWith('_at') || field === 'expedie_le') {
    const d = new Date(text);
    if (Number.isFinite(d.getTime())) return d.toLocaleString('fr-FR', { timeZone: 'UTC' }) + ' (UTC)';
  }
  return text;
}
function presentEvent(event: CustomerHistoryEvent): CustomerHistoryEvent {
  let title = event.title;
  const details: string[] = [];
  for (const line of (event.details ?? '').split('\n').filter(Boolean)) {
    let d: Record<string, unknown>;
    try { d = JSON.parse(line); } catch { details.push(line); continue; }
    if (!d || typeof d !== 'object') continue;
    if (typeof d.field === 'string') {
      const f = d.field, before = d.before, after = d.after;
      const added = absent(before), removed = absent(after);
      const titles: Record<string, string> = {
        photo_urls: removed ? 'Photos retirées' : added ? 'Photos reçues' : 'Photos modifiées',
        final_image_url: removed ? 'Portrait retiré' : added ? 'Portrait enregistré' : 'Portrait remplacé',
        final_image_scheduled_at: removed ? 'Envoi annulé' : added ? 'Envoi programmé' : 'Envoi reprogrammé',
        poster_confirmation_image_url: removed ? 'Aperçu retiré' : 'Aperçu préparé',
        poster_confirmation_sent_at: 'Aperçu préparé (envoi non prouvé)',
        poster_confirmation_status: after === 'confirmed' ? 'Portrait validé' : ['retouch','retouch_requested','revision_requested','changes_requested'].includes(String(after)) ? 'Retouche demandée' : 'Validation modifiée',
        poster_confirmation_responded_at: 'Réponse à l’aperçu enregistrée',
        poster_confirmation_note: 'Note du client modifiée', poster_confirmation_photos: 'Photos de retouche modifiées',
        status: 'Statut modifié', statut_force: 'Statut modifié', fournisseur_ref: 'Impression référencée',
        cout: 'Coût enregistré', cout_note: 'Note de coût enregistrée', suivi_url: 'Suivi enregistré',
        suivi_transporteur: 'Transporteur enregistré', shipping_details: 'Suivi enregistré', expedie_le: 'Expédition enregistrée',
      };
      title = titles[f] ?? 'Modification enregistrée';
      if (f === 'poster_confirmation_sent_at') details.push('Cette date indique la préparation de l’aperçu, pas la confirmation de son envoi.');
      details.push(`Avant : ${readable(before, f)}\nAprès : ${readable(after, f)}`);
    } else if (typeof d.currentField === 'string') {
      details.push('État courant enregistré ; date inconnue.');
      details.push(readable(d.value, d.currentField));
      if (d.carrier && d.currentField !== 'suivi_transporteur') details.push(`Transporteur : ${readable(d.carrier)}`);
    } else if (d.deliveryHistory && typeof d.deliveryHistory === 'object') {
      const h = d.deliveryHistory as Record<string, unknown>;
      if (event.kind === 'delivery.final_image' && event.status === 'sent') {
        if (h.mode === 'retouch') title = 'Portrait retouché envoyé';
        else if (h.mode === 'initial') title = 'Portrait envoyé';
      }
      if (typeof h.recipient === 'string') details.push(`Destinataire : ${h.recipient}`);
      if (typeof h.portraitUrl === 'string') details.push(`Portrait : ${h.portraitUrl}`);
      if (typeof h.sentAt === 'string' && event.status === 'sent') details.push(`Envoi confirmé le ${readable(h.sentAt, 'sent_at')}`);
      else if (event.status === 'sent') details.push('Envoi confirmé après vérification ; date exacte d’envoi non conservée.');
    } else {
      if (Array.isArray(d.attachments) && d.attachments.length) details.push(`Pièces jointes : ${d.attachments.map(String).join(', ')}`);
      if (Array.isArray(d.photos) && d.photos.length) details.push(`Photos : ${readable(d.photos)}`);
      if (typeof d.supplierRef === 'string') details.push(`Référence imprimeur : ${d.supplierRef}`);
      if (d.tracking) details.push(`Suivi : ${readable(d.tracking)}`);
    }
  }
  return { ...event, title, details: details.join('\n') || null };
}
/** Each source has an explicit presentation allowlist, never SELECT * payloads.
 * Pagination and deduplication run in PostgreSQL, not over global JS lists. */
export async function getCustomerHistory(db: ReturnType<typeof postgres>, input: HistoryInput): Promise<CustomerHistory> {
  const warnings = ['Historique partiel : les anciennes photos, validations, programmations et certains emails ont pu être écrasés ou ne pas avoir été journalisés.'];
  const sourceNames = ['support_messages','support_replies','support_prepared_replies','retouches','order_delivery_effects','email_outbox','order_shipping_effects','reviews','customer_history_events'];
  const available = await db`SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY(${sourceNames}::text[])`;
  const tables = new Set(available.map(r => String(r.tablename)));
  for (const name of sourceNames) if (!tables.has(name)) warnings.push(`Source indisponible : ${name}.`);
  let email: string; let name: string | null; let explicit: string | null = null;
  if (input.orderId) {
    const [target] = await db`SELECT customer_email,customer_name FROM orders WHERE id=${input.orderId}::uuid`;
    if (!target) throw new CustomerHistoryError('Commande introuvable.',404);
    email = String(target.customer_email).trim().toLowerCase(); name = target.customer_name ?? null;
  } else {
    if (!tables.has('support_messages')) throw new CustomerHistoryError('Support indisponible.',503);
    const [target] = await db`SELECT from_email,order_id FROM support_messages WHERE id=${input.supportMessageId!}`;
    if (!target) throw new CustomerHistoryError('Message introuvable.',404);
    email = String(target.from_email).trim().toLowerCase(); explicit = target.order_id ?? null; name = null;
  }
  if (!email) throw new CustomerHistoryError('Identité client indisponible.',503);
  const orders = await db`SELECT id,created_at,customer_name FROM orders
    WHERE lower(btrim(customer_email))=${email} OR id=${explicit}::uuid ORDER BY created_at DESC,id DESC`;
  const ids = orders.map(o => String(o.id));
  // Never follow the alternative email of an explicitly linked order.
  // The database clock writes events in microseconds; an app-side snapshot in
  // milliseconds (or a lagging app clock) would hide the newest events.
  const snapshot = input.cursor?.snapshot ?? String((await db`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS s`)[0].s);
  const scope = input.orderId ? `order:${input.orderId}` : `support:${input.supportMessageId}`;
  const pieces: string[] = [];
  const add = (source: string, from: string, where: string, id: string, at: string, kind: string, title: string, orderIds: string,
    status = "'recorded'", subject = 'NULL::text', body = 'NULL::text', details = 'NULL::text', key = 'NULL::text', priority = 10) => {
    pieces.push(`SELECT (${id})::text id,(${at})::timestamptz at,(${kind})::text kind,(${title})::text title,${lit(source)}::text source,
      (${orderIds})::text[] order_ids,(${status})::text status,(${subject})::text subject,(${body})::text body,(${details})::text details,
      (${key})::text mail_key,${priority} priority FROM ${from} WHERE ${where}`);
  };
  const own = 'order_id::text=ANY($2::text[])';
  const ownRow = 'ARRAY[order_id::text]';
  add('orders', 'orders o CROSS JOIN LATERAL (VALUES\n' + [
    ['created_at','order.created','Commande créée','recorded'],['paid_at','order.paid','Paiement enregistré','recorded'],
    ['photos_received_at','order.photos','Photos reçues','recorded'],['photos_updated_at','order.photos_updated','Photos modifiées','recorded'],
    ['final_image_sent_at','order.final_image','Portrait livré (trace historique)','sent'],
    ['poster_confirmation_sent_at','order.preview','Aperçu préparé (envoi non prouvé par cette date seule)','recorded'],
    ['poster_confirmation_responded_at','order.preview_response','Réponse à l’aperçu','recorded'],
    ['expedie_le','order.shipping','Expédition enregistrée','recorded'],
    ['expedition_email_envoye_le','order.shipping_email','Email d’expédition (trace historique)','sent'],
    ['review_request_sent_at','order.review_request','Demande d’avis : état historique enregistré','recorded'],
  ].map(([field,kind,title,status]) => `(${lit(field)},to_jsonb(o)->>${lit(field)},${lit(kind)},${lit(title)},${lit(status)})`).join(',\n') + ') v(field,stamp,kind,title,state)',
    `o.id::text=ANY($2::text[]) AND v.stamp IS NOT NULL
      AND NOT(v.field='final_image_sent_at' AND EXISTS(SELECT 1 FROM delivery_present d WHERE d.order_id=o.id::text))
      AND NOT(v.field IN ('expedie_le','expedition_email_envoye_le') AND EXISTS(SELECT 1 FROM shipping_present s WHERE o.id::text=ANY(s.order_ids)))`,
    "'orders:'||o.id||':'||v.field", 'v.stamp', 'v.kind', 'v.title', 'ARRAY[o.id::text]', 'v.state', 'NULL::text',
    "CASE WHEN v.field='poster_confirmation_responded_at' THEN to_jsonb(o)->>'poster_confirmation_note' ELSE NULL END",
    "CASE WHEN v.field='paid_at' THEN 'Date historique : peut avoir été reconstruite lors de la migration paid_at.' WHEN v.field='review_request_sent_at' THEN 'État courant de la commande, pas un envoi supplémentaire. Aucun lien explicite avec un email du journal : les messages distincts restent visibles.' ELSE 'État historique courant ; les versions antérieures peuvent manquer.' END");
  // Current-only traces must remain visible, but never receive an invented date.
  add('orders', `orders o CROSS JOIN LATERAL (VALUES
    ('fournisseur_ref','Impression référencée'),('cout','Coût enregistré'),('cout_note','Note de coût enregistrée'),
    ('suivi_url','Suivi enregistré'),('suivi_transporteur','Transporteur enregistré'),('shipping_details','Suivis enregistrés')
  ) v(field,label)`, `o.id::text=ANY($2::text[]) AND to_jsonb(o)->>v.field IS NOT NULL
    ${tables.has('customer_history_events') ? `AND NOT EXISTS(SELECT 1 FROM customer_history_events j WHERE j.order_id=o.id AND j.details->>'field'=v.field AND j.details->'after'=to_jsonb(o)->v.field AND j.at <= $3::timestamptz)` : ''}`,
    "'current:'||o.id||':'||v.field",'NULL',"'order.current.'||v.field","v.label||' (date inconnue)'",'ARRAY[o.id::text]',"'recorded'",'NULL','NULL',
    `jsonb_build_object('currentField',v.field,'value',CASE WHEN v.field='shipping_details' THEN (to_jsonb(o)->'shipping_details')->'tracking' ELSE to_jsonb(o)->v.field END,'carrier',to_jsonb(o)->>'suivi_transporteur')::text`);
  // A scheduled date is a planned time, not the date of an action.
  add('orders','orders o',"o.id::text=ANY($2::text[]) AND to_jsonb(o)->>'final_image_scheduled_at' IS NOT NULL", "'schedule:'||o.id",'NULL',"'order.schedule'","'Portrait programmé'",'ARRAY[o.id::text]',"'scheduled'",'NULL','NULL',"'Date prévue : '||(to_jsonb(o)->>'final_image_scheduled_at')");
  if (tables.has('retouches')) add('retouches','retouches',own,"'retouche:'||id",'demandee_le',"'retouch.request'","'Retouche demandée'",ownRow,"'recorded'",'NULL','note',"jsonb_build_object('photos',photos)::text");
  const messageMatch = '(lower(btrim(from_email))=$1 OR order_id::text=ANY($2::text[]))';
  if (tables.has('support_messages')) add('support_messages','support_messages',messageMatch,"'message:'||id",'received_at',"CASE WHEN message_id LIKE 'chat-%' THEN 'chat' WHEN message_id LIKE 'contact-%' THEN 'contact' ELSE 'email.incoming' END","'Message reçu'","CASE WHEN order_id::text=ANY($2::text[]) THEN ARRAY[order_id::text] ELSE ARRAY[]::text[] END", "'recorded'",'subject','body_text');
  const replyMatch = `(lower(btrim(to_email))=$1 OR ${own}${tables.has('support_messages') ? ` OR support_message_id IN (SELECT id FROM support_messages WHERE ${messageMatch})` : ''})`;
  const filteredOrder = "CASE WHEN order_id::text=ANY($2::text[]) THEN ARRAY[order_id::text] ELSE ARRAY[]::text[] END";
  if (tables.has('support_replies')) add('support_replies','support_replies',replyMatch,"'reply:'||id",'sent_at',"'email.outgoing'","'Réponse envoyée'",filteredOrder,"'sent'",'subject','body_text','NULL',"'provider:'||provider_id",20);
  if (tables.has('support_prepared_replies')) add('support_prepared_replies','support_prepared_replies p',
    `(lower(btrim(to_email))=$1 OR frozen_order_id::text=ANY($2::text[]) ${tables.has('support_messages') ? ` OR (target_type='message' AND target_id IN (SELECT id::text FROM support_messages WHERE ${messageMatch}))` : ''})
      AND status IN ('sent','sending','uncertain') ${tables.has('support_replies') ? 'AND NOT EXISTS(SELECT 1 FROM support_replies r WHERE r.id=p.reply_id)' : ''}`,
    "'prepared:'||id","COALESCE(provider_sent_at,created_at)","'email.outgoing'","CASE WHEN status='sent' THEN 'Réponse envoyée' ELSE 'Réponse : résultat incertain' END",
    "CASE WHEN frozen_order_id::text=ANY($2::text[]) THEN ARRAY[frozen_order_id::text] ELSE ARRAY[]::text[] END",
    "CASE WHEN status='sent' THEN 'sent' ELSE 'uncertain' END",'subject','body_text','NULL',"'provider:'||provider_id",15);
  if (tables.has('order_delivery_effects')) add('order_delivery_effects','order_delivery_effects',own,
    "'delivery:'||order_id||':'||kind||':'||version",`CASE WHEN status='sent' AND pg_input_is_valid(artifacts#>>'{deliveryHistory,sentAt}','timestamp with time zone') THEN (artifacts#>>'{deliveryHistory,sentAt}')::timestamptz ELSE updated_at END`,"'delivery.'||kind",
    "CASE WHEN kind='extras' THEN 'Extras numériques' ELSE 'Livraison de portrait (version enregistrée)' END",ownRow,
    "CASE WHEN status='sent' THEN 'sent' WHEN status='preparing' THEN 'recorded' ELSE 'uncertain' END",'NULL','NULL',
    `CASE WHEN kind='final_image' AND jsonb_typeof(artifacts->'deliveryHistory')='object' THEN jsonb_build_object('deliveryHistory',artifacts->'deliveryHistory')::text ELSE 'Version : '||version||'. Le journal ancien ne conserve ni portrait historique ni destinataire ; retouche non déduite du numéro de version. Date de dernière mise à jour du journal.' END`, "'provider:'||email_id",30);
  if (tables.has('order_shipping_effects')) add('order_shipping_effects','order_shipping_effects e',
    "EXISTS(SELECT 1 FROM jsonb_array_elements_text(details->'orderIds') x WHERE x=ANY($2::text[]))", "'shipping:'||supplier_ref",'updated_at',"'shipping.group'","'Expédition groupée'",
    "ARRAY(SELECT x FROM jsonb_array_elements_text(details->'orderIds') x WHERE x=ANY($2::text[]) ORDER BY x)",
    "CASE WHEN status='sent' THEN 'sent' ELSE 'uncertain' END",'NULL','NULL',"jsonb_build_object('supplierRef',supplier_ref,'tracking',details->'tracking')::text", "'provider:'||email_id",30);
  if (tables.has('reviews')) add('reviews','reviews',own,"'review:'||id",'cree_le',"'review'","'Avis reçu'",ownRow,"'recorded'",'NULL','texte',"'Note : '||note||'/5 ; statut : '||statut");
  if (tables.has('email_outbox')) add('email_outbox','email_outbox e',
    `(CASE WHEN jsonb_typeof(payload->'to')='array' THEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(payload->'to') x WHERE lower(btrim(x))=$1) ELSE lower(btrim(payload->>'to'))=$1 END)`,
    "'outbox:'||event_key",'COALESCE(sent_at,first_attempt_at,created_at)',"'email.outgoing'","'Email (file d’envoi)'",'ARRAY[]::text[]',
    "CASE WHEN sent_at IS NOT NULL THEN 'sent' WHEN exhausted_at IS NOT NULL THEN 'failed' WHEN lease_until IS NOT NULL THEN 'uncertain' ELSE 'scheduled' END",
    "payload->>'subject'","COALESCE(payload->>'text',regexp_replace(regexp_replace(payload->>'html','<(style|script)[^>]*>.*?</(style|script)>','','gis'),'<[^>]+>',' ','g'))",'NULL',"'outbox:'||event_key",5);
  // Exact ledger links recover gift delivery content without following the
  // gift recipient's mailbox, support messages, or unrelated orders.
  const ledgerMailMatch = [
    tables.has('order_delivery_effects') ? `EXISTS(SELECT 1 FROM order_delivery_effects d WHERE d.order_id::text=ANY($2::text[]) AND
      ((d.email_id IS NOT NULL AND d.email_id=provider_id) OR details->>'idempotencyKey'='delivery/'||d.order_id||'/'||d.kind||'/'||d.version))` : '',
    tables.has('order_shipping_effects') ? `EXISTS(SELECT 1 FROM order_shipping_effects d WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(d.details->'orderIds') x WHERE x=ANY($2::text[])) AND
      ((d.email_id IS NOT NULL AND d.email_id=provider_id) OR j.details->>'idempotencyKey'='shipping/'||d.supplier_ref||'/'||d.fingerprint))` : '',
  ].filter(Boolean).join(' OR ');
  const journalMatch = `(customer_email=$1 OR order_id::text=ANY($2::text[])${ledgerMailMatch ? ' OR '+ledgerMailMatch : ''})`;
  if (tables.has('customer_history_events')) add('customer_history_events',
    `(SELECT DISTINCT ON (COALESCE(attempt_id,id),customer_email) * FROM customer_history_events j WHERE at <= $3::timestamptz AND
      ${journalMatch} ORDER BY COALESCE(attempt_id,id),customer_email,at DESC,id DESC) j`, 'true',
    "'journal:'||id",'at','kind',`CASE WHEN kind='email' THEN 'Email sortant' ELSE 'Modification enregistrée' END`,
    "CASE WHEN order_id::text=ANY($2::text[]) THEN ARRAY[order_id::text] ELSE ARRAY[]::text[] END",'status','subject','body',
    "CASE WHEN details->>'field'='shipping_details' THEN jsonb_build_object('field','shipping_details','before',details->'before'->'tracking','after',details->'after'->'tracking')::text ELSE (details-'idempotencyKey')::text END",
    "COALESCE('provider:'||provider_id,'outbox:'||(details->>'idempotencyKey'),'attempt:'||attempt_id)",40);
  const deliveryPresent = tables.has('order_delivery_effects') ? "SELECT order_id::text FROM order_delivery_effects WHERE kind='final_image' AND status='sent'" : 'SELECT NULL::text order_id WHERE false';
  const shippingPresent = tables.has('order_shipping_effects') ? "SELECT ARRAY(SELECT jsonb_array_elements_text(details->'orderIds')) order_ids FROM order_shipping_effects" : 'SELECT ARRAY[]::text[] order_ids WHERE false';
  const cursorAt = input.cursor?.at ?? null; const cursorId = input.cursor?.id ?? null;
  const emailLinks = tables.has('customer_history_events') ? `SELECT DISTINCT ON (details->>'idempotencyKey') 'outbox:'||(details->>'idempotencyKey') old_key,'provider:'||provider_id new_key FROM customer_history_events j WHERE ${journalMatch} AND status='sent' AND provider_id IS NOT NULL AND details->>'idempotencyKey' IS NOT NULL AND at <= $3::timestamptz ORDER BY details->>'idempotencyKey',at DESC,id DESC` : 'SELECT NULL::text old_key,NULL::text new_key WHERE false';
  const ledgerLinks = [
    tables.has('order_delivery_effects') ? "SELECT 'outbox:delivery/'||order_id||'/'||kind||'/'||version old_key,'provider:'||email_id new_key FROM order_delivery_effects WHERE order_id::text=ANY($2::text[]) AND email_id IS NOT NULL AND status='sent' AND updated_at <= $3::timestamptz" : '',
    tables.has('order_shipping_effects') ? "SELECT 'outbox:shipping/'||supplier_ref||'/'||fingerprint old_key,'provider:'||email_id new_key FROM order_shipping_effects WHERE email_id IS NOT NULL AND status='sent' AND updated_at <= $3::timestamptz AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(details->'orderIds') x WHERE x=ANY($2::text[]))" : '',
  ].filter(Boolean).map(s=>` UNION ${s}`).join('');
  const query = `WITH delivery_present AS (${deliveryPresent}),shipping_present AS (${shippingPresent}),email_links AS ((${emailLinks})${ledgerLinks}),source_raw AS (${pieces.join('\nUNION ALL\n')}),
    raw AS (SELECT r.id,r.at,r.kind,r.title,r.source,r.order_ids,r.status,r.subject,r.body,r.details,COALESCE(l.new_key,r.mail_key) mail_key,r.priority FROM source_raw r LEFT JOIN email_links l ON l.old_key=r.mail_key WHERE r.at IS NULL OR r.at <= $3::timestamptz),
    ranked AS (SELECT *,row_number() OVER(PARTITION BY COALESCE(mail_key,id) ORDER BY priority DESC,at DESC NULLS LAST,id DESC) AS n FROM raw WHERE at IS NULL OR at <= $3::timestamptz),
    unique_events AS (SELECT * FROM ranked WHERE n=1),
    linked AS (SELECT u.*,
      CASE WHEN EXISTS(SELECT 1 FROM raw r WHERE r.mail_key=u.mail_key AND r.status='sent') THEN 'sent' ELSE u.status END merged_status,
      COALESCE((SELECT r.title FROM raw r WHERE r.mail_key=u.mail_key AND r.priority=30 ORDER BY r.id LIMIT 1),u.title) merged_title,
      COALESCE((SELECT r.kind FROM raw r WHERE r.mail_key=u.mail_key AND r.priority=30 ORDER BY r.id LIMIT 1),u.kind) merged_kind,
      COALESCE((SELECT string_agg(DISTINCT r.details,E'\\n') FROM raw r WHERE COALESCE(r.mail_key,r.id)=COALESCE(u.mail_key,u.id) AND r.details IS NOT NULL),u.details) merged_details,
      COALESCE((SELECT array_agg(DISTINCT x ORDER BY x) FROM raw r CROSS JOIN LATERAL unnest(r.order_ids) x
      WHERE COALESCE(r.mail_key,r.id)=COALESCE(u.mail_key,u.id)),ARRAY[]::text[]) all_orders FROM unique_events u)
    SELECT id,at,to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at,merged_kind AS kind,merged_title AS title,source,all_orders AS order_ids,merged_status AS status,subject,body,merged_details AS details FROM linked
    WHERE $5::text IS NULL OR (COALESCE(at,'-infinity'::timestamptz),id)<(COALESCE($4::text::timestamptz,'-infinity'::timestamptz),$5::text)
    ORDER BY at DESC NULLS LAST,id DESC LIMIT $6`;
  const rows = await db.unsafe(query,[email,ids,snapshot,cursorAt,cursorId,input.limit+1]);
  const events: CustomerHistoryEvent[] = rows.slice(0,input.limit).map(r => presentEvent({ id:r.id,at:r.at ? new Date(r.at).toISOString() : null,
    kind:r.kind,title:r.title,source:r.source,orderIds:r.order_ids,status:r.status,subject:r.subject,body:r.body,details:r.details }));
  const last = events.at(-1);
  const nextCursor = rows.length>input.limit && last ? Buffer.from(JSON.stringify({v:1,scope,snapshot,at:rows[input.limit-1].cursor_at,id:last.id})).toString('base64url') : null;
  return { customer:{name,email}, orders:orders.map(o=>({id:String(o.id),createdAt:new Date(o.created_at).toISOString(),label:`Commande ${String(o.id).slice(0,8)}`})),events,nextCursor,warnings };
}
