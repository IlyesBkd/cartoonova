import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac } from 'node:crypto';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { load } from './upload-harness.mjs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url).pathname;
const uuid = '12345678-1234-1234-1234-123456789abc';
const ref = `vps://private/orders/${uuid}/${uuid}.png`;
const bytes = Buffer.from('image test payload');
let registry, requests, state, counters;
const db = (strings, ...values) => {
  if (!Array.isArray(strings) || !strings.raw) return strings;
  const sql = strings.join('?');
  if (sql.includes('INSERT INTO storage_objects')) {
    const [reference, internal_path, sha256, size, content_type] = values;
    if (registry.has(reference)) throw new Error('duplicate reference');
    registry.set(reference, {reference, internal_path, sha256, bytes:size, content_type, status:'pending'});
    return Promise.resolve([]);
  }
  if (sql.includes('UPDATE storage_objects')) {
    assert(!/backup/i.test(sql), 'no secondary copy columns');
    const [reference] = values;
    const row = registry.get(reference);
    assert(row && row.status === 'pending', 'only a pending row can complete');
    Object.assign(row, {status:'completed'});
    counters.marked++;
    return Promise.resolve([{reference}]);
  }
  if (sql.includes('FROM storage_objects')) {
    if (sql.includes(' IN ')) return Promise.resolve(values[0].flatMap(r => registry.get(r)?.status === 'completed' ? [{reference:r}] : []));
    return Promise.resolve(registry.has(values[0]) ? [registry.get(values[0])] : []);
  }
  if (sql.includes('FROM upload_reservations')) {
    if (sql.includes('c.token_hash')) return Promise.resolve(state.contextAllowed ? [{purpose:state.purpose,subject:state.subject}] : []);
    if (sql.includes("c.purpose = 'admin'")) return Promise.resolve(state.adminOrder === values[1] ? [{pathname:values[0]}] : []);
    return Promise.resolve(state.sessionOwned ? [{pathname:values[0]}] : []);
  }
  if (sql.includes('FROM orders')) return Promise.resolve(state.order ? [state.order] : []);
  throw new Error('Unexpected SQL: ' + sql);
};
db.begin = fn => fn(db);
const mocks = {
  '@/lib/db': 'export const withFreshDatabaseClient = fn => fn(globalThis.__vps.db);',
  '@/lib/adminAuth': 'export const requireAdmin = async () => globalThis.__vps.state.admin ? null : new Response(null,{status:401}); export const refuserSiPasAdmin=requireAdmin;',
  '@/lib/checkoutPhotoSession': 'export const checkoutPhotoSession = req => req.headers.get("x-session"); export const checkoutPhotoSubject = s => "checkout:"+s;',
  '@/lib/emailToken': 'export const parseOrderTrackingToken = t => t === "valid-tracking" ? "12345678-1234-1234-1234-123456789abc" : null;',
  '@/lib/catalogue': 'export const SLUGS_PRODUIT_TOUTES_LANGUES=[];',
};
const result = await build({stdin:{contents:['storage','storageCore','storageAuthorization','storageRoutes','orderPhotos','photoOwnership','uploadPolicy','finalImage'].map(n=>`export * from './lib/${n}';`).join('\n'),resolveDir:root,sourcefile:'vps-test-entry.ts'}, bundle:true, platform:'node',format:'cjs',packages:'external',write:false, plugins:[{name:'isolate',setup(b){
  b.onResolve({filter:/.*/}, args => {
    if (args.path === '@/lib/uploadPolicy' && args.importer.endsWith('storageRoutes.ts')) return {path:'route-policy',namespace:'mock'};
    if (mocks[args.path]) return {path:args.path,namespace:'mock'};
  });
  b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='route-policy' ? 'export class UploadError extends Error {constructor(message,status=403){super(message);this.status=status}}; export const reserveUpload=async()=>{globalThis.__vps.counters.reserve++;if(!globalThis.__vps.state.reserveAllowed)throw new UploadError("denied")};export const authorizeReservedUpload=async()=>{globalThis.__vps.counters.authorize++;if(!globalThis.__vps.state.contextAllowed)throw new UploadError("denied")};' : mocks[args.path],loader:'js'}));
}}]});
const bundledModule = {exports:{}};
vm.runInThisContext(`(function(require,module,exports){${result.outputFiles[0].text}\n})`)(createRequire(import.meta.url),bundledModule,bundledModule.exports);
const api = bundledModule.exports;
function setup() {
  process.env.CARTOONOVA_STORAGE_PROVIDER='vps';
  process.env.STORAGE_HMAC_SECRET=randomBytes(48).toString('base64url');
  process.env.STORAGE_VPS_ORIGIN='https://files.cartoonova.test';
  process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_teststore_testcredential';
  registry=new Map();requests=[];
  counters={reserve:0,authorize:0,marked:0};
  state={admin:false,reserveAllowed:true,contextAllowed:true,purpose:'checkout',subject:'checkout:mine',sessionOwned:false,order:null,vpsFailure:false};
  globalThis.__vps={db,state,counters};
  globalThis.fetch=async(url,options)=>{
    requests.push({url,options});assert.equal(options.redirect,'manual');
    if(url.startsWith('https://files.cartoonova.test/v1/files/')) {
      if(state.vpsFailure)return new Response(null,{status:503});
      assert.match(options.headers.Authorization,/^Bearer /);
      if(options.method==='PUT')return new Response('{}',{status:201});
      return new Response(state.sourceBytes??bytes,{headers:{'Content-Type':state.sourceType??'image/png'}});
    }
    const prefix='https://teststore.public.blob.vercel-storage.com/';
    if(url.startsWith(prefix))return new Response(state.legacyBytes,{headers:{'Content-Type':'image/png'}});
    throw new Error('External network blocked');
  };
}
function descriptor(reference=ref,source=bytes,type='image/png') { return {reference,sha256:api.storageHash(source),bytes:source.length,content_type:type,status:'pending'}; }
function request(body,extra={}) {return new Request('https://app.cartoonova.test/api/upload',{method:'POST',headers:{origin:'https://app.cartoonova.test','content-type':'application/json',...extra},body:JSON.stringify(body)});}
function grantBody(){return {pathname:new URL(ref).pathname.slice(1),context:'a'.repeat(64),sha256:api.storageHash(bytes),size:bytes.length,contentType:'image/png'};}

