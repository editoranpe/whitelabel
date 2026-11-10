import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

function fixture(extra={}){
 const dir=mkdtempSync(join(tmpdir(),'npe-cloudflare-'));
 const path=join(dir,'wrangler.jsonc');
 writeFileSync(path,JSON.stringify({
  name:'npe-white-label-demo',
  d1_databases:[{binding:'DB',database_name:'npe-white-label-demo',database_id:'REPLACE_WITH_A_NEW_D1_DATABASE_ID'}],
  vars:{SITE_ORIGIN:'https://npe-white-label-demo.YOUR_SUBDOMAIN.workers.dev'},
  keep_vars:true,...extra
 }));
 return {dir,path};
}
const invoke=(path,variables={})=>spawnSync(process.execPath,['scripts/prepare-cloudflare.mjs','--force'],{
 cwd:process.cwd(),encoding:'utf8',
 env:{...process.env,NPE_WRANGLER_CONFIG_FILE:path,
  NPE_WORKER_NAME:'npe-cliente-demo',
  NPE_D1_DATABASE_ID:'e3d71ad0-28ed-4115-a006-8626c66ca178',
  NPE_D1_DATABASE_NAME:'npe-cliente-demo',
  ...variables}
});
test('Cloudflare build resolves dedicated worker and D1 while preserving assets',()=>{
 const {dir,path}=fixture();
 try{
  const p=invoke(path,{NPE_SITE_ORIGIN:'https://npe-cliente-demo.example.workers.dev/'});
  assert.equal(p.status,0,p.stderr);
  const config=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(config.name,'npe-cliente-demo');
  assert.equal(config.d1_databases[0].binding,'DB');
  assert.equal(config.d1_databases[0].database_name,'npe-cliente-demo');
  assert.equal(config.d1_databases[0].database_id,'e3d71ad0-28ed-4115-a006-8626c66ca178');
  assert.equal(config.vars.SITE_ORIGIN,'https://npe-cliente-demo.example.workers.dev');
  assert.equal(config.keep_vars,true);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('refuses missing D1, invalid Worker name and original Conectando Ideias Worker',()=>{
 const {dir,path}=fixture();
 try{
  assert.notEqual(invoke(path,{NPE_D1_DATABASE_ID:'REPLACE_WITH_A_NEW_D1_DATABASE_ID'}).status,0);
  assert.notEqual(invoke(path,{NPE_WORKER_NAME:'conectando-ideias-brasil'}).status,0);
  assert.notEqual(invoke(path,{NPE_WORKER_NAME:'not valid'}).status,0);
  assert.notEqual(invoke(path,{NPE_SITE_ORIGIN:'https://conectando-ideias-brasil.digitalnpe.workers.dev'}).status,0);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('omits placeholder origin to avoid sending notices to an invented URL',()=>{
 const {dir,path}=fixture({vars:{SITE_ORIGIN:'https://npe-white-label-demo.YOUR_SUBDOMAIN.workers.dev'}});
 try{
  const p=invoke(path);
  assert.equal(p.status,0,p.stderr);
  const config=JSON.parse(readFileSync(path,'utf8'));
  assert.ok(!('SITE_ORIGIN' in (config.vars||{})));
 }finally{rmSync(dir,{recursive:true,force:true})}
});

test('uses the existing whitelabel Worker name and verified origin when optional overrides are absent',()=>{
 const {dir,path}=fixture({name:'whitelabel',vars:{SITE_ORIGIN:'https://whitelabel.digitalnpe.workers.dev'}});
 try{
  const result=invoke(path,{NPE_WORKER_NAME:'',NPE_D1_DATABASE_NAME:''});
  assert.equal(result.status,0,result.stderr);
  const deployed=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(deployed.name,'whitelabel');
  assert.equal(deployed.d1_databases[0].database_name,'npe-white-label-demo');
  assert.equal(deployed.vars.SITE_ORIGIN,'https://whitelabel.digitalnpe.workers.dev');
 }finally{rmSync(dir,{recursive:true,force:true})}
});
