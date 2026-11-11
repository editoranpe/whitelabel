import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X, GripVertical, PlusCircle } from 'lucide-react';
import { api } from './api';
import {IconTile, TestimonialGrid, IconGrid, ImageTextBlock} from './BuilderWidgets';

export type CibWidget = {
  id:string; type:'heading'|'text'|'image'|'button'|'features'|'quote'|'faq'|'signup'|'divider'|'spacer'|'testimonials'|'iconGrid'|'imageText';
  title?:string; text?:string; image?:string; url?:string; label?:string;
  imageWidth?:number; imageHeight?:number; imageBytes?:number; imageMime?:string;
  icon?:string; imagePosition?:'left'|'right'; columns?:number;
  color?:string; background?:string; align?:'left'|'center'|'right';fontSize?:number;
  items?:Array<{title?:string;text?:string;role?:string;image?:string;icon?:string}>;
};
export type CibSection = {id:string;label:string;columns:number;background:string;color:string;padding:number;backgroundImage?:string;widgets:CibWidget[]};
export type CibMenuItem = {id:string;label:string;href:string};
/** Header text colors that stay readable on any header color chosen in the editor. */
function headerInk(color:string):Record<string,string>{
  const m=/^#?([0-9a-f]{6})$/i.exec(color||'');
  if(!m)return {};
  const n=parseInt(m[1],16),lin=(c:number)=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4};
  const L=.2126*lin(n>>16&255)+.7152*lin(n>>8&255)+.0722*lin(n&255);
  return L>.45?{'--cib-header-ink':'#242542','--cib-header-sub':'#d1006f','--cib-header-line':'#24254214'}:{'--cib-header-ink':'#ffffff','--cib-header-sub':'#ffd100','--cib-header-line':'#ffffff1c'};
}
export type CibPage = {title:string;font:'sans'|'serif'|'modern';headerColor:string;accentColor:string;sections:CibSection[];menuItems?:CibMenuItem[];logoImage?:string;brandName?:string;brandSubtitle?:string;footerText?:string;privacyTitle?:string;privacyText?:string};
export const freshId = () => 'cib'+Math.random().toString(36).slice(2,11);
export const widgetNames:Record<CibWidget['type'],string> = {
  heading:'Título',text:'Texto',image:'Imagem',button:'Botão',features:'Cards / Benefícios',
  quote:'Frase de destaque',testimonials:'Depoimentos com foto',iconGrid:'Grade de ícones',imageText:'Imagem e texto',faq:'Perguntas frequentes',signup:'Formulário de adesão',divider:'Divisória',spacer:'Espaçador'
};
export function newWidget(type:CibWidget['type']):CibWidget{
  const base:CibWidget={id:freshId(),type,align:'left',fontSize:type==='heading'?42:17};
  if(type==='heading')return {...base,title:'Novo título',text:'Subtítulo opcional'};
  if(type==='text')return {...base,text:'Digite seu texto aqui.'};
  if(type==='image')return {...base,image:'',label:'Imagem do grupo'};
  if(type==='button')return {...base,label:'Saiba mais',url:'#participar'};
  if(type==='features')return {...base,title:'Nossos diferenciais',items:[{title:'Conexões',text:'Crescemos juntos'},{title:'Conhecimento',text:'Aprendizado prático'},{title:'Negócios',text:'Oportunidades reais'}]};
  if(type==='faq')return {...base,title:'Perguntas frequentes',items:[{title:'Como faço parte?',text:'Preencha seu cadastro e aguarde o retorno da comissão.'}]};
  if(type==='quote')return {...base,title:'Frase de destaque',text:'Uma ideia que merece destaque.'};
  if(type==='testimonials')return {...base,title:'Quem participa recomenda',columns:3,items:[{title:'Nome do associado',role:'Profissão ou empresa',text:'Escreva um depoimento real e autorizado.',image:''}]};
  if(type==='iconGrid')return {...base,title:'O que você ganha ao fazer parte',columns:3,items:[{title:'Conexões',text:'Networking que gera novas oportunidades.',icon:'users'},{title:'Conhecimento',text:'Aprendizado prático para crescer.',icon:'lightbulb'},{title:'Negócios',text:'Compartilhe projetos e construa parcerias.',icon:'handshake'}]};
  if(type==='imageText')return {...base,title:'Compartilhando boas experiências',text:'Uma história sobre sua empresa.',label:'NOSSO GRUPO',image:'',imagePosition:'left'};
  if(type==='signup')return {...base,title:'Entre em contato com nossa equipe',text:'Preencha o formulário para manifestar seu interesse.'};
  return base;
}
export {whiteLabelDemoPage as defaultCibPage} from './whiteLabel';
function Signup({w}:{w:CibWidget}){
 const [form,setForm]=useState({name:'',email:'',phone:'',company:'',message:'',consent:false,website:''});
 const [status,setStatus]=useState('');
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setStatus('Enviando...');try{await api('apply','POST',form);setStatus('Recebemos seu interesse. A comissão entrará em contato!');setForm({name:'',email:'',phone:'',company:'',message:'',consent:false,website:''});}catch(err){setStatus((err as Error).message)}};
 return <div className="cib-signup"><h2>{w.title||'Quero participar'}</h2><p>{w.text}</p><form onSubmit={submit}><div className="cib-signup-row"><input aria-label="Nome completo" required placeholder="Nome completo" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input aria-label="E-mail" type="email" required placeholder="E-mail" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div className="cib-signup-row"><input aria-label="WhatsApp" required placeholder="WhatsApp" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><input aria-label="Empresa" required placeholder="Empresa" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}/></div><textarea aria-label="Mensagem" placeholder="Como podemos conectar você?" value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/><label className="cib-consent"><input type="checkbox" required checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/> Autorizo o uso dos meus dados para retorno sobre minha solicitação. <Link to="/privacidade">Política de privacidade</Link>.</label><button className="cib-signup-button">Enviar solicitação <ArrowRight size={16}/></button><div role="status">{status}</div></form></div>
}
function CibImageWidget({w}:{w:CibWidget}){
 const [broken,setBroken]=useState(false);
 React.useEffect(()=>{setBroken(false)},[w.image]);
 const usable=!!w.image&&!broken;
 return <figure className="cib-widget-image">
   {usable?<img src={w.image} alt={w.label||'Imagem do grupo'} loading="lazy" onError={()=>setBroken(true)}/>:
     <div className="cib-widget-image-placeholder" role="img" aria-label="Imagem não disponível">
       <span>✳</span><strong>{w.image?'Não foi possível carregar esta imagem.':'Imagem ainda não enviada'}</strong>
       <small>Abra o widget no editor e escolha um arquivo do seu computador.</small>
     </div>}
   {w.label&&<figcaption>{w.label}</figcaption>}
 </figure>;
}
export function CibWidgetView({widget:w,editing=false}:{widget:CibWidget;editing?:boolean}){
 const style:React.CSSProperties={textAlign:w.align||'left',color:w.color||'inherit',background:w.background||'transparent',fontSize:w.fontSize? w.fontSize:undefined};
 if(w.type==='heading')return <div className="cib-widget-heading" style={style}><h1 style={{fontSize:'inherit'}}>{w.title}</h1>{w.text&&<p>{w.text}</p>}</div>;
 if(w.type==='text')return <div className="cib-widget-text" style={style}>{w.text}</div>;
 if(w.type==='image')return <CibImageWidget w={w}/>;
 if(w.type==='button')return <div style={style}><a className="cib-widget-button" href={editing?'#':w.url||'#participar'} onClick={editing?e=>e.preventDefault():undefined}>{w.label||'Saiba mais'} <ArrowRight size={17}/></a></div>;
 if(w.type==='features')return <div className="cib-widget-features" style={style}><h2>{w.title}</h2><div className="cib-feature-grid">{(w.items||[]).map((item,i)=><article key={i}><span className="cib-feature-icon"><IconTile name={item.icon||'sparkles'}/></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></div>;
 if(w.type==='iconGrid')return <IconGrid widget={w}/>;
 if(w.type==='testimonials')return <TestimonialGrid widget={w}/>;
 if(w.type==='imageText')return <ImageTextBlock widget={w} editing={editing}/>
 if(w.type==='quote')return <blockquote className="cib-widget-quote" style={style}><h2>{w.title}</h2><p>“{w.text}”</p></blockquote>;
 if(w.type==='faq')return <div className="cib-widget-faq" style={style}><h2>{w.title}</h2>{(w.items||[]).map((item,i)=><details key={i}><summary>{item.title}</summary><p>{item.text}</p></details>)}</div>;
 if(w.type==='signup')return editing?<div className="cib-signup cib-signup-mock"><h2>{w.title}</h2><p>{w.text}</p><div className="cib-signup-row"><input disabled placeholder="Nome completo"/><input disabled placeholder="E-mail"/></div><div className="cib-signup-row"><input disabled placeholder="WhatsApp"/><input disabled placeholder="Empresa"/></div><span>Formulário de adesão (interativo no site publicado)</span></div>:<Signup w={w}/>;
 if(w.type==='divider')return <hr className="cib-widget-divider"/>;
 return <div style={{height:Math.max(20,w.fontSize||40)}}/>;
}
export function VisualSite({page,editing=false,selected,select,dragStart,dropAt}:{page:CibPage;editing?:boolean;selected?:string|null;select?:(kind:'section'|'widget',id:string)=>void;dragStart?:(section:string,widget:string)=>void;dropAt?:(section:string,widget:string)=>void}){
 const [menu,setMenu]=useState(false);
 return <div className={`cib-rendered-site cib-font-${page.font}`} style={{'--cib-header':page.headerColor,'--cib-accent':page.accentColor,...headerInk(page.headerColor)} as React.CSSProperties}>
  <header className="cib-visual-header"><a href="/" className="cib-visual-logo" onClick={editing?e=>e.preventDefault():undefined}>{page.logoImage?<img src={page.logoImage} alt="Logotipo da empresa" />:<span className="cib-simple-logo" aria-hidden="true">✳</span>} <strong>{page.brandName||'Sua organização'} <span>{page.brandSubtitle||'PLATAFORMA'}</span></strong></a><button type="button" aria-label={menu?'Fechar menu':'Abrir menu'} className="cib-menu-toggle" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button><nav className={menu?'open':''}>{(page.menuItems!==undefined?page.menuItems:page.sections.slice(0,5).map(s=>({id:s.id,label:s.label,href:`#${s.id}` }))).map(link=><a key={link.id} href={editing?'#':link.href} onClick={editing?e=>e.preventDefault():()=>setMenu(false)}>{link.label}</a>)}{!editing&&<Link to="/entrar">Área do associado</Link>}</nav></header>
  <main>{page.sections.map(section=><section key={section.id} id={section.id} className={`cib-visual-section ${editing&&selected===section.id?'cib-selected':''}`} style={{background:section.background,color:section.color,padding:`${section.padding}px 22px`,backgroundImage:section.backgroundImage?`linear-gradient(#0005,#0005),url("${section.backgroundImage}")`:undefined,backgroundPosition:'center',backgroundSize:'cover'}}>
   {editing&&<button className="cib-section-handle" onClick={()=>select?.('section',section.id)}><PlusCircle size={14}/> Editar seção: {section.label}</button>}
   <div className="cib-visual-grid" style={{gridTemplateColumns:`repeat(${section.columns}, minmax(0, 1fr))`}}>
    {section.widgets.map(widget=><div key={widget.id} className={`cib-visual-widget ${editing?'cib-editable':''} ${selected===widget.id?'cib-selected':''}`} onClick={editing?e=>{e.stopPropagation();select?.('widget',widget.id)}:undefined} draggable={editing} onDragStart={editing?e=>{e.stopPropagation();dragStart?.(section.id,widget.id)}:undefined} onDragOver={editing?e=>e.preventDefault():undefined} onDrop={editing?e=>{e.preventDefault();e.stopPropagation();dropAt?.(section.id,widget.id)}:undefined}>
      {editing&&<span className="cib-widget-handle"><GripVertical size={13}/> {widgetNames[widget.type]}</span>}<CibWidgetView widget={widget} editing={editing}/>
    </div>)}
   </div>
  </section>)}</main>
  <footer className="cib-visual-footer">© {new Date().getFullYear()} {page.footerText||'Sua organização · Conteúdo personalizável'} <Link to="/privacidade">Privacidade</Link></footer>
 </div>;
}
