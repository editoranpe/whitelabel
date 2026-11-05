import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {VisualSite,type CibPage} from './VisualSite';
import {whiteLabelDemoPage,NPE_THEME} from './whiteLabel';
import {api} from './api';

/** Public rendering: an untouched installation shows the placeholder demo.
 * Publishing from the admin editor replaces the demo with the client's own page.
 */
export default function PublicSite(){
  const [page,setPage]=useState<CibPage>(whiteLabelDemoPage);
  useEffect(()=>{
    let active=true;
    api<{page:CibPage|null}>('public-page').then(response=>{
      if(active && response.page?.sections?.length)setPage(response.page);
    }).catch(()=>{/* Public demo stays usable without provisioned D1. */});
    return ()=>{active=false};
  },[]);
  useEffect(()=>{document.title=page.title||NPE_THEME.productName},[page.title]);
  return <VisualSite page={page}/>;
}

/** Starter notice, intentionally not a finished legal policy.
 * Customers must replace this with a reviewed policy before collecting personal data.
 */
export function Privacy(){
 const [page,setPage]=useState<CibPage>(whiteLabelDemoPage);
 useEffect(()=>{
  let active=true;
  api<{page:CibPage|null}>('public-page').then(data=>{
   if(active && data.page?.sections?.length)setPage(data.page);
  }).catch(()=>{});
  return ()=>{active=false};
 },[]);
 return <div className="npe-privacy">
   <header><Link to="/">{page.logoImage?<img src={page.logoImage} alt={page.brandName||'Logotipo'}/>:<strong>{page.brandName||'Sua empresa'}</strong>}<span>Voltar ao site</span></Link></header>
   <main>
     <small>TRANSPARÊNCIA</small>
     <h1>{page.privacyTitle||'Privacidade e tratamento de dados'}</h1>
     <p style={{whiteSpace:'pre-line'}}>{page.privacyText||'Conteúdo a personalizar. Informe aqui a política de privacidade aprovada da sua empresa antes de coletar dados reais.'}</p>
     <Link className="npe-privacy-back" to="/">Retornar à página inicial</Link>
   </main>
 </div>;
}
