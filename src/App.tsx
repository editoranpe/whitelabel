import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRoundPlus } from 'lucide-react';
import PublicSite, { Privacy } from './Site';
import Dashboard from './Dashboard';
import VisualEditorV2 from './VisualEditorV2';
import FinanceTools from './FinanceTools';
import { api, User } from './api';

function PortalEntry({activate = false}:{activate?:boolean}) {
  const [query] = useSearchParams();
  const nav = useNavigate();
  const [form,setForm] = useState({name:'',email:'',password:'',setup_token:'',token:query.get('token') || ''});
  const [setup,setSetup] = useState(false),[setupTokenReady,setSetupTokenReady]=useState(true),[checking,setChecking]=useState(!activate),[busy,setBusy]=useState(false),[show,setShow]=useState(false),[error,setError]=useState('');
  useEffect(()=>{ if(!activate) api<{setup_required:boolean;setup_token_ready:boolean}>('setup-status').then(x=>{setSetup(x.setup_required);setSetupTokenReady(x.setup_token_ready);}).catch(e=>setError('Não foi possível acessar as configurações do servidor: '+(e as Error).message)).finally(()=>setChecking(false)); },[activate]);
  const submit = async (event:React.FormEvent)=>{
    event.preventDefault();setError('');setBusy(true);
    try {
      if(activate) { await api('activate','POST',{token:form.token,password:form.password}); nav('/entrar?ativada=1'); }
      else if(setup){ await api('setup','POST',form);setSetup(false);setForm({...form,password:'',setup_token:''});setError('Administrador criado. Agora entre com seu e-mail e senha.'); }
      else { await api('login','POST',{email:form.email,password:form.password});nav('/painel'); }
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <div className="auth-page"><div className="auth-side"><Link to="/" className="auth-back"><ArrowLeft size={17}/> Voltar ao site</Link><div className="auth-side-content"><span className="eyebrow light">PLATAFORMA EDITORA NPE</span><h1>Sua marca merece uma <em>gestão inteligente.</em></h1><p>Uma plataforma modular para sites, pessoas, cobranças, comunicação e relatórios com a identidade de cada empresa.</p><div className="auth-side-mark">✳</div></div><div className="auth-side-bottom">Editora NPE · Nossa História é Criar Legados!</div></div><div className="auth-main"><div className="auth-card"><div className="auth-icon">{activate?<UserRoundPlus size={26}/>:<LockKeyhole size={26}/>}</div><span className="eyebrow">ACESSO PROTEGIDO</span><h2>{activate?'Ative sua conta':setup?'Primeiro acesso da administração':'Bem-vindo de volta'}</h2><p>{activate?'Use o convite fornecido pela administração e defina uma senha segura.':setup?'Para inicializar o sistema, informe o segredo definido no Cloudflare.':'Entre com suas credenciais para acessar seu painel.'}</p>{query.get('ativada')==='1'&&<div className="inline-success">Conta ativada! Agora você já pode entrar.</div>}
      <form onSubmit={submit} className="auth-form">
        {setup&&<label>Nome do administrador<input required placeholder="Nome completo" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>}
        {!activate&&<label>E-mail<input required type="email" autoComplete="username" placeholder="voce@empresa.com.br" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>}
        {activate&&<label>Token do convite<input required placeholder="Código do seu convite" value={form.token} onChange={e=>setForm({...form,token:e.target.value})}/></label>}
        <label>Senha<div className="password-field"><input required type={show?'text':'password'} minLength={setup||activate?12:1} autoComplete={setup||activate?'new-password':'current-password'} placeholder={setup||activate?'Crie uma senha de 12 caracteres ou mais':'Sua senha'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button type="button" onClick={()=>setShow(!show)} aria-label={show?'Ocultar senha':'Mostrar senha'}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        {setup&&<label>Segredo de inicialização (SETUP_TOKEN)<input required type="password" autoComplete="off" placeholder="Configurado no Cloudflare" value={form.setup_token} onChange={e=>setForm({...form,setup_token:e.target.value})}/></label>}
        {setup&&!setupTokenReady&&<div className="inline-error" role="status">O segredo SETUP_TOKEN ainda não foi configurado no Worker. Abra Cloudflare → Worker → Settings → Variables and Secrets e adicione um <strong>Secret</strong> de pelo menos 24 caracteres. Depois atualize esta página.</div>}
        {error&&<div className={error.startsWith('Administrador criado')?'inline-success':'inline-error'} role="alert">{error}</div>}
        <button type="submit" className="button button-primary auth-submit" disabled={busy||checking||(setup&&!setupTokenReady)}>{checking?'Verificando configurações...':busy?'Aguarde...':activate?'Ativar minha conta':setup?'Criar administrador':'Entrar no painel'} <ArrowRight size={18}/></button>
      </form><div className="auth-trust"><ShieldCheck size={17}/> Acesso controlado · Dados protegidos</div><p className="auth-demo">Vai apresentar a plataforma a um cliente? <Link to="/demonstracao">Explore a demonstração</Link> com dados fictícios.</p></div></div></div>;
}

function Protected(){
  const [user,setUser]=useState<User|null>(null),[status,setStatus]=useState<'loading'|'ok'|'error'>('loading');
  useEffect(()=>{api<{user:User}>('me').then(x=>{setUser(x.user);setStatus('ok');}).catch(()=>setStatus('error'));},[]);
  if(status==='loading')return <div className="page-loading">Carregando painel...</div>;
  if(status==='error'||!user)return <Navigate to="/entrar" replace/>;
  return <Dashboard user={user} onLogout={async()=>{await api('logout','POST').catch(()=>{});location.href='/entrar';}}/>;
}

function ProtectedEditor(){
 const [allowed,setAllowed]=useState<'loading'|'yes'|'no'>('loading');
 useEffect(()=>{api<{user:User}>('me').then(x=>setAllowed(x.user.role==='admin'?'yes':'no')).catch(()=>setAllowed('no'));},[]);
 if(allowed==='loading')return <div className="page-loading">Carregando editor...</div>;
 return allowed==='yes'?<VisualEditorV2/>:<Navigate to="/entrar" replace/>;
}

function ProtectedFinanceTools({mode}:{mode:'recurrences'|'import'}){
 const [allowed,setAllowed]=useState<'loading'|'yes'|'no'>('loading');
 useEffect(()=>{api<{user:User}>('me').then(x=>setAllowed(x.user.role==='admin'?'yes':'no')).catch(()=>setAllowed('no'));},[]);
 if(allowed==='loading')return <div className="page-loading">Carregando financeiro...</div>;
 return allowed==='yes'?<FinanceTools mode={mode}/>:<Navigate to="/entrar" replace/>;
}

export default function App(){return <Routes><Route path="/" element={<PublicSite/>}/><Route path="/privacidade" element={<Privacy/>}/><Route path="/entrar" element={<PortalEntry/>}/><Route path="/ativar" element={<PortalEntry activate/>}/><Route path="/painel" element={<Protected/>}/><Route path="/editar-site" element={<ProtectedEditor/>}/><Route path="/assinaturas" element={<ProtectedFinanceTools mode="recurrences"/>}/><Route path="/importar" element={<ProtectedFinanceTools mode="import"/>}/><Route path="/demonstracao" element={<Dashboard demo user={{id:'demo',email:'demonstracao@conectandoideiasbrasil.com',role:'admin',member_id:'demo'}} onLogout={()=>{location.href='/';}}/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
