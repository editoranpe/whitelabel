import {useEffect,useState} from 'react';
import {Users,Lightbulb,Star,Target,Coffee,CheckCircle2,Globe,BriefcaseBusiness,Handshake,Rocket,Heart,CalendarDays,Award,Zap,MessageCircle,ShieldCheck,BookOpen,Sparkles,Network,Megaphone,type LucideIcon} from 'lucide-react';
import type {CibWidget} from './VisualSite';

/** Fixed icon registry: no arbitrary HTML, JavaScript or icon-loader URLs. */
export const iconMap:Record<string,LucideIcon>={
 users:Users,lightbulb:Lightbulb,star:Star,target:Target,coffee:Coffee,check:CheckCircle2,
 globe:Globe,briefcase:BriefcaseBusiness,handshake:Handshake,rocket:Rocket,
 heart:Heart,calendar:CalendarDays,award:Award,zap:Zap,message:MessageCircle,
 shield:ShieldCheck,book:BookOpen,sparkles:Sparkles,network:Network,megaphone:Megaphone
};
export const iconLabels:Record<string,string>={
 users:'Pessoas',lightbulb:'Ideias',star:'Destaque',target:'Objetivos',coffee:'Café',
 check:'Concluído',globe:'Mundo',briefcase:'Negócios',handshake:'Parcerias',
 rocket:'Crescimento',heart:'Comunidade',calendar:'Agenda',award:'Conquista',
 zap:'Energia',message:'Conversa',shield:'Confiança',book:'Aprendizado',
 sparkles:'Criatividade',network:'Conexões',megaphone:'Divulgação'
};
export function IconTile({name,size=25}:{name?:string;size?:number}){
 const Icon=iconMap[name||'']||Sparkles;
 return <Icon size={size} strokeWidth={1.75} aria-hidden="true"/>;
}
function Portrait({src,name}:{src?:string;name?:string}){
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[src]);
 return <span className="cib-person-image">
  {src&&!broken?<img src={src} alt={name||'Foto do participante'} loading="lazy" onError={()=>setBroken(true)}/>:
  <span aria-hidden="true">{(name||'CIB').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</span>}
 </span>;
}
export function TestimonialGrid({widget:w}:{widget:CibWidget}){
 const testimonials=w.items||[];
 return <div className="cib-testimonials">
  {w.title&&<div className="cib-block-heading"><span>CONEXÕES REAIS</span><h2>{w.title}</h2>{w.text&&<p>{w.text}</p>}</div>}
  <div className="cib-testimonial-grid" style={{'--card-columns':Math.min(Math.max(w.columns||3,2),4)} as React.CSSProperties}>
    {testimonials.map((item,i)=><article className="cib-testimonial" key={i}>
      <blockquote>{item.text||'Compartilhe aqui um depoimento de um associado.'}</blockquote>
      <div className="cib-testimonial-person"><Portrait src={item.image} name={item.title}/><div><strong>{item.title||'Nome do associado'}</strong>{item.role&&<span>{item.role}</span>}</div></div>
    </article>)}
    {!testimonials.length&&<p className="cib-empty-collection">Adicione depoimentos pelo editor.</p>}
  </div>
 </div>;
}
export function IconGrid({widget:w}:{widget:CibWidget}){
 const items=w.items||[];
 return <div className="cib-icon-block">
   {w.title&&<div className="cib-block-heading"><h2>{w.title}</h2>{w.text&&<p>{w.text}</p>}</div>}
   <div className="cib-icon-grid" style={{'--card-columns':Math.min(Math.max(w.columns||3,2),4)} as React.CSSProperties}>
     {items.map((item,i)=><div className="cib-icon-card" key={i}>
      <span className="cib-flat-icon"><IconTile name={item.icon||'sparkles'} size={27}/></span>
      <h3>{item.title||'Benefício'}</h3><p>{item.text}</p>
     </div>)}
   </div>
 </div>;
}
export function ImageTextBlock({widget:w,editing=false}:{widget:CibWidget;editing?:boolean}){
 return <div className={`cib-image-text cib-photo-${w.imagePosition==='right'?'right':'left'}`}>
   <div className="cib-image-text-photo">{w.image?
      <img src={w.image} alt={w.label||w.title||'Imagem do grupo'} loading="lazy" onError={e=>e.currentTarget.classList.add('cib-image-unavailable')}/>:
      <div className="cib-photo-empty">Escolha uma imagem no editor</div>}
   </div>
   <div className="cib-image-text-copy">
     {w.label&&<span className="cib-overline">{w.label}</span>}
     <h2>{w.title||'Histórias que conectam'}</h2>
     <p>{w.text||'Conte aqui a história do grupo.'}</p>
     {w.url&&<a className="cib-flat-link" href={editing?'#':w.url} onClick={editing?e=>e.preventDefault():undefined}>Saiba mais <span aria-hidden="true">↗</span></a>}
   </div>
 </div>;
}
