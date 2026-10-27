import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

// Bundle and execute the actual catalogue, including its shared consent copy.
const bundle = await build({
  absWorkingDir: new URL('..', import.meta.url).pathname,
  entryPoints: ['lib/legal/index.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { PAGES_LEGALES } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const references = {
  fr: ['Textes juridiques de référence :', /Cette politique est conforme/iu],
  en: ['Legal reference texts:', /This policy complies with/iu],
  de: ['Rechtliche Referenztexte:', /Diese Erklärung entspricht/iu],
  es: ['Textos jurídicos de referencia:', /Esta política es conforme/iu],
  it: ['Testi giuridici di riferimento:', /La presente informativa è conforme/iu],
  nl: ['Juridische referentieteksten:', /Dit beleid is in overeenstemming/iu],
  pl: ['Referencyjne akty prawne:', /Niniejsza polityka jest zgodna/iu],
  sv: ['Juridiska referenstexter:', /Denna policy är förenlig/iu],
  da: ['Juridiske referencetekster:', /Denne politik er i overensstemmelse/iu],
  pt: ['Textos jurídicos de referência:', /Esta política está em conformidade/iu],
};

test('CRO-10 covers exactly the ten published legal catalogues', () => {
  assert.equal(Object.keys(references).length, 10);
  assert.deepEqual(Object.keys(PAGES_LEGALES).sort(), Object.keys(references).sort());
});

for (const [locale, [prefix, absoluteClaim]] of Object.entries(references)) {
  test(`CRO-10 ${locale}: privacy introduction cites laws without claiming validated compliance`, () => {
    const catalogue = PAGES_LEGALES[locale];
    // Check the whole catalogue so moving the old claim cannot hide a regression.
    assert.doesNotMatch(JSON.stringify(catalogue), absoluteClaim);
    const legalReferences = catalogue.confidentialite.sections[0].blocs.filter(
      block => typeof block === 'string' && block.startsWith(prefix),
    );
    assert.equal(legalReferences.length, 1, `${locale}: one neutral legal-reference statement`);
    assert.match(legalReferences[0], /2016\/679/u);
    assert.match(legalReferences[0], /Informatique et Libertés/u);
    assert.match(legalReferences[0], /1978/u);
  });
}
