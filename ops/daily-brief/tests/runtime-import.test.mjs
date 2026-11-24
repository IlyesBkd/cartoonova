import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
test('runtime relocated outside checkout imports shared masking and projection',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'cartoonova-brief-runtime-'));
 for(const n of ['redaction.mjs','evidence.mjs','collect.mjs'])await copyFile(new URL('../'+n,import.meta.url),path.join(dir,n));
 const {redact}=await import(pathToFileURL(path.join(dir,'redaction.mjs')));
 const {projectOrderContext}=await import(pathToFileURL(path.join(dir,'evidence.mjs')));
 const {collectBrief}=await import(pathToFileURL(path.join(dir,'collect.mjs')));
 assert.equal(typeof collectBrief,'function');
 assert.ok(!redact('{"password":"synthetic-fixture"}',700).includes('synthetic-fixture'));
 const projected=projectOrderContext({id:'00000000-0000-0000-0000-000000000001',status:'PAID',photo_urls:[]},[],{observedAt:'2026-11-24T10:00:00Z'});
 assert.equal(JSON.parse(projected.evidence[0].text).status,'paid');
 assert.ok(!projected.limitations.includes('unknown_state'));
});
