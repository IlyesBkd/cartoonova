import test from 'node:test';
import assert from 'node:assert/strict';
import {localDisplayName,makeCandidates,projectOrderContext} from '../evidence.mjs';
import {A,NOW,order,draft,empty} from './fixtures.mjs';

test('local names: Unicode, apostrophes, hyphens; reject contacts and arbitrary values',()=>{
 for(const name of ['Kerly','Tanguy','Jeanne','Élodie O’Neill','Anne-Marie','李 明'])assert.equal(localDisplayName(name),name);
 for(const value of ['abc@example.com','+33612345678','12 rue Exemple','rue Exemple','Place Victor Hugo','Quai des Fleurs','Piazza Roma','Square des Fleurs','<b>Jeanne</b>','Jeanne\nSecret','x'.repeat(81),{},null])assert.equal(localDisplayName(value),null);
});
test('only structured order names produce display labels; draft identity never trusted',()=>{
 const context=projectOrderContext({...order(),customer_name:'Kerly'},[],{observedAt:NOW});
 const [named]=makeCandidates(empty(),[draft({id:17,client:'abc@example.com'})],{[A]:context});
 assert.equal(named.displayLabel,'Kerly');
 const [unlinked]=makeCandidates(empty(),[draft({id:17,commande:null,client:'Jeanne'})],{[A]:context});
 assert.equal(unlinked.displayLabel,'Dossier b17');
 assert.ok(unlinked.limitations.includes('context_unavailable'));
 const bad=projectOrderContext({...order(),customer_name:'abc@example.com'},[],{observedAt:NOW});
 assert.equal(makeCandidates(empty(),[draft({id:17})],{[A]:bad})[0].displayLabel,'Dossier b17');
});
