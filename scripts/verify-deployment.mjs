/** Public deployment smoke test. No credentials or admin data needed.
 * Invoke: node scripts/verify-deployment.mjs https://YOUR-WORKER.SUBDOMAIN.workers.dev
 */
const input=(process.argv[2]||process.env.NPE_SITE_ORIGIN||'').trim();
if(!input){console.error('Informe a URL real do Worker para testar o site e o painel.');process.exit(2)}
let site;
try{
  site=new URL(input);
  if(site.protocol!=='https:'||!site.hostname.endsWith('.workers.dev')||site.username||site.password||site.search||site.hash||site.pathname!=='/')
    throw new Error('URL inválida');
}catch{console.error('Informe uma URL HTTPS pública do Cloudflare Workers, sem caminho.');process.exit(2)}
site=site.origin;
const get=async(path)=>{
 const response=await fetch(site+path,{signal:AbortSignal.timeout(20000),redirect:'follow',headers:{accept:path==='/'?'text/html':'application/json'}});
 if(!response.ok)throw Error(`${path} respondeu HTTP ${response.status}`);
 return path==='/'?await response.text():await response.json();
};
const test=async()=>{
 const home=await get('/');
 if(!/<html|<!doctype/i.test(home))throw Error('A página inicial não retornou HTML');
 console.log('✓ Página institucional: OK');
 const version=await get('/api/version');
 if(version.runtime!=='cloudflare-worker'||version.editor_release!=='npe-white-label-v1')
  throw Error('Worker está executando uma versão diferente do White Label NPE');
 if(!version.deployment?.d1_bound)throw Error('Banco D1 não conectado ao Worker (deployment.d1_bound=false)');
 console.log('✓ Worker NPE + binding D1: OK');
 const health=await get('/api/health');
 if(!health.ok)throw Error('A API não confirmou inicialização do D1');
 console.log('✓ API e esquema inicial do banco D1: OK');
 const setup=await get('/api/setup-status');
 if(typeof setup.setup_required!=='boolean')throw Error('Resposta inválida do primeiro acesso');
 if(setup.setup_required&&!setup.setup_token_ready)
  throw Error('Configure SETUP_TOKEN como Secret em Production para criar o administrador');
 console.log('✓ Primeiro acesso: '+(setup.setup_required?'pronto para criar administrador':'administrador já configurado'));
 const login=await get('/entrar');
 if(!/<html|<!doctype/i.test(login))throw Error('Tela de login não foi entregue pelo Worker');
 console.log('✓ Site e portal de acesso: OK');
 console.log('Cloudflare NPE pronto: '+site);
};
test().catch(e=>{console.error('FALHA NPE_DEPLOY_CHECK:',String(e.message||e));process.exitCode=1});
