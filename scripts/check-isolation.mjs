import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const wrangler=JSON.parse(read('wrangler.jsonc'));
const source=['src/worker.ts','src/Site.tsx','src/whiteLabel.ts','functions/api/[[path]].ts','functions/_lib/notices.ts','src/App.tsx'].map(read).join('\n');

assert.notEqual(wrangler.name,'conectando-ideias-brasil','Worker must not target existing production');
assert.ok(/^[a-z0-9-]{2,63}$/.test(wrangler.name),'Worker name must be safe and explicit');
assert.ok(!wrangler.name.includes('conectando-ideias'),'Original Worker name is forbidden');
assert.ok(wrangler.d1_databases?.length===1 && wrangler.d1_databases[0].binding==='DB');
assert.notEqual(wrangler.d1_databases[0].database_name,'conectando-ideias-brasil');
assert.ok(/^(REPLACE_WITH_A_NEW_D1_DATABASE_ID|[0-9a-f]{8}-[0-9a-f-]{27})$/i.test(wrangler.d1_databases[0].database_id),
  'Database ID must be an explicit template placeholder or UUID');
assert.ok(!wrangler.d1_databases[0].database_name.includes('conectando-ideias'),'Original D1 name is forbidden');
assert.doesNotMatch(source,/conectando-ideias-brasil\.jeferson-samagaia\.workers\.dev/i);
assert.doesNotMatch(source,/Conectando Ideias Brasil/i);
assert.match(read('src/whiteLabel.ts'),/Editora NPE/);
assert.match(read('src/whiteLabel.ts'),/Sua marca|Sua empresa|sua empresa/i);
assert.match(read('src/whiteLabel.ts'),/Exemplos|demo|DEMONSTRATIV/i);
assert.match(read('public/assets/npe-brand.svg'),/EDITORA/);
assert.match(read('src/npeTheme.css'),/#f00483/);
assert.match(read('src/npeTheme.css'),/#393c86/);

console.log('White-label isolation OK: separate Worker, placeholder D1, NPE brand, no CIB live URL.');
