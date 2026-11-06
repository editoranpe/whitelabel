/** Read-only smoke check of the public Cloudflare Worker; no credentials used. */
const input=(process.argv[2]||process.env.NPE_SITE_ORIGIN||'').trim();
if(!input){console.error('Informe o endereço real do Worker.');process.exit(2)}
let base;
try{
 const url=new URL(input);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.search||url.hash||url.pathname!=='/')
  throw Error('URL inválida');
 base=url.origin;
}catch{console.error('Use a URL https://<worker>.<subdominio>.workers.dev');process.exit(2)}
let errors=0;
async function inspect(path,check){
 try{
  const response=await fetch(base+path,{signal:AbortSignal.timeout(18000),redirect:'follow',headers:{accept:'*/*'}});
  const raw=await response.text();
  const type=response.headers.get('content-type')||'(não informado)';
  let content;
  try{content=JSON.parse(raw)}catch{content=null}
  const result=check({response,raw,type,content});
  if(!response.ok||result!==true){
   errors++;
   const sample=raw.replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').slice(0,135);
   console.error(`✗ ${path}: HTTP ${response.status} / ${type} / ${typeof result==='string'?result:'resposta inesperada'}`);
   console.error(`  Prévia de resposta pública: ${JSON.stringify(sample)}`);
  }else console.log(`✓ ${path}: HTTP ${response.status} / ${type}`);
 }catch(error){errors++;console.error(`✗ ${path}: ${String(error.message||error)}`)}
}
await inspect('/',({raw,type})=>/<!doctype|<html/i.test(raw)&&/text\/html/i.test(type)||'Página inicial ainda não é o site NPE');
await inspect('/api/version',({content})=>{
 if(!content)return 'Sem JSON válido da API';
 if(content.runtime!=='cloudflare-worker'||content.editor_release!=='npe-white-label-v1')return 'Worker ainda não executa a versão NPE';
 if(!content.deployment?.d1_bound)return 'Banco D1 não vinculado ao Worker';
 return true;
});
await inspect('/api/health',({content})=>content?.ok===true||'API ou estrutura D1 indisponível');
await inspect('/api/setup-status',({content})=>{
 if(typeof content?.setup_required!=='boolean')return 'Primeiro acesso não responde corretamente';
 if(content.setup_required&&!content.setup_token_ready)return 'SETUP_TOKEN ausente no Worker';
 return true;
});
await inspect('/entrar',({raw,type})=>/<html|<!doctype/i.test(raw)&&/text\/html/i.test(type)||'Página de acesso não disponível');
if(errors){console.error(`NPE_DEPLOY_CHECK: ${errors} de 5 verificações pendentes em ${base}`);process.exitCode=1}
else console.log('NPE_DEPLOY_CHECK: Site público, API, D1 e primeiro acesso disponíveis em '+base);
