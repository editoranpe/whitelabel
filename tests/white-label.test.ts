import test from 'node:test';
import assert from 'node:assert/strict';
import {whiteLabelDemoPage,NPE_THEME} from '../src/whiteLabel.ts';
import {validatePage} from '../functions/_lib/siteBuilder.ts';

test('NPE showcase page is publishable through the same validated editor',()=>{
 assert.equal(validatePage(whiteLabelDemoPage),true,'Default sales demo must follow the page schema');
});
test('showcase sections and menu links are self-consistent',()=>{
 const ids=new Set(whiteLabelDemoPage.sections.map(s=>s.id));
 for(const link of whiteLabelDemoPage.menuItems||[]){
   if(link.href.startsWith('#'))assert.ok(ids.has(link.href.slice(1)),`Unknown menu target: ${link.href}`);
 }
});
test('demo does not fabricate testimonials',()=>{
 const text=JSON.stringify(whiteLabelDemoPage);
 assert.match(text,/demonstrativo|exemplo/i);
 assert.doesNotMatch(text,/Conectando Ideias Brasil|jeferson-samagaia\.workers\.dev/i);
});
test('NPE commercial brand uses the supplied palette and self-hosted assets',()=>{
 assert.equal(NPE_THEME.accent,'#f00483');
 assert.equal(NPE_THEME.primary,'#393c86');
 assert.equal(NPE_THEME.yellow,'#ffd100');
 assert.ok(NPE_THEME.logo.startsWith('/assets/'));
});
