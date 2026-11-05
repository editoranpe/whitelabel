import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowDown, Eye, Save, Send, Plus, Trash2, Monitor, Smartphone, GripVertical, History, Image as ImageIcon } from 'lucide-react';
import {api} from './api';
import {CibPage,CibSection,CibWidget,VisualSite,defaultCibPage,freshId,newWidget,widgetNames} from './VisualSite';
import {formatImageBytes,uploadSiteImage,type SiteLibraryImage} from './mediaUpload';

type Selection={kind:'section'|'widget';id:string};
type HistoryRow={id:string;version:number;published_at:string};
const clone = <T,>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const colored=(value:string,onChange:(value:string)=>void)=><div className="cib-editor-color"><input type="color" value={value||'#ffffff'} onChange={e=>onChange(e.target.value)}/><input value={value||''} maxLength={7} onChange={e=>onChange(e.target.value)}/></div>;
export default function VisualEditor(){
 const [page,setPage]=useState<CibPage>(()=>clone(defaultCibPage)),[selected,setSelected]=useState<Selection>({kind:'section',id:'inicio'});
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[msg,setMsg]=useState(''),[version,setVersion]=useState(0);
 const [device,setDevice]=useState<'desktop'|'mobile'>('desktop'),[history,setHistory]=useState<HistoryRow[]>([]),[dragged,setDragged]=useState<{section:string;widget:string}|null>(null);
 const [uploading,setUploading]=useState(false),[mediaLibrary,setMediaLibrary]=useState<SiteLibraryImage[]>([]);
 useEffect(()=>{Promise.all([api<{draft:CibPage|null;published:CibPage|null;version:number}>('builder/page'),api<{versions:HistoryRow[]}>('builder/history')]).then(([data,h])=>{if(data.draft||data.published)setPage(clone(data.draft||data.published!));setVersion(data.version);setHistory(h.versions);}).catch(e=>setMsg((e as Error).message)).finally(()=>setLoading(false));},[]);
 useEffect(()=>{api<{images:SiteLibraryImage[]}>('media/library').then(x=>setMediaLibrary(x.images)).catch(()=>{});},[]);
 const currentSection=page.sections.find(s=>s.id===selected.id)||page.sections.find(s=>s.widgets.some(w=>w.id===selected.id))||page.sections[0];
 const currentWidget=selected.kind==='widget'?currentSection?.widgets.find(w=>w.id===selected.id):null;
 const patchSection=(patch:Partial<CibSection>)=>setPage(p=>({...p,sections:p.sections.map(s=>s.id===currentSection.id?{...s,...patch}:s)}));
 const patchWidget=(patch:Partial<CibWidget>)=>setPage(p=>({...p,sections:p.sections.map(s=>({...s,widgets:s.widgets.map(w=>w.id===selected.id?{...w,...patch}:w)}))}));
 const choose=(kind:Selection['kind'],id:string)=>setSelected({kind,id});
 const addSection=()=>{const id=freshId();setPage(p=>({...p,sections:[...p.sections,{id,label:'Nova seção',columns:1,background:'#ffffff',color:'#123d32',padding:60,widgets:[newWidget('heading')]}]}));choose('section',id)};
 const removeSection=()=>{if(page.sections.length<2){setMsg('Mantenha ao menos uma seção.');return;}const filtered=page.sections.filter(s=>s.id!==currentSection.id);setPage({...page,sections:filtered});choose('section',filtered[0].id)};
 const moveSection=(offset:number)=>{const sections=[...page.sections],i=sections.findIndex(s=>s.id===currentSection.id),j=i+offset;if(j<0||j>=sections.length)return;[sections[i],sections[j]]=[sections[j],sections[i]];setPage({...page,sections})};
 const addWidget=(type:CibWidget['type'])=>{const w=newWidget(type);patchSection({widgets:[...currentSection.widgets,w]});choose('widget',w.id)};
 const removeWidget=()=>{if(!currentWidget)return;patchSection({widgets:currentSection.widgets.filter(w=>w.id!==currentWidget.id)});choose('section',currentSection.id)};
 const moveWidget=(offset:number)=>{if(!currentWidget)return;const widgets=[...currentSection.widgets],i=widgets.findIndex(w=>w.id===currentWidget.id),j=i+offset;if(j<0||j>=widgets.length)return;[widgets[i],widgets[j]]=[widgets[j],widgets[i]];patchSection({widgets})};
 const onDrop=(targetSection:string,targetWidget:string)=>{if(!dragged)return;const original=page.sections.find(s=>s.id===dragged.section),target=page.sections.find(s=>s.id===targetSection);const moving=original?.widgets.find(w=>w.id===dragged.widget);if(!moving||!target)return;
  const result=page.sections.map(s=>({...s,widgets:s.widgets.filter(w=>w.id!==moving.id)}));const dst=result.find(s=>s.id===targetSection)!;const index=dst.widgets.findIndex(w=>w.id===targetWidget);dst.widgets.splice(index<0?dst.widgets.length:index,0,moving);setPage({...page,sections:result});choose('widget',moving.id);setDragged(null);
 };
 const assignMedia=(url:string,target:'widget'|'section',id:string,meta?:{width:number;height:number;bytes:number})=>{
   setPage(previous=>({...previous,sections:previous.sections.map(section=>{
     if(target==='section'&&section.id===id)return {...section,backgroundImage:url};
     if(target==='widget')return {...section,widgets:section.widgets.map(w=>w.id===id?{
       ...w,image:url,imageWidth:meta?.width,imageHeight:meta?.height,
       imageBytes:meta?.bytes,imageMime:'image/webp'
     }:w)};
     return section;
   })}));
 };
 const uploadFile=async(file:File|undefined,target:'widget'|'section')=>{
   if(!file||uploading)return;
   const targetId=target==='widget'?currentWidget?.id:currentSection?.id;
   if(!targetId)return;
   setUploading(true);setMsg('Convertendo a imagem para WebP e enviando ao Cloudflare...');
   try{
     const result=await uploadSiteImage(file);
     assignMedia(result.url,target,targetId,{width:result.width,height:result.height,bytes:result.bytes});
     setMediaLibrary(p=>[{id:result.id,url:result.url,name:result.filename,width:result.width,height:result.height,bytes:result.bytes,created_at:new Date().toISOString()},...p].slice(0,100));
     setMsg(`Imagem enviada com sucesso: ${result.width} × ${result.height} px, .webp, ${formatImageBytes(result.bytes)}. Salve o rascunho e publique para atualizar o site.`);
   }catch(error){setMsg((error as Error).message)}
   finally{setUploading(false)}
 };
 const mediaControl=(target:'widget'|'section',id:string)=><div className="cib-media-control">
    <div className="cib-media-guide"><strong>Imagem recomendada</strong><span><b>Formato:</b> .webp</span><span><b>Dimensões:</b> 1600 × 900 px (horizontal)</span><span><b>Peso máximo:</b> 900 KB</span><small>Escolha JPG, PNG ou WebP. O editor converte e otimiza automaticamente antes de enviar ao Cloudflare.</small></div>
    <label className="cib-media-picker"><ImageIcon size={17}/> {uploading?'Enviando arquivo...':'Selecionar e enviar imagem'}
      <input type="file" accept="image/webp,image/jpeg,image/png,.webp,.jpg,.jpeg,.png" disabled={uploading} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void uploadFile(file,target);}}/>
    </label>
    {mediaLibrary.length>0&&<div className="cib-media-library"><strong>Imagens já enviadas</strong><div className="cib-media-library-grid">{mediaLibrary.slice(0,20).map(item=><button key={item.id} type="button" title={`${item.name} · ${item.width} × ${item.height} px · ${formatImageBytes(item.bytes)}`} onClick={()=>{assignMedia(item.url,target,id,{width:item.width,height:item.height,bytes:item.bytes});setMsg('Imagem selecionada da biblioteca. Salve e publique para atualizar o site.')}}><img src={item.url} alt={item.name}/></button>)}</div></div>}
   </div>;
 const save=async(publish=false)=>{if(uploading){setMsg('Finalize o upload antes de salvar ou publicar.');return;}setBusy(true);setMsg('');try{await api('builder/page','PATCH',{page});if(publish){const result=await api<{version:number}>('builder/publish','POST',{});setVersion(result.version);const h=await api<{versions:HistoryRow[]}>('builder/history');setHistory(h.versions);setMsg('Site publicado! A nova versão já está disponível para os visitantes.');}else setMsg('Rascunho salvo. O site público não foi alterado.');}catch(e){setMsg((e as Error).message);}finally{setBusy(false)}};
 const restore=async(v:number)=>{if(!confirm(`Restaurar versão ${v} como rascunho? Você ainda precisará clicar em Publicar.`))return;setBusy(true);try{await api('builder/restore','POST',{version:v});const r=await api<{draft:CibPage}>('builder/page');if(r.draft)setPage(r.draft);setMsg(`Versão ${v} carregada como rascunho.`);}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
 if(loading)return <div className="page-loading">Carregando editor do site...</div>;
 return <div className="cib-editor-shell">
  <aside className="cib-editor-sidebar">
   <div className="cib-editor-bar"><Link to="/painel"><ArrowLeft size={17}/> Voltar</Link><strong>Editor visual</strong><span className="cib-editor-status">v{version}</span></div>
   <div className="cib-editor-scroll">
    <h3>Configurações gerais</h3>
    <label>Título do site<input value={page.title} onChange={e=>setPage({...page,title:e.target.value})}/></label>
    <label>Tipografia<select value={page.font} onChange={e=>setPage({...page,font:e.target.value as CibPage['font']})}><option value="modern">Moderna</option><option value="sans">Sem serifa</option><option value="serif">Clássica / serifa</option></select></label>
    <label>Cor do cabeçalho{colored(page.headerColor,v=>setPage({...page,headerColor:v}))}</label>
    <label>Cor principal / destaque{colored(page.accentColor,v=>setPage({...page,accentColor:v}))}</label>
    <div className="cib-editor-heading"><h3>Seções da página</h3><button title="Adicionar seção" onClick={addSection}><Plus size={17}/></button></div>
    <div className="cib-editor-section-list">{page.sections.map((s,i)=><button key={s.id} className={currentSection?.id===s.id?'active':''} onClick={()=>choose('section',s.id)}><span><GripVertical size={15}/>{i+1}. {s.label}</span><small>{s.widgets.length} widgets</small></button>)}</div>
    {currentSection&&<><div className="cib-editor-heading"><h3>{selected.kind==='section'?'Editar seção':'Editar widget'}</h3><div className="cib-editor-actions"><button title="Mover para cima" onClick={()=>selected.kind==='section'?moveSection(-1):moveWidget(-1)}><ArrowUp size={15}/></button><button title="Mover para baixo" onClick={()=>selected.kind==='section'?moveSection(1):moveWidget(1)}><ArrowDown size={15}/></button><button title="Excluir" onClick={()=>selected.kind==='section'?removeSection():removeWidget()}><Trash2 size={15}/></button></div></div>
     {selected.kind==='section'?<div className="cib-editor-properties">
       <label>Nome da seção<input value={currentSection.label} onChange={e=>patchSection({label:e.target.value})}/></label>
       <label>Colunas<select value={currentSection.columns} onChange={e=>patchSection({columns:Number(e.target.value)})}><option value="1">1 coluna</option><option value="2">2 colunas</option><option value="3">3 colunas</option></select></label>
       <label>Espaçamento vertical ({currentSection.padding}px)<input type="range" min="16" max="160" value={currentSection.padding} onChange={e=>patchSection({padding:Number(e.target.value)})}/></label>
       <label>Cor de fundo{colored(currentSection.background,v=>patchSection({background:v}))}</label>
       <label>Cor do texto{colored(currentSection.color,v=>patchSection({color:v}))}</label>
       <div className="cib-media-property"><h4>Imagem de fundo da seção</h4>{currentSection.backgroundImage&&<div className="cib-media-current"><img src={currentSection.backgroundImage} alt="Imagem de fundo atual"/><button type="button" onClick={()=>patchSection({backgroundImage:''})}>Remover imagem</button></div>}{mediaControl('section',currentSection.id)}</div>
      </div>:currentWidget&&<div className="cib-editor-properties">
       <p className="cib-editor-selected">Widget: {widgetNames[currentWidget.type]}</p>
       {['heading','features','quote','faq','signup'].includes(currentWidget.type)&&<label>Título<input value={currentWidget.title||''} onChange={e=>patchWidget({title:e.target.value})}/></label>}
       {['heading','text','quote','signup'].includes(currentWidget.type)&&<label>Texto<textarea rows={5} value={currentWidget.text||''} onChange={e=>patchWidget({text:e.target.value})}/></label>}
       {currentWidget.type==='image'&&<><div className="cib-media-property"><h4>Imagem do widget</h4>{currentWidget.image&&<div className="cib-media-current"><img src={currentWidget.image} alt="Imagem atual" onError={e=>{e.currentTarget.style.display='none'}}/>{currentWidget.image.startsWith('https://')&&<p>Imagem antiga por URL externa. Substitua por um arquivo enviado ao Cloudflare.</p>}</div>}{mediaControl('widget',currentWidget.id)}{currentWidget.imageWidth&&currentWidget.imageBytes&&<p className="cib-media-details"><strong>Arquivo salvo:</strong> {currentWidget.imageWidth} × {currentWidget.imageHeight} px · .webp · {formatImageBytes(currentWidget.imageBytes)}</p>}</div><label>Legenda da imagem<input maxLength={100} value={currentWidget.label||''} onChange={e=>patchWidget({label:e.target.value})}/></label></>}
       {currentWidget.type==='button'&&<><label>Texto do botão<input value={currentWidget.label||''} onChange={e=>patchWidget({label:e.target.value})}/></label><label>Destino (URL ou #seção)<input value={currentWidget.url||''} onChange={e=>patchWidget({url:e.target.value})}/></label></>}
       {['features','faq'].includes(currentWidget.type)&&<><h4>Cards / itens</h4>{(currentWidget.items||[]).map((item,i)=><div className="cib-editor-item" key={i}><label>Item {i+1}<input value={item.title||''} onChange={e=>patchWidget({items:(currentWidget.items||[]).map((x,j)=>j===i?{...x,title:e.target.value}:x)})}/></label><textarea rows={3} value={item.text||''} onChange={e=>patchWidget({items:(currentWidget.items||[]).map((x,j)=>j===i?{...x,text:e.target.value}:x)})}/><button onClick={()=>patchWidget({items:(currentWidget.items||[]).filter((_,j)=>j!==i)})}><Trash2 size={13}/> Remover item</button></div>)}<button onClick={()=>patchWidget({items:[...(currentWidget.items||[]),{title:'Novo item',text:'Descrição'}]})} disabled={(currentWidget.items||[]).length>=15}><Plus size={14}/> Adicionar item</button></>}
       <label>Alinhamento<select value={currentWidget.align||'left'} onChange={e=>patchWidget({align:e.target.value as CibWidget['align']})}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
       {!['image','features','faq','signup'].includes(currentWidget.type)&&<label>Tamanho da fonte ({currentWidget.fontSize||17}px)<input type="range" min="10" max="90" value={currentWidget.fontSize||17} onChange={e=>patchWidget({fontSize:Number(e.target.value)})}/></label>}
       <label>Cor do widget{colored(currentWidget.color||'#123d32',v=>patchWidget({color:v}))}</label>
       <label>Fundo do widget{colored(currentWidget.background||'#ffffff',v=>patchWidget({background:v}))}</label>
      </div>}
     <div className="cib-editor-heading"><h3>Adicionar widget</h3><Plus size={16}/></div><div className="cib-widget-palette">{Object.entries(widgetNames).map(([type,name])=><button key={type} onClick={()=>addWidget(type as CibWidget['type'])}><Plus size={15}/>{name}</button>)}</div>
    </>}
    <div className="cib-editor-heading"><h3><History size={16}/> Histórico publicado</h3></div>
    <div className="cib-editor-history">{history.map(h=><button key={h.id} onClick={()=>void restore(h.version)}>Versão {h.version} · {new Date(h.published_at).toLocaleDateString('pt-BR')} <span>Restaurar</span></button>)}{!history.length&&<p>Nenhuma publicação anterior.</p>}</div>
   </div>
   <div className="cib-editor-footer">{msg&&<p role="status">{msg}</p>}<div><button onClick={()=>void save(false)} disabled={busy||uploading}><Save size={16}/> Salvar rascunho</button><button className="cib-editor-publish" onClick={()=>void save(true)} disabled={busy||uploading}><Send size={16}/> Publicar</button></div></div>
  </aside>
  <div className="cib-editor-stage"><div className="cib-editor-toolbar"><span><Eye size={17}/> Prévia do site, clique nos widgets para editar e arraste para reorganizar</span><div><button className={device==='desktop'?'active':''} onClick={()=>setDevice('desktop')} title="Desktop"><Monitor size={17}/></button><button className={device==='mobile'?'active':''} onClick={()=>setDevice('mobile')} title="Celular"><Smartphone size={17}/></button><a href="/" target="_blank" rel="noreferrer">Ver site <Eye size={16}/></a></div></div><div className={`cib-editor-preview ${device}`}><VisualSite page={page} editing selected={selected.id} select={choose} dragStart={(section,widget)=>setDragged({section,widget})} dropAt={onDrop}/></div></div>
 </div>;
}
