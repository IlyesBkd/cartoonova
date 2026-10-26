import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('verification automatically scans repository artifacts before installation and uploads only TAP evidence',()=>{
 const workflow=readFileSync('.github/workflows/verification.yml','utf8');
 const guard=workflow.indexOf('run: node scripts/check-artifact-secrets.mjs');
 assert.ok(guard>0,'artifact guard must run automatically, not just exist as npm command');
 assert.ok(guard<workflow.indexOf('run: npm ci'));
 assert.doesNotMatch(workflow,/path:.*\.next/);
});