test('canonical parser and deterministic path reject host, traversal, query and namespace mismatches',()=>{
  setup();assert(api.isVpsReference(ref));assert.equal(new URL(ref).pathname,`/orders/${uuid}/${uuid}.png`);
  for(const bad of [ref+'?grant=x',ref+'#x',ref.replace('private','evil.test'),ref.replace('.png','.pdf'),ref.replace(uuid,'%2e%2e'),ref.replace('orders','bogus')])assert.equal(api.isVpsReference(bad),false,bad);
  assert.equal(api.servicePath(ref),'/v1/files/orders/'+api.storageHash(new URL(ref).pathname).slice(0,32));
});
test('grant matches real HMAC protocol and GET cannot become PUT',()=>{
  setup();const d=descriptor();const token=api.storageGrant(d,'PUT');const [payload,sig]=token.split('.');
  assert.equal(sig,createHmac('sha256',process.env.STORAGE_HMAC_SECRET).update('cartoonova-storage-v1.'+payload).digest('base64url'));
  const c=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(c.method,'PUT');assert.equal(c.path,api.servicePath(ref));assert(c.exp>Date.now()/1000&&c.exp<Date.now()/1000+121);assert.equal(c.maxbytes,bytes.length);
  assert.notEqual(api.storageGrant(d,'GET'),token);
});
test('default off: no grants, quota, writes, or legacy URL changes',async()=>{
  setup();delete process.env.CARTOONOVA_STORAGE_PROVIDER;
  assert.equal((await api.vpsGrantRoute(request(grantBody()))).status,404);
  assert.equal((await api.vpsCompleteRoute(request({reference:ref}))).status,404);
  assert.equal(counters.reserve,0);assert.equal(registry.size,0);assert.equal(api.storageEmailUrl('https://legacy.test/image.png'),'https://legacy.test/image.png');
  await assert.rejects(api.uploadVpsServerObject(bytes,'orders','image/png'));
});
test('grant reserves exact path and stores pending descriptor before responding',async()=>{
  setup();const response=await api.vpsGrantRoute(request(grantBody()));assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.reference,ref);assert.equal(body.url,process.env.STORAGE_VPS_ORIGIN+api.servicePath(ref));assert.equal(registry.get(ref).status,'pending');assert.equal(counters.reserve,1);assert.equal(counters.authorize,1);assert.equal(requests.length,0);
});
test('grant rejects malicious inputs and quota/authorization denial without minting',async()=>{
  setup();for(const patch of [{size:10485761},{size:0},{sha256:'X'.repeat(64)},{contentType:'image/jpeg'},{pathname:'orders/../../x.png'}])assert.equal((await api.vpsGrantRoute(request({...grantBody(),...patch}))).status,400);
  assert.equal(counters.reserve,0);state.reserveAllowed=false;assert.equal((await api.vpsGrantRoute(request(grantBody()))).status,403);assert.equal(registry.size,0);
});
const offVps=()=>requests.filter(r=>!r.url.startsWith('https://files.cartoonova.test/'));
test('complete is done once VPS bytes are read back and SHA-256 verified; repeat is no overwrite',async()=>{
  setup();await api.registerStorageObject(descriptor());const response=await api.vpsCompleteRoute(request({reference:ref,context:'a'.repeat(64)}));assert.equal(response.status,200);
  const d=registry.get(ref);assert.equal(d.status,'completed');assert(!Object.keys(d).some(k=>/backup/i.test(k)));
  assert.equal(requests.length,1);assert.equal(requests[0].options.method,undefined);assert.match(requests[0].options.headers.Authorization,/^Bearer /);assert.deepEqual(offVps(),[]);
  await api.completeStorageObject(ref);assert.equal(counters.marked,1);assert.equal(requests.length,1);
  assert.equal(api.encryptStorageBackup,undefined);assert.equal(api.decryptBackup,undefined);assert.equal(api.decryptStorageBackup,undefined);
});
test('unavailable or corrupt VPS source never marks completed; a later verified retry completes',async()=>{
  setup();await api.registerStorageObject(descriptor());state.vpsFailure=true;await assert.rejects(api.completeStorageObject(ref));assert.equal(registry.get(ref).status,'pending');assert.equal(counters.marked,0);
  state.vpsFailure=false;state.sourceBytes=Buffer.from('wrong');await assert.rejects(api.completeStorageObject(ref));assert.equal(registry.get(ref).status,'pending');assert.equal(counters.marked,0);
  state.sourceBytes=undefined;state.sourceType='image/jpeg';await assert.rejects(api.completeStorageObject(ref));assert.equal(counters.marked,0);
  state.sourceType=undefined;await api.completeStorageObject(ref);assert.equal(registry.get(ref).status,'completed');assert.equal(counters.marked,1);assert.deepEqual(offVps(),[]);
});
test('private reads require registry completion; VPS failure fails closed with no fallback copy',async()=>{
  setup();await assert.rejects(api.readStoredObject(ref));await api.registerStorageObject(descriptor());await assert.rejects(api.readStoredObject(ref));await api.completeStorageObject(ref);assert.deepEqual((await api.readStoredObject(ref)).bytes,bytes);
  state.vpsFailure=true;await assert.rejects(api.readStoredObject(ref));state.vpsFailure=false;state.sourceBytes=Buffer.from('tampered');await assert.rejects(api.readStoredObject(ref));assert.deepEqual(offVps(),[]);
});
test('existing legacy public Vercel Blob URLs stay readable unchanged; foreign origins refused',async()=>{
  setup();state.legacyBytes=Buffer.from('legacy photo');const legacy='https://teststore.public.blob.vercel-storage.com/orders/legacy.png';
  assert.deepEqual((await api.readStoredObject(legacy)).bytes,state.legacyBytes);assert.equal(registry.size,0);assert.equal(api.storageEmailUrl(legacy),legacy);
  for(const bad of ['https://otherstore.public.blob.vercel-storage.com/x.png',legacy+'?x=1','https://evil.test/x.png'])await assert.rejects(api.readStoredObject(bad),bad);
});
test('email capability is bound to one file and fails closed when altered',()=>{
  setup();
  const signature=api.emailCapability(ref);assert(api.verifyEmailCapability(ref,signature));assert(!api.verifyEmailCapability(ref.replace('orders','final'),signature));assert(!api.verifyEmailCapability(ref,signature.slice(1)));
});
test('read route denies pathname knowledge; admin/session/order membership and preview snapshot enforced',async()=>{
  setup();await api.registerStorageObject(descriptor());await api.completeStorageObject(ref);
  const read=(suffix='',headers={})=>api.storageReadRoute(new Request('https://app.test/api/storage/read?ref='+encodeURIComponent(ref)+suffix,{headers}));
  assert.equal((await read()).status,403);state.admin=true;assert.equal((await read()).status,200);state.admin=false;
  assert.equal((await read('',{'x-session':'mine'})).status,403);state.sessionOwned=true;assert.equal((await read('',{'x-session':'mine'})).status,200);state.sessionOwned=false;
  state.order={paid_at:'yes',photo_urls:[]};assert.equal((await read('&token=valid-tracking')).status,403);state.order.photo_urls=[ref];assert.equal((await read('&token=valid-tracking')).status,200);
  state.order={paid_at:'yes',poster_confirmation_sent_at:'yes',poster_confirmation_token:'preview',final_image_url:ref,poster_confirmation_image_url:ref,customer_email:'a',poster_confirmation_email:'a'};assert.equal((await read('&posterToken=preview')).status,200);state.order.poster_confirmation_email='changed';assert.equal((await read('&posterToken=preview')).status,403);
});
test('email capability is durable file-only READ; route rechecks completed registry',async()=>{
  setup();const url=api.storageEmailUrl(ref);assert(!url.includes('grant='));assert(!url.includes('token='));assert.equal((await api.storageReadRoute(new Request(url),true)).status,503);
  await api.registerStorageObject(descriptor());await api.completeStorageObject(ref);const response=await api.storageReadRoute(new Request(url),true);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  const u=new URL(url);u.searchParams.set('ref',ref.replace('orders','final'));assert.equal((await api.storageReadRoute(new Request(u),true)).status,403);
});
test('completion requires original context and session, cannot replay another session',async()=>{
  setup();await api.registerStorageObject(descriptor());state.contextAllowed=false;assert.equal((await api.vpsCompleteRoute(request({reference:ref,context:'a'.repeat(64)}))).status,403);assert.equal(requests.length,0);
  state.contextAllowed=true;await assert.rejects(api.authorizeReservedUpload(request({}, {'x-session':'other'}),new URL(ref).pathname.slice(1),'a'.repeat(64)));
  await api.authorizeReservedUpload(request({}, {'x-session':'mine'}),new URL(ref).pathname.slice(1),'a'.repeat(64));
});
test('admin final attachment needs exact admin:order binding and completion',async()=>{
  setup();const final=ref.replace('orders','final');await api.registerStorageObject(descriptor(final));state.adminOrder='admin:'+uuid;assert.equal(await api.authorizeFinalStorageAttachment(final,uuid),false);await api.completeStorageObject(final);assert.equal(await api.authorizeFinalStorageAttachment(final,uuid),true);assert.equal(await api.authorizeFinalStorageAttachment(final,'different-order'),false);
});
test('trusted PDF generation writes an immutable VPS-only file, completed after verified readback',async()=>{
  setup();state.sourceBytes=Buffer.from('%PDF-test');state.sourceType='application/pdf';const result=await api.uploadVpsServerObject(state.sourceBytes,`extras/${uuid}`,'application/pdf');assert(api.isVpsReference(result));assert(result.startsWith(`vps://private/extras/${uuid}/`));assert.equal(registry.get(result).status,'completed');assert.equal(requests[0].options.method,'PUT');assert.equal(requests.length,2);assert.deepEqual(offVps(),[]);
});
test('bounded download rejects redirects, oversized and dishonest streams',async()=>{
  setup();globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'https://evil.test'}});await assert.rejects(api.boundedStorageFetch('https://files.cartoonova.test/x',{},10));
  globalThis.fetch=async()=>new Response('small',{headers:{'content-length':'100'}});await assert.rejects(api.boundedStorageFetch('https://files.cartoonova.test/x',{},10));
  globalThis.fetch=async()=>new Response('oversized body');await assert.rejects(api.boundedStorageFetch('https://files.cartoonova.test/x',{},2));
});
test('photo shape accepts VPS but rejects finals and pending registry attachments',async()=>{
  setup();assert.deepEqual(api.parsePhotoUrls([ref]),[ref]);assert(!Array.isArray(api.parsePhotoUrls([ref.replace('orders','final')])));await api.registerStorageObject(descriptor());const result=await api.validatePhotoOwnership([ref],{id:uuid,photo_urls:[ref]},'depot');assert(result?.error);await api.completeStorageObject(ref);assert.equal(await api.validatePhotoOwnership([ref],{id:uuid,photo_urls:[ref]},'depot'),null);
});
test('VPS final image retains Sharp full decode validation and rejects fake PNG',async()=>{
  setup();const final=ref.replace('orders','final');await api.registerStorageObject(descriptor(final));await api.completeStorageObject(final);await assert.rejects(api.downloadFinalImage(final),api.FinalImageError);
  const sharp=createRequire(import.meta.url)('sharp');state.sourceBytes=await sharp({create:{width:2,height:2,channels:3,background:'red'}}).png().toBuffer();const valid=final.replace(`${uuid}.png`,'abcdefab-1234-1234-1234-abcdefabcdef.png');await api.registerStorageObject(descriptor(valid,state.sourceBytes));await api.completeStorageObject(valid);assert.deepEqual((await api.downloadFinalImage(valid)).bytes,state.sourceBytes);
});
test('actual route files dispatch the tested handlers with no extra authorization surface',async()=>{
  setup();
  const mocks={'@/lib/storageRoutes':api};
  const grant=load('app/api/upload/vps-grant/route.ts',mocks).POST;
  const complete=load('app/api/upload/complete/route.ts',mocks).POST;
  const read=load('app/api/storage/read/route.ts',mocks).GET;
  const email=load('app/api/storage/email/route.ts',mocks).GET;
  assert.equal((await grant(request(grantBody()))).status,200);
  assert.equal((await complete(request({reference:ref,context:'a'.repeat(64)}))).status,200);
  assert.equal((await read(new Request('https://app.test/api/storage/read?ref='+encodeURIComponent(ref)))).status,403);
  assert.equal((await email(new Request(api.storageEmailUrl(ref)))).status,200);
});
test('actual context endpoint advertises VPS only with exact enabled flag',async()=>{
  setup();
  const {POST}=load('app/api/upload/context/route.ts',{'@/lib/uploadPolicy':{createUploadContext:async()=>({context:'a'.repeat(64),prefix:`orders/${uuid}/`,photoSession:null})}});
  assert.equal((await (await POST(request({}))).json()).provider,'vps');
  for(const flag of ['', 'blob','VPS']) {process.env.CARTOONOVA_STORAGE_PROVIDER=flag;assert.equal((await (await POST(request({}))).json()).provider,undefined);}
});
test('actual final attachment route rejects cross-order completed VPS before reading or persisting',async()=>{
  setup();let writes=0,downloads=0;
  const final=ref.replace('orders','final');await api.registerStorageObject(descriptor(final));await api.completeStorageObject(final);state.adminOrder='admin:another-order';
  const {POST}=load('app/api/orders/send-final-image/route.ts',{
    '@/lib/db':{getOrderById:async()=>({id:uuid,customer_email:'a',paid_at:'today',options:{}}),updateOrderFinalImage:async()=>writes++},
    '@/lib/adminAuth':{refuserSiPasAdmin:async()=>null},
    '@/lib/storageAuthorization':{authorizeFinalStorageAttachment:api.authorizeFinalStorageAttachment},
    '@/lib/emailImageFinale':{envoyerImageFinale:async()=>assert.fail('no email')},
    '@/lib/finalImage':{downloadFinalImage:async()=>downloads++,FinalImageError:api.FinalImageError},
  });
  assert.equal((await POST(request({orderId:uuid,finalImageUrl:final,saveOnly:true}))).status,403);assert.equal(writes,0);assert.equal(downloads,0);
});
