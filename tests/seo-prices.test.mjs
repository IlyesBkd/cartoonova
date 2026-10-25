import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
require('tsx/cjs');
const {grapheJsonLd}=require('../lib/donneesStructurees.ts');

test('JSON-LD remains JSON and cannot terminate its native script element',()=>{
 const name='</script><script>window.injected=true</script>';
 const payload=grapheJsonLd([{'@type':'Product',name}]);
 assert.ok(!payload.includes('<'),'Next JSON-LD serialization must escape HTML delimiters');
 assert.equal(JSON.parse(payload)['@graph'][0].name,name);
});
