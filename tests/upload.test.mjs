import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load, blobMock, request, provider } from './upload-harness.mjs';
const { POST } = load('app/api/upload/route.ts', { '@vercel/blob/client': blobMock });
test('CODE-04: no context must never generate a Blob token', async () => {
  const response = await POST(request({ type: 'blob.generate-client-token', payload: { pathname: 'orders/free.jpg', clientPayload: null } }));
  assert.equal(response.status, 403);
  assert.equal(provider.generated, 0);
});
export { load, blobMock, request };
test('browser helper obtains a short context and uses only its assigned prefix', async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/upload/context');
    assert.equal(JSON.parse(options.body).purpose, 'depot');
    calls++;
    return Response.json({context:'test-context',prefix:'orders/assigned/',expiresAt:Date.now()+600000});
  };
  const uploads = [];
  try {
    const helper = load('lib/uploadClient.ts', {'@vercel/blob/client':{upload:async (...args)=>{uploads.push(args);return {url:'https://blob.invalid/synthetic.jpg'};}}});
    const file = new File(['synthetic'], '../../danger.jpg', {type:'image/jpeg'});
    await helper.uploadImage(file,{purpose:'depot',token:'signed'});
    await helper.uploadImage(file,{purpose:'depot',token:'signed'});
    assert.equal(calls,1);
    assert.match(uploads[0][0],/^orders\/assigned\/[a-f0-9-]+\.jpg$/);
    assert.match(uploads[1][0],/^orders\/assigned\/[a-f0-9-]+\.jpg$/);
    assert.notEqual(uploads[0][0],uploads[1][0]);
    assert.equal(uploads[0][2].clientPayload,'test-context');
  } finally {globalThis.fetch=oldFetch;}
});
test('browser helper recovers when a context refresh fails', async()=>{
 const previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;if(calls===2)return Response.json({},{status:503});return Response.json({context:'x',prefix:'orders/test/',expiresAt:Date.now()+1000});};
 try{
  const helper=load('lib/uploadClient.ts',{'@vercel/blob/client':{upload:async()=>({url:'https://blob.invalid/test'})}});
  const file=new File(['synthetic'],'a.jpg',{type:'image/jpeg'});
  const scope={purpose:'checkout',product:'simpson'};
  await helper.uploadImage(file,scope);
  await assert.rejects(helper.uploadImage(file,scope));
  await helper.uploadImage(file,scope);
  assert.equal(calls,3);
 }finally{globalThis.fetch=previous;}
});
test('fabricated context cannot authorize a provider token', async () => {
  const before = provider.generated;
  const response = await POST(request({ type: 'blob.generate-client-token', payload: { pathname: 'final/stolen.jpg', clientPayload: 'fabricated' } }));
  assert.equal(response.status, 403);
  assert.equal(provider.generated, before);
});
