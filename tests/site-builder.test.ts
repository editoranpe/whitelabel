import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePage} from '../functions/_lib/siteBuilder.ts';
const safe=()=>({title:'Sua Organização',font:'modern',headerColor:'#0b493a',accentColor:'#d5ee48',sections:[{id:'inicio',label:'Topo',columns:1,background:'#ffffff',color:'#123d32',padding:60,widgets:[{id:'titulo01',type:'heading',title:'Olá, associados',text:'Bem-vindos'}]}]});
test('permite publicação de páginas estruturadas',()=>{assert.equal(validatePage(safe()),true)});
test('rejeita URL javascript e código perigoso',()=>{
 const page=safe() as any;page.sections[0].widgets[0].url='javascript:alert(1)';
 assert.equal(validatePage(page),false);
});
test('rejeita cores CSS fora do padrão seguro',()=>{
 const page=safe();page.sections[0].background='url(javascript:foo)';
 assert.equal(validatePage(page),false);
});
test('rejeita ids duplicados e layouts excessivos',()=>{
 const page=safe() as any;page.sections[0].widgets.push({...page.sections[0].widgets[0]});
 assert.equal(validatePage(page),false);
});

test('accepts editable navigation, icon cards, testimonial portraits and image-text blocks',()=>{
 const page=safe() as any;
 page.brandName='Sua Marca';
 page.brandSubtitle='EMPRESA';
 page.logoImage='/api/media/12345678-1234-4234-8234-123456789012.webp';
 page.menuItems=[{id:'menuinicio',label:'Início',href:'#inicio'},{id:'menuassociado',label:'Área do associado',href:'/entrar'}];
 page.sections[0].widgets.push(
  {id:'iconGrid01',type:'iconGrid',title:'Benefícios',columns:3,items:[{title:'Networking',text:'Conexões',icon:'users'}]},
  {id:'testimonials01',type:'testimonials',title:'Depoimentos',columns:3,items:[{title:'Exemplo',role:'Membro',text:'Depoimento ilustrativo',image:'/api/media/12345678-1234-4234-8234-123456789012.webp'}]},
  {id:'imageText01',type:'imageText',title:'Encontros',imagePosition:'right',image:'/api/media/12345678-1234-4234-8234-123456789012.webp',text:'Encontro mensal'}
 );
 assert.equal(validatePage(page),true);
});
test('rejects malicious navigation links and unsupported icon names',()=>{
 const page=safe() as any;
 page.menuItems=[{id:'menuteste',label:'Clique',href:'javascript:alert(1)'}];
 assert.equal(validatePage(page),false);
 page.menuItems=[{id:'menuteste',label:'Início',href:'#inicio'}];
 page.sections[0].widgets.push({id:'icon01',type:'iconGrid',title:'Ícones',items:[{title:'Item',icon:'evil-html-icon'}]});
 assert.equal(validatePage(page),false);
});
test('supports adding/removing widgets while keeping at least one section',()=>{
 const page=safe() as any;
 page.sections[0].widgets=[];
 assert.equal(validatePage(page),true);
 page.sections=[];
 assert.equal(validatePage(page),false);
});
