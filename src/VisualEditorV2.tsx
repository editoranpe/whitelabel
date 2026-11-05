import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {
 ArrowLeft,ArrowUp,ArrowDown,Plus,Trash2,Copy,Save,Send,Monitor,Smartphone,
 GripVertical,Undo2,Redo2,Eye,Image as ImageIcon,LayoutGrid,Layers,Palette,
 Menu as MenuIcon,History,Type,MessageSquareQuote,PanelTop,SquareMousePointer,
 Columns3,Check,ChevronDown,ChevronUp,Upload,RotateCcw,ChevronsUpDown
} from 'lucide-react';
import {api} from './api';
import {VisualSite,defaultCibPage,freshId,newWidget,widgetNames,type CibPage,type CibMenuItem,type CibSection,type CibWidget} from './VisualSite';
import {formatImageBytes,uploadSiteImage,type SiteLibraryImage,type UploadedSiteImage} from './mediaUpload';
import {iconLabels,IconTile} from './BuilderWidgets';

type SelectKind='section'|'widget';
type Selection={kind:SelectKind;id:string};
type Tab='structure'|'add'|'menus'|'style';
type HistoryRow={id:string;version:number;published_at:string};
type DragValue={kind:'section'|'widget';id:string;sectionId?:string};
type Template='blank'|'intro'|'icons'|'testimonials'|'imageText'|'faq'|'callToAction';
const dup=<T,>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const date=(s:string)=>new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const chooseColor=(value:string,onChange:(v:string)=>void)=><div className="fl-color"><input aria-label="Selecionar cor" type="color" value={/^#[0-9a-f]{6}$/i.test(value)?value:'#ffffff'} onChange={e=>onChange(e.target.value)}/><input aria-label="Código da cor" value={value} maxLength={7} onChange={e=>onChange(e.target.value)}/></div>;
const templateNames:Record<Template,string>={
 blank:'Seção em branco',intro:'Título e introdução',icons:'Grade de benefícios',
 testimonials:'Depoimentos com fotos',imageText:'Imagem e texto',faq:'Perguntas e respostas',callToAction:'Convite para participar'
};
const widgetIcons:Record<CibWidget['type'],ReactNode>={
 heading:<Type size={19}/>,text:<Type size={17}/>,image:<ImageIcon size={19}/>,
 button:<SquareMousePointer size={19}/>,features:<LayoutGrid size={19}/>,
 iconGrid:<LayoutGrid size={19}/>,testimonials:<MessageSquareQuote size={19}/>,
 imageText:<Columns3 size={19}/>,quote:<MessageSquareQuote size={19}/>,
 faq:<MessageSquareQuote size={19}/>,signup:<SquareMousePointer size={19}/>,
 divider:<Layers size={19}/>,spacer:<ChevronsUpDown size={19}/>
};
function makeSection(template:Template):CibSection{
 const id=freshId(),section:CibSection={id,label:templateNames[template],columns:1,background:'#ffffff',color:'#153b30',padding:64,widgets:[]};
 const w=(type:CibWidget['type'])=>newWidget(type);
 if(template==='intro'){section.widgets=[{...w('heading'),title:'Um encontro de grandes ideias'},w('text')]}
 if(template==='icons')section.widgets=[w('iconGrid')];
 if(template==='testimonials')section.widgets=[w('testimonials')];
 if(template==='imageText')section.widgets=[w('imageText')];
 if(template==='faq')section.widgets=[w('faq')];
 if(template==='callToAction'){section.background='#0c4637';section.color='#ffffff';section.widgets=[{...w('heading'),title:'Conecte-se ao grupo',text:'Participe de uma comunidade que cresce junto.'},{...w('button'),label:'Quero fazer parte',url:'#participar'}]}
 return section;
}
function reorder<T>(items:T[],from:number,to:number):T[]{
 if(from<0||to<0||from>=items.length||to>=items.length||from===to)return items;
 const copy=[...items];const [item]=copy.splice(from,1);copy.splice(to,0,item);return copy;
}
function IconButton({label,click,children,disabled=false,danger=false}:{label:string;click:()=>void;children:ReactNode;disabled?:boolean;danger?:boolean}){
 return <button type="button" className={`fl-mini-action ${danger?'danger':''}`} aria-label={label} title={label} onClick={click} disabled={disabled}>{children}</button>;
}
function TextField({label,value,change,multiline=false,placeholder='',maxLength=4000}:{label:string;value:string;change:(x:string)=>void;multiline?:boolean;placeholder?:string;maxLength?:number}){
 return <label className="fl-field"><span>{label}</span>{multiline?<textarea rows={4} value={value} maxLength={maxLength} placeholder={placeholder} onChange={e=>change(e.target.value)}/>:<input value={value} maxLength={maxLength} placeholder={placeholder} onChange={e=>change(e.target.value)}/>}</label>;
}
function MediaSelect({label,value,library,onUpload,onPick,meta,uploading}:{label:string;value?:string;library:SiteLibraryImage[];onUpload:(file:File)=>void;onPick:(url:string,meta?:SiteLibraryImage)=>void;meta?:{width?:number;height?:number;bytes?:number};uploading:boolean}){
 const [expanded,setExpanded]=useState(false);
 return <div className="fl-media-select">
   <span className="fl-field-label">{label}</span>
   {value?<div className="fl-media-preview"><img src={value} alt="Imagem selecionada"/><IconButton label="Remover imagem" click={()=>onPick('')} danger><Trash2 size={15}/></IconButton></div>:<div className="fl-media-empty"><ImageIcon size={20}/><span>Nenhuma imagem selecionada</span></div>}
   {meta?.width&&meta?.height&&<small>{meta.width} × {meta.height} px · {meta.bytes?formatImageBytes(meta.bytes):'WebP'}</small>}
   <label className="fl-media-upload"><Upload size={16}/>{uploading?'Otimizando imagem…':'Enviar do computador'}<input type="file" disabled={uploading} accept="image/webp,image/png,image/jpeg,.webp,.png,.jpg,.jpeg" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)onUpload(file)}}/></label>
   <p className="fl-helper">Recomendado: <strong>1600 × 900 px · .webp · até 900 KB.</strong> JPG e PNG são convertidos automaticamente.</p>
   {!!library.length&&<><button type="button" className="fl-library-toggle" onClick={()=>setExpanded(!expanded)}>{expanded?'Ocultar':'Escolher da'} biblioteca <ChevronDown size={15}/></button>
   {expanded&&<div className="fl-library-grid">{library.slice(0,35).map(x=><button type="button" key={x.id} title={x.name+' · '+formatImageBytes(x.bytes)} onClick={()=>{onPick(x.url,x);setExpanded(false)}}><img src={x.url} alt={x.name}/></button>)}</div>}</>}
 </div>;
}
export default function VisualEditorV2(){
 const [page,setPage]=useState<CibPage>(()=>dup(defaultCibPage));
 const [selected,setSelected]=useState<Selection>({kind:'section',id:'inicio'});
 const [tab,setTab]=useState<Tab>('structure'),[device,setDevice]=useState<'desktop'|'mobile'>('desktop');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false);
 const [notice,setNotice]=useState(''),[dirty,setDirty]=useState(false),[version,setVersion]=useState(0);
 const [library,setLibrary]=useState<SiteLibraryImage[]>([]),[history,setHistory]=useState<HistoryRow[]>([]);
 const [drag,setDrag]=useState<DragValue|null>(null),[historyOpen,setHistoryOpen]=useState(false);
 const [revision,setRevision]=useState(0);
 const undoRef=useRef<CibPage[]>([]),redoRef=useRef<CibPage[]>([]);
 useEffect(()=>{
  Promise.all([api<{draft:CibPage|null;published:CibPage|null;version:number}>('builder/page'),api<{versions:HistoryRow[]}>('builder/history')])
   .then(([state,versions])=>{setPage(dup(state.draft||state.published||defaultCibPage));setVersion(state.version);setHistory(versions.versions)})
   .catch(e=>setNotice((e as Error).message)).finally(()=>setLoading(false));
  api<{images:SiteLibraryImage[]}>('media/library').then(x=>setLibrary(x.images)).catch(()=>{});
 },[]);
 const selectedSection=page.sections.find(s=>s.id===selected.id)||page.sections.find(s=>s.widgets.some(w=>w.id===selected.id))||page.sections[0];
 const selectedWidget=selected.kind==='widget'?selectedSection?.widgets.find(w=>w.id===selected.id):undefined;
 const change=(update:(p:CibPage)=>CibPage)=>{
   undoRef.current.push(dup(page));if(undoRef.current.length>30)undoRef.current.shift();
   redoRef.current=[];setPage(update(page));setDirty(true);setRevision(x=>x+1);
 };
 const patchSection=(id:string,patch:Partial<CibSection>)=>change(p=>({...p,sections:p.sections.map(s=>s.id===id?{...s,...patch}:s)}));
 const patchWidget=(id:string,patch:Partial<CibWidget>)=>change(p=>({...p,sections:p.sections.map(s=>({...s,widgets:s.widgets.map(w=>w.id===id?{...w,...patch}:w)}))}));
 const choose=(kind:SelectKind,id:string)=>{setSelected({kind,id});setTab('structure')};
 const undo=()=>{
   const before=undoRef.current.pop();if(!before)return;
   redoRef.current.push(dup(page));setPage(before);setDirty(true);setRevision(x=>x+1);
   setSelected({kind:'section',id:before.sections[0].id});
 };
 const redo=()=>{
   const next=redoRef.current.pop();if(!next)return;
   undoRef.current.push(dup(page));setPage(next);setDirty(true);setRevision(x=>x+1);
   setSelected({kind:'section',id:next.sections[0].id});
 };
 const addSection=(type:Template)=> {
   if(page.sections.length>=35){setNotice('Limite de 35 seções por página.');return}
   const section=makeSection(type);
   change(p=>({...p,sections:[...p.sections,section]}));
   choose('section',section.id);
   setNotice('Seção adicionada. Selecione seus widgets ou clique na prévia para editar.');
 };
 const duplicateSection=(id:string)=>{
   if(page.sections.length>=35)return setNotice('Limite de 35 seções.');
   const original=page.sections.find(s=>s.id===id);if(!original)return;
   const copy={...dup(original),id:freshId(),label:original.label+' (cópia)',widgets:original.widgets.map(w=>({...w,id:freshId()}))};
   change(p=>{const next=[...p.sections];next.splice(p.sections.findIndex(s=>s.id===id)+1,0,copy);return {...p,sections:next}});
   choose('section',copy.id);
 };
 const deleteSection=(id:string)=>{
   if(page.sections.length===1)return setNotice('A página precisa ter ao menos uma seção. Você pode deixar a seção em branco.');
   if(!window.confirm('Excluir esta seção e todos os widgets dentro dela? Você poderá usar Desfazer.'))return;
   change(p=>({...p,sections:p.sections.filter(s=>s.id!==id)}));
   setSelected({kind:'section',id:page.sections.find(s=>s.id!==id)?.id||page.sections[0].id});
 };
 const moveSection=(id:string,delta:number)=>{
   const from=page.sections.findIndex(s=>s.id===id),to=from+delta;
   change(p=>({...p,sections:reorder(p.sections,from,to)}));
 };
 const addWidget=(type:CibWidget['type'],sectionId=selectedSection?.id)=>{
   if(!sectionId)return;
   const section=page.sections.find(s=>s.id===sectionId);
   if(!section||section.widgets.length>=24 || page.sections.reduce((n,s)=>n+s.widgets.length,0)>=150){setNotice('Limite de widgets alcançado nesta seção ou página.');return}
   const w=newWidget(type);
   change(p=>({...p,sections:p.sections.map(s=>s.id===sectionId?{...s,widgets:[...s.widgets,w]}:s)}));
   choose('widget',w.id);setNotice('Widget inserido. Configure o conteúdo à esquerda.');
 };
 const duplicateWidget=(id:string)=>{
   const section=page.sections.find(s=>s.widgets.some(w=>w.id===id));
   if(!section||section.widgets.length>=24)return setNotice('Limite de 24 widgets nesta seção.');
   const w=section.widgets.find(x=>x.id===id);if(!w)return;
   const copy={...dup(w),id:freshId()};
   change(p=>({...p,sections:p.sections.map(s=>s.id===section.id?{...s,widgets:[...s.widgets.slice(0,s.widgets.findIndex(x=>x.id===id)+1),copy,...s.widgets.slice(s.widgets.findIndex(x=>x.id===id)+1)]}:s)}));
   choose('widget',copy.id);
 };
 const deleteWidget=(id:string)=>{
   const section=page.sections.find(s=>s.widgets.some(w=>w.id===id));if(!section)return;
   change(p=>({...p,sections:p.sections.map(s=>s.id===section.id?{...s,widgets:s.widgets.filter(w=>w.id!==id)}:s)}));
   setSelected({kind:'section',id:section.id});setNotice('Widget excluído. Clique em Desfazer para recuperá-lo.');
 };
 const moveWidget=(id:string,delta:number)=>{
   const section=page.sections.find(s=>s.widgets.some(w=>w.id===id));if(!section)return;
   const from=section.widgets.findIndex(w=>w.id===id);
   change(p=>({...p,sections:p.sections.map(s=>s.id===section.id?{...s,widgets:reorder(s.widgets,from,from+delta)}:s)}));
 };
 const drop=(source:DragValue,target:DragValue)=>{
   if(source.kind==='section'&&target.kind==='section'){
     const from=page.sections.findIndex(s=>s.id===source.id),to=page.sections.findIndex(s=>s.id===target.id);
     if(from!==to)change(p=>({...p,sections:reorder(p.sections,from,to)}));return;
   }
   if(source.kind!=='widget'||target.kind!=='widget')return;
   const src=page.sections.find(s=>s.widgets.some(w=>w.id===source.id));
   const dst=page.sections.find(s=>s.widgets.some(w=>w.id===target.id));
   const moving=src?.widgets.find(w=>w.id===source.id);
   if(!src||!dst||!moving||source.id===target.id || (src.id!==dst.id&&dst.widgets.length>=24))return;
   change(p=>{
     const next=dup(p);
     const a=next.sections.find(s=>s.id===src.id)!;const b=next.sections.find(s=>s.id===dst.id)!;
     a.widgets=a.widgets.filter(w=>w.id!==source.id);
     const idx=b.widgets.findIndex(w=>w.id===target.id);
     b.widgets.splice(idx,0,moving);return next;
   });
   choose('widget',moving.id);
 };
 const upload=async(file:File,onDone:(image:UploadedSiteImage)=>void)=>{
   if(uploading)return;setUploading(true);setNotice('Otimizando e enviando imagem…');
   try{
     const image=await uploadSiteImage(file);
     setLibrary(p=>[{id:image.id,url:image.url,name:image.filename,width:image.width,height:image.height,bytes:image.bytes,created_at:new Date().toISOString()},...p].slice(0,100));
     onDone(image);setNotice(`Imagem salva: ${image.width} × ${image.height} px, ${formatImageBytes(image.bytes)}. Publique para atualizar o site.`);
   }catch(e){setNotice((e as Error).message)}finally{setUploading(false)}
 };
 const media=(label:string,value:string|undefined,save:(url:string,meta?:SiteLibraryImage)=>void)=>
   <MediaSelect label={label} value={value} library={library} uploading={uploading}
     onUpload={file=>void upload(file,img=>save(img.url,{id:img.id,url:img.url,name:img.filename,width:img.width,height:img.height,bytes:img.bytes,created_at:new Date().toISOString()}))}
     onPick={save}/>;
 const editItem=(widget:CibWidget,index:number,patch:NonNullable<CibWidget['items']>[number])=>
   patchWidget(widget.id,{items:(widget.items||[]).map((item,i)=>i===index?{...item,...patch}:item)});
 const itemActions=(w:CibWidget,i:number)=>{
   const values=w.items||[];
   return <div className="fl-item-actions">
    <IconButton label="Mover item para cima" click={()=>patchWidget(w.id,{items:reorder(values,i,i-1)})} disabled={i===0}><ArrowUp size={14}/></IconButton>
    <IconButton label="Mover item para baixo" click={()=>patchWidget(w.id,{items:reorder(values,i,i+1)})} disabled={i===values.length-1}><ArrowDown size={14}/></IconButton>
    <IconButton label="Remover item" click={()=>patchWidget(w.id,{items:values.filter((_,j)=>j!==i)})} danger><Trash2 size={14}/></IconButton>
   </div>
 };
 const editItems=(w:CibWidget)=>{
   const items=w.items||[],isPhoto=w.type==='testimonials',isIcon=w.type==='iconGrid'||w.type==='features',isFaq=w.type==='faq';
   return <div className="fl-editor-items"><div className="fl-panel-subheading"><strong>{isPhoto?'Depoimentos':isIcon?'Cards com ícones':'Perguntas'}</strong><span>{items.length} itens</span></div>
      {items.map((item,i)=><details className="fl-edit-item" key={i} open={items.length<3?undefined:undefined}>
        <summary><span>{i+1}. {item.title|| (isPhoto?'Depoimento':'Item novo')}</span>{itemActions(w,i)}</summary>
        <div className="fl-item-body">
        <TextField label={isPhoto?'Nome da pessoa':isFaq?'Pergunta':'Título do card'} value={item.title||''} change={x=>editItem(w,i,{title:x})} maxLength={160}/>
        {isPhoto&&<TextField label="Cargo ou empresa" value={item.role||''} change={x=>editItem(w,i,{role:x})} maxLength={120}/>}
        <TextField label={isPhoto?'Depoimento':isFaq?'Resposta':'Descrição'} value={item.text||''} change={x=>editItem(w,i,{text:x})} multiline maxLength={1200}/>
        {isIcon&&<label className="fl-field"><span>Ícone</span><div className="fl-icon-choice"><IconTile name={item.icon}/><select value={item.icon||'sparkles'} onChange={e=>editItem(w,i,{icon:e.target.value})}>{Object.entries(iconLabels).map(([name,title])=><option value={name} key={name}>{title}</option>)}</select></div></label>}
        {isPhoto&&media('Foto do associado',item.image||'',url=>editItem(w,i,{image:url}))}
        </div>
       </details>)}
       <button className="fl-outline full" type="button" onClick={()=>patchWidget(w.id,{items:[...items,isPhoto?{title:'Nome do associado',role:'Cargo ou empresa',text:'Escreva o depoimento autorizado.',image:''}:isFaq?{title:'Nova pergunta',text:'Resposta'}:{title:'Novo benefício',text:'Descrição do benefício',icon:'sparkles'}]})} disabled={items.length>=15}><Plus size={16}/> Adicionar {isPhoto?'depoimento':isFaq?'pergunta':'card'}</button>
   </div>;
 };
 const widgetProperties=(w:CibWidget)=>{
   const set=(p:Partial<CibWidget>)=>patchWidget(w.id,p);
   const hasItems=['features','iconGrid','testimonials','faq'].includes(w.type);
   return <div className="fl-inspector">
    <div className="fl-inspector-head"><div><small>WIDGET</small><h3>{widgetNames[w.type]}</h3></div><div className="fl-head-actions"><IconButton label="Duplicar widget" click={()=>duplicateWidget(w.id)}><Copy size={16}/></IconButton><IconButton label="Excluir widget" click={()=>deleteWidget(w.id)} danger><Trash2 size={16}/></IconButton></div></div>
    {['heading','features','iconGrid','testimonials','quote','faq','signup','imageText'].includes(w.type)&&<TextField label="Título" value={w.title||''} change={x=>set({title:x})} maxLength={160}/>}
    {['heading','text','quote','signup','imageText','iconGrid','testimonials'].includes(w.type)&&<TextField label={w.type==='testimonials'||w.type==='iconGrid'?'Texto de apoio':'Conteúdo'} value={w.text||''} change={x=>set({text:x})} multiline/>}
    {(w.type==='image'||w.type==='imageText')&&<>
      {media('Imagem',w.image||'',(url,info)=>set({image:url,imageWidth:info?.width,imageHeight:info?.height,imageBytes:info?.bytes,imageMime:url?'image/webp':undefined}))}
      <TextField label={w.type==='image'?'Legenda da imagem':'Texto acima do título'} value={w.label||''} change={x=>set({label:x})} maxLength={100}/>
      {w.type==='imageText'&&<label className="fl-field"><span>Posição da imagem</span><select value={w.imagePosition||'left'} onChange={e=>set({imagePosition:e.target.value as 'left'|'right'})}><option value="left">Esquerda</option><option value="right">Direita</option></select></label>}
    </>}
    {w.type==='button'&&<><TextField label="Texto do botão" value={w.label||''} change={x=>set({label:x})} maxLength={100}/><TextField label="Destino" value={w.url||''} change={x=>set({url:x})} placeholder="#participar ou /entrar" maxLength={800}/></>}
    {w.type==='imageText'&&<TextField label="URL opcional de ação" value={w.url||''} change={x=>set({url:x})} maxLength={800}/>}
    {(w.type==='testimonials'||w.type==='iconGrid')&&<label className="fl-field"><span>Cards por linha</span><select value={w.columns||3} onChange={e=>set({columns:Number(e.target.value)})}>{[2,3,4].map(n=><option key={n} value={n}>{n} colunas</option>)}</select></label>}
    {hasItems&&editItems(w)}
    {w.type==='spacer'&&<label className="fl-field"><span>Altura do espaçador (px)</span><input type="range" min="10" max="90" value={w.fontSize||40} onChange={e=>set({fontSize:Number(e.target.value)})}/></label>}
    {['heading','text','quote'].includes(w.type)&&<label className="fl-field"><span>Tamanho da fonte: {w.fontSize||18}px</span><input type="range" min="10" max="90" value={w.fontSize||18} onChange={e=>set({fontSize:Number(e.target.value)})}/></label>}
    {['heading','text','quote','button'].includes(w.type)&&<label className="fl-field"><span>Alinhamento</span><select value={w.align||'left'} onChange={e=>set({align:e.target.value as CibWidget['align']})}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>}
    {['heading','text','quote'].includes(w.type)&&<label className="fl-field"><span>Cor do texto</span>{chooseColor(w.color||selectedSection.color,x=>set({color:x}))}</label>}
    <div className="fl-inline-actions"><button type="button" className="fl-outline" onClick={()=>moveWidget(w.id,-1)}><ArrowUp size={15}/> Subir</button><button type="button" className="fl-outline" onClick={()=>moveWidget(w.id,1)}><ArrowDown size={15}/> Descer</button></div>
   </div>;
 };
 const sectionProperties=(section:CibSection)=> <div className="fl-inspector">
  <div className="fl-inspector-head"><div><small>SEÇÃO</small><h3>{section.label}</h3></div><div className="fl-head-actions"><IconButton label="Duplicar seção" click={()=>duplicateSection(section.id)}><Copy size={16}/></IconButton><IconButton label="Excluir seção" click={()=>deleteSection(section.id)} danger><Trash2 size={16}/></IconButton></div></div>
  <TextField label="Nome da seção" value={section.label} change={x=>patchSection(section.id,{label:x})} maxLength={90}/>
  <label className="fl-field"><span>Distribuição de colunas</span><select value={section.columns} onChange={e=>patchSection(section.id,{columns:Number(e.target.value)})}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} {n===1?'coluna':'colunas'}</option>)}</select></label>
  <label className="fl-field"><span>Espaçamento vertical · {section.padding}px</span><input type="range" min="16" max="160" value={section.padding} onChange={e=>patchSection(section.id,{padding:Number(e.target.value)})}/></label>
  <label className="fl-field"><span>Cor do fundo</span>{chooseColor(section.background,x=>patchSection(section.id,{background:x}))}</label>
  <label className="fl-field"><span>Cor do texto</span>{chooseColor(section.color,x=>patchSection(section.id,{color:x}))}</label>
  {media('Imagem de fundo',section.backgroundImage||'',url=>patchSection(section.id,{backgroundImage:url}))}
  <div className="fl-inline-actions"><button className="fl-outline" type="button" onClick={()=>moveSection(section.id,-1)}><ArrowUp size={15}/> Subir</button><button className="fl-outline" type="button" onClick={()=>moveSection(section.id,1)}><ArrowDown size={15}/> Descer</button></div>
  <button type="button" className="fl-primary full" onClick={()=>setTab('add')}><Plus size={16}/> Adicionar widget nesta seção</button>
 </div>;
 const menus=page.menuItems??page.sections.slice(0,5).map(s=>({id:freshId(),label:s.label,href:'#'+s.id}));
 const setMenus=(items:CibMenuItem[])=>change(p=>({...p,menuItems:items}));
 const publish=async(publishNow:boolean)=>{
  if(uploading)return setNotice('Conclua o upload de imagens antes de salvar.');
  setBusy(true);setNotice('');
  try{
   await api('builder/page','PATCH',{page});
   if(publishNow){
     const p=await api<{version:number}>('builder/publish','POST',{});
     setVersion(p.version);
     const versions=await api<{versions:HistoryRow[]}>('builder/history');setHistory(versions.versions);
     setNotice('Versão '+p.version+' publicada. O site público foi atualizado.');
   }else setNotice('Rascunho salvo. Seu site público não foi alterado.');
   setDirty(false);
  }catch(e){setNotice((e as Error).message)}finally{setBusy(false)}
 };
 const restore=async(v:number)=>{
   if(!window.confirm('Restaurar a versão '+v+' como rascunho? O site público não muda até você publicar.'))return;
   setBusy(true);
   try{await api('builder/restore','POST',{version:v});const result=await api<{draft:CibPage|null}>('builder/page');if(result.draft){setPage(dup(result.draft));setSelected({kind:'section',id:result.draft.sections[0]?.id||'inicio'});setDirty(true);setNotice('Versão restaurada para edição. Clique em Publicar quando estiver satisfeito.')}}catch(e){setNotice((e as Error).message)}finally{setBusy(false)}
 };
 if(loading)return <div className="page-loading">Preparando seu editor…</div>;
 return <div className="fl-builder" data-revision={revision}>
   <aside className="fl-panel">
    <header className="fl-panel-top"><Link to="/painel" aria-label="Voltar ao painel"><ArrowLeft size={18}/></Link><div><strong>Editor do site</strong><small>Editora NPE · Edição personalizável</small></div><span className="fl-version">v{version}</span></header>
    <div className="fl-tabs" role="tablist" aria-label="Ferramentas do editor">
     <button type="button" role="tab" aria-selected={tab==='structure'} className={tab==='structure'?'active':''} onClick={()=>setTab('structure')}><Layers size={17}/> Estrutura</button>
     <button type="button" role="tab" aria-selected={tab==='add'} className={tab==='add'?'active':''} onClick={()=>setTab('add')}><Plus size={17}/> Adicionar</button>
     <button type="button" role="tab" aria-selected={tab==='menus'} className={tab==='menus'?'active':''} onClick={()=>setTab('menus')}><MenuIcon size={17}/> Menus</button>
     <button type="button" role="tab" aria-selected={tab==='style'} className={tab==='style'?'active':''} onClick={()=>setTab('style')}><Palette size={17}/> Aparência</button>
    </div>
    <div className="fl-panel-scroll">
    {tab==='structure'&&<div className="fl-section-tree">
      <div className="fl-list-heading"><h2>Blocos da página</h2><button type="button" onClick={()=>setTab('add')}><Plus size={16}/> Nova seção</button></div>
      <p className="fl-hint">Selecione qualquer bloco para editar. Arraste ou use as setas para mudar a ordem.</p>
      {page.sections.map((section,i)=><div key={section.id} className="fl-section-row" draggable onDragStart={()=>setDrag({kind:'section',id:section.id})} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag)drop(drag,{kind:'section',id:section.id});setDrag(null)}}>
        <div className={`fl-tree-main ${selected.kind==='section'&&selected.id===section.id?'active':''}`}>
         <button type="button" className="fl-tree-title" onClick={()=>choose('section',section.id)}><GripVertical size={15}/><span>{i+1}. {section.label}</span></button>
         <div className="fl-tree-actions">
           <IconButton label="Duplicar seção" click={()=>duplicateSection(section.id)}><Copy size={14}/></IconButton>
           <IconButton label="Excluir seção" click={()=>deleteSection(section.id)} danger><Trash2 size={14}/></IconButton>
         </div>
        </div>
        <div className="fl-widget-tree">
         {section.widgets.map((w,j)=><div key={w.id} className={`fl-widget-row ${selected.kind==='widget'&&selected.id===w.id?'active':''}`} draggable onDragStart={e=>{e.stopPropagation();setDrag({kind:'widget',id:w.id,sectionId:section.id})}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();if(drag)drop(drag,{kind:'widget',id:w.id,sectionId:section.id});setDrag(null)}}>
            <button type="button" className="fl-widget-row-name" onClick={()=>choose('widget',w.id)}>{widgetIcons[w.type]}<span>{widgetNames[w.type]}</span></button>
            <div className="fl-tree-actions">
              <IconButton label="Mover widget para cima" click={()=>moveWidget(w.id,-1)} disabled={j===0}><ArrowUp size={13}/></IconButton>
              <IconButton label="Duplicar widget" click={()=>duplicateWidget(w.id)}><Copy size={13}/></IconButton>
              <IconButton label="Excluir widget" click={()=>deleteWidget(w.id)} danger><Trash2 size={13}/></IconButton>
            </div>
          </div>)}
         {!section.widgets.length&&<p className="fl-empty-section">Nenhum widget nesta seção.</p>}
         <button className="fl-add-inline" type="button" onClick={()=>{choose('section',section.id);setTab('add')}}><Plus size={14}/> Adicionar widget aqui</button>
        </div>
       </div>)}
      <button className="fl-outline full" type="button" onClick={()=>setTab('add')}><Plus size={16}/> Adicionar nova seção</button>
      <div className="fl-inspector-divider"/>
      {selectedWidget?widgetProperties(selectedWidget):selectedSection?sectionProperties(selectedSection):null}
    </div>}
    {tab==='add'&&<div className="fl-add-panel">
      <h2>Adicionar seções</h2><p className="fl-hint">Escolha uma estrutura pronta ou comece com um bloco vazio. Tudo pode ser personalizado depois.</p>
      <div className="fl-template-grid">{(Object.keys(templateNames) as Template[]).map(key=><button type="button" key={key} onClick={()=>addSection(key)}><span><PanelTop size={19}/></span>{templateNames[key]}<Plus size={15}/></button>)}</div>
      <div className="fl-inspector-divider"/>
      <h2>Adicionar widgets</h2>
      <p className="fl-hint">Os widgets são inseridos na seção <strong>{selectedSection?.label||'atual'}</strong>.</p>
      <div className="fl-template-grid">{(Object.keys(widgetNames) as CibWidget['type'][]).map(type=><button type="button" key={type} onClick={()=>addWidget(type)}><span>{widgetIcons[type]}</span>{widgetNames[type]}<Plus size={15}/></button>)}</div>
      <button className="fl-outline full" type="button" onClick={()=>setTab('structure')}><ArrowLeft size={16}/> Voltar à estrutura</button>
    </div>}
    {tab==='menus'&&<div className="fl-menu-editor">
      <h2>Identidade e navegação</h2><p className="fl-hint">Adicione links, altere os nomes e organize o menu sem editar código.</p>
      <TextField label="Nome da marca" value={page.brandName||'Sua Empresa'} change={x=>change(p=>({...p,brandName:x}))} maxLength={90}/>
      <TextField label="Complemento da marca" value={page.brandSubtitle||'BRASIL'} change={x=>change(p=>({...p,brandSubtitle:x}))} maxLength={45}/>
      {media('Logotipo do grupo',page.logoImage||'',url=>change(p=>({...p,logoImage:url})))}
      <div className="fl-list-heading"><h2>Links do menu</h2><button type="button" onClick={()=>setMenus([...menus,{id:freshId(),label:'Novo link',href:'#'+page.sections[0].id}])} disabled={menus.length>=16}><Plus size={16}/> Novo link</button></div>
      {menus.map((item,i)=><div key={item.id} className="fl-menu-item">
        <div className="fl-menu-item-header"><strong>{i+1}. {item.label||'Link sem título'}</strong><div className="fl-tree-actions">
          <IconButton label="Subir link" click={()=>setMenus(reorder(menus,i,i-1))} disabled={i===0}><ArrowUp size={14}/></IconButton>
          <IconButton label="Descer link" click={()=>setMenus(reorder(menus,i,i+1))} disabled={i===menus.length-1}><ArrowDown size={14}/></IconButton>
          <IconButton label="Excluir link" click={()=>setMenus(menus.filter((_,j)=>i!==j))} danger><Trash2 size={14}/></IconButton>
        </div></div>
        <TextField label="Texto do link" value={item.label} change={x=>setMenus(menus.map((m,j)=>j===i?{...m,label:x}:m))} maxLength={50}/>
        <label className="fl-field"><span>Destino</span><select value={page.sections.some(x=>'#'+x.id===item.href)?item.href:'custom'} onChange={e=>{if(e.target.value!=='custom')setMenus(menus.map((m,j)=>j===i?{...m,href:e.target.value}:m))}}>
           <option value="custom">Endereço personalizado</option>
           {page.sections.map(s=><option key={s.id} value={'#'+s.id}>{s.label}</option>)}
          </select></label>
        <TextField label="URL ou seção" value={item.href} change={x=>setMenus(menus.map((m,j)=>j===i?{...m,href:x}:m))} placeholder="#encontros, /entrar ou https://…" maxLength={800}/>
      </div>)}
      {!menus.length&&<p className="fl-hint">Sem links no menu. Clique em Novo link para criar um.</p>}
      <button className="fl-outline full" type="button" onClick={()=>setMenus(page.sections.map(s=>({id:freshId(),label:s.label,href:'#'+s.id})))}><RotateCcw size={15}/> Usar todas as seções no menu</button>
    </div>}
    {tab==='style'&&<div className="fl-style-editor">
      <h2>Aparência do site</h2><p className="fl-hint">Um visual plano, consistente e responsivo, com destaque para o conteúdo.</p>
      <TextField label="Título da página" value={page.title} change={x=>change(p=>({...p,title:x}))} maxLength={120}/>
      <label className="fl-field"><span>Tipografia</span><select value={page.font} onChange={e=>change(p=>({...p,font:e.target.value as CibPage['font']}))}><option value="modern">Moderna</option><option value="sans">Sem serifa</option><option value="serif">Serifada</option></select></label>
      <label className="fl-field"><span>Cor do cabeçalho</span>{chooseColor(page.headerColor,x=>change(p=>({...p,headerColor:x})))}</label>
      <label className="fl-field"><span>Cor principal / destaque</span>{chooseColor(page.accentColor,x=>change(p=>({...p,accentColor:x})))}</label>
      <TextField label="Texto do rodapé" value={page.footerText||'Sua empresa · Todos os direitos reservados'} change={x=>change(p=>({...p,footerText:x}))} maxLength={240}/>
      <div className="fl-inspector-divider"/>
      <h2>Privacidade</h2>
      <p className="fl-hint">Edite o texto da página de privacidade. Antes de usar dados reais, solicite revisão jurídica.</p>
      <TextField label="Título da página de privacidade" value={page.privacyTitle||'Privacidade e tratamento de dados'} change={x=>change(p=>({...p,privacyTitle:x}))} maxLength={120}/>
      <TextField label="Texto da política de privacidade" value={page.privacyText||''} change={x=>change(p=>({...p,privacyText:x}))} multiline maxLength={12000}/>
      <div className="fl-style-tip"><Check size={16}/> O editor utiliza bordas leves, espaços generosos e componentes sem sombras decorativas.</div>
    </div>}
    <div className="fl-inspector-divider"/>
    <button className="fl-history-btn" type="button" onClick={()=>setHistoryOpen(!historyOpen)}><History size={16}/> Histórico de versões {historyOpen?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>
    {historyOpen&&<div className="fl-history-list">{history.map(v=><button key={v.id} type="button" onClick={()=>void restore(v.version)}>Versão {v.version} <span>{date(v.published_at)}</span></button>)}{!history.length&&<p>Sem versões anteriores.</p>}</div>}
    </div>
    <footer className="fl-panel-bottom">{notice&&<div className="fl-notice" role="status">{notice}</div>}<div className="fl-save-actions">
       <button type="button" className="fl-outline" disabled={busy||uploading} onClick={()=>void publish(false)}><Save size={16}/> Salvar</button>
       <button type="button" className="fl-primary" disabled={busy||uploading} onClick={()=>void publish(true)}><Send size={16}/> Publicar</button>
      </div></footer>
   </aside>
   <div className="fl-workspace">
     <div className="fl-workspace-bar"><div><span className={dirty?'fl-dot dirty':'fl-dot'}/>{dirty?'Alterações não salvas':'Tudo salvo'} <span className="fl-small-separator">·</span> Prévia ao vivo</div>
       <div className="fl-workspace-actions">
        <IconButton label="Desfazer" click={undo} disabled={!undoRef.current.length}><Undo2 size={17}/></IconButton>
        <IconButton label="Refazer" click={redo} disabled={!redoRef.current.length}><Redo2 size={17}/></IconButton>
        <IconButton label="Ver no computador" click={()=>setDevice('desktop')}><Monitor size={18}/></IconButton>
        <IconButton label="Ver no celular" click={()=>setDevice('mobile')}><Smartphone size={18}/></IconButton>
        <a href="/" rel="noreferrer" target="_blank" className="fl-view-site">Abrir site <Eye size={15}/></a>
       </div>
     </div>
     <div className={`fl-canvas ${device}`}>
       <VisualSite page={page} editing selected={selected.id} select={choose}
         dragStart={(sectionId,id)=>setDrag({kind:'widget',id,sectionId})}
         dropAt={(sectionId,id)=>{if(drag)drop(drag,{kind:'widget',id,sectionId});setDrag(null)}}/>
     </div>
     <div className="fl-canvas-foot"><button type="button" onClick={()=>setTab('add')}><Plus size={17}/> Adicionar seção ou widget</button><span>Selecione qualquer elemento na prévia para editar</span></div>
   </div>
 </div>;
}
