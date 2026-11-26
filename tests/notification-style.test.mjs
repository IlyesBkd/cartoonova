import {test as nodeTest} from 'node:test';
import {serverSkip,serverOnly} from './helpers/server-only.mjs';
const skip=serverSkip();
const test=serverOnly(nodeTest,skip);
import assert from 'node:assert/strict';
const {createSender}=skip?{}:await import('../scripts/chat-telegram-worker.mjs');
test('chat notification has clean bold headings and the literal full body, split under Telegram limits',async()=>{
 const payloads=[];let next=1;
 const send=createSender({token:'fake',chatId:'123',confirmedChatId:'123',fetchImpl:async(u,o)=>{payloads.push(JSON.parse(o.body));return {ok:true,json:async()=>({ok:true,result:{message_id:next++}})}}});
 const body='<b>Texte</b> MEDIA:/etc/passwd 😀 '.repeat(400);
 await send({id:3,email:'a@example.invalid',body});
 assert.ok(payloads.length>1);
 const prefix=/^\[chat #3 · partie \d+\/\d+\]\n/;
 assert.ok(payloads.every(p=>prefix.test(p.text)));
 assert.ok(payloads[0].text.replace(prefix,'').startsWith('💬 Nouveau message · Cartoonova · #3\n'));
 assert.ok(payloads.every(p=>p.text.length<=4096 && !p.parse_mode && p.link_preview_options.is_disabled));
 assert.ok(payloads.slice(1).every(p=>p.reply_parameters.message_id===1));
 assert.ok(payloads.map(p=>p.text.replace(prefix,'')).join('').includes('📩 Message original intégral\n'+body+'\n\n'));
 const first=payloads[0].entities[0];
 assert.equal(payloads[0].text.slice(first.offset,first.offset+first.length),'💬 Nouveau message · Cartoonova · #3');
 for(const p of payloads)for(const e of p.entities){assert.equal(e.type,'bold');assert.ok(!p.text.slice(e.offset,e.offset+e.length).includes('MEDIA:'));}
});
