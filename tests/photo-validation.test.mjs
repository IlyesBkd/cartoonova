import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './upload-harness.mjs';
const {parsePhotoUrls, photosInvalides}=load('lib/orderPhotos.ts');
const origin='https://synthetic.public.blob.vercel-storage.com';
process.env.BLOB_READ_WRITE_TOKEN='vercel_blob_rw_synthetic_localonly';
const photo=(n=1)=>`${origin}/orders/12345678-1234-1234-1234-123456789abc/photo${n}.jpg`;
test('only exact configured Blob origin and photo namespaces survive; no URL normalization bypass',()=>{
 for(const url of ['https://evil.invalid/orders/x.jpg',origin+'/final/x.jpg',origin+'/orders-evil/x.jpg',origin+'/Orders/x.jpg',origin+'/orders/a.jpg?x=1',origin+'/orders/a.jpg#x',origin+'/orders/%2e%2e/final/a.jpg',origin+'/orders/../final/a.jpg',origin+'/orders/a%2fb.jpg',origin+'/orders/x.svg',origin.replace('https://','https://user:pass@')+'/orders/x.jpg',origin+':443/orders/x.jpg',origin+'/orders/\\\\evil.jpg']) {
  assert.equal(photosInvalides(parsePhotoUrls([url])),true,url);
 }
 assert.deepEqual(parsePhotoUrls([photo(),` ${photo()} `]),[photo()]);
 assert.deepEqual(parsePhotoUrls([origin+'/retouches/old-image.jpg']),[origin+'/retouches/old-image.jpg']);
});
test('missing or malformed storage credentials fail closed, but no-photo checkout still works',()=>{
 const old=process.env.BLOB_READ_WRITE_TOKEN;
 try {
  for(const token of [undefined,'','wrong_prefix_rw_synthetic_fake','vercel_blob_rw__empty']) {
   if(token===undefined)delete process.env.BLOB_READ_WRITE_TOKEN;else process.env.BLOB_READ_WRITE_TOKEN=token;
   assert.match(parsePhotoUrls([photo()]).error,/Configuration/);
   assert.deepEqual(parsePhotoUrls([]),[]);
  }
 }finally{process.env.BLOB_READ_WRITE_TOKEN=old;}
});
test('legacy timestamp filenames with encoded spaces/accents remain parseable in the same store',()=>{
 const legacy=origin+'/orders/1792890000000-famille%20%C3%A9t%C3%A9-Ab12cd.jpg';
 assert.deepEqual(parsePhotoUrls([legacy]),[legacy]);
 for(const tail of ['a%2fb.jpg','a%5cb.jpg','a%252fb.jpg','a%00b.jpg','a%3fb.jpg','%ZZ.jpg']) {
  assert.equal(photosInvalides(parsePhotoUrls([origin+'/orders/'+tail])),true,tail);
 }
});
test('checkout parser never adopts legacy punctuation without authenticated persisted attachments',()=>{
 for(const name of ['famille+amis','famille,amis',"famille'amis",'famille%20%C3%A9t%C3%A9+amis','famille%2Bamis','famille%2Camis','famille%27amis']) {
  const url=`${origin}/orders/1792890000000-${name}-Ab12cd.jpg`;
  assert.equal(photosInvalides(parsePhotoUrls([url])),true,name);
  assert.deepEqual(parsePhotoUrls([url],[url]),[url]);
  assert.equal(photosInvalides(parsePhotoUrls([url],[url.replace('1792890000000','1792890000001')])),true);
 }
});
test('eight unique photos max: reject overflow and invalid tail, do not silently truncate',()=>{
 const eight=Array.from({length:8},(_,i)=>photo(i));
 assert.deepEqual(parsePhotoUrls([...eight,eight[0]]),eight);
 assert.match(parsePhotoUrls([...eight,photo(9)]).error,/8/);
 assert.equal(photosInvalides(parsePhotoUrls([...eight,'https://'])),true);
 assert.deepEqual(parsePhotoUrls(undefined),[]);
 assert.deepEqual(parsePhotoUrls([]),[]);
});
test('malformed entries cause explicit errors rather than disappearing',()=>{
 for(const value of [['https://'],['not a url'],[7],[''],{}]) {
  assert.equal(photosInvalides(parsePhotoUrls(value)),true,JSON.stringify(value));
 }
});
