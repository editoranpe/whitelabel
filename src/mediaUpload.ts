/** Client-side WebP conversion keeps uploads light and avoids external image hosts.
 * Final file is always checked again by the Cloudflare Worker.
 */
export const IMAGE_RECOMMENDATION = {
  width: 1600,
  height: 900,
  maxBytes: 900 * 1024,
  maxEdge: 1600,
  format: '.webp'
} as const;

export type UploadedSiteImage = {
  id:string;url:string;mime:'image/webp';width:number;height:number;bytes:number;filename:string;
};
export type SiteLibraryImage = {
  id:string;url:string;name:string;width:number;height:number;bytes:number;created_at:string;
};
export function formatImageBytes(bytes:number):string {
  return bytes>=1024*1024?`${(bytes/1024/1024).toFixed(2)} MB`:`${Math.round(bytes/1024)} KB`;
}
export async function convertToWebp(input:File):Promise<Blob>{
  if(!['image/jpeg','image/png','image/webp'].includes(input.type)){
    throw new Error('Selecione JPG, PNG ou WebP. Outros formatos não são aceitos.');
  }
  if(input.size>15*1024*1024)throw new Error('Imagem original muito grande. O limite de entrada é 15 MB.');
  let bitmap:ImageBitmap|null=null;
  try {
    bitmap=await createImageBitmap(input);
    const longest=Math.max(bitmap.width,bitmap.height);
    if(!longest||bitmap.width>20000||bitmap.height>20000)throw new Error('Dimensões da imagem inválidas.');
    let scale=Math.min(1,IMAGE_RECOMMENDATION.maxEdge/longest);
    const canvas=document.createElement('canvas');
    const output=async(q:number):Promise<Blob>=>new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>{
        if(!blob||blob.type!=='image/webp')reject(new Error('Seu navegador não conseguiu converter a imagem para WebP.'));
        else resolve(blob);
      },'image/webp',q);
    });
    for(let sizeAttempt=0;sizeAttempt<6;sizeAttempt++){
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx)throw new Error('Não foi possível abrir o processador de imagem.');
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      for(const quality of [0.85,0.73,0.60,0.48]){
        const converted=await output(quality);
        if(converted.size<=IMAGE_RECOMMENDATION.maxBytes && converted.size>0)return converted;
      }
      scale*=0.80;
    }
    throw new Error('Não foi possível reduzir a imagem a 900 KB. Tente uma imagem menor.');
  }catch(error){
    if(error instanceof Error)throw error;
    throw new Error('Não foi possível processar o arquivo.');
  }finally{bitmap?.close()}
}

export async function uploadSiteImage(file:File):Promise<UploadedSiteImage>{
  const converted=await convertToWebp(file);
  const fileName=(file.name.replace(/\.[^.]+$/,'')||'imagem')+'.webp';
  const response=await fetch('/api/media/upload',{
    method:'POST',
    credentials:'same-origin',
    headers:{'Content-Type':'image/webp','X-CIB-Filename':encodeURIComponent(fileName)},
    body:converted,
    cache:'no-store'
  });
  let result:any;
  try{result=await response.json()}catch{throw new Error('Resposta inesperada do servidor de imagens.')}
  if(!response.ok)throw new Error(result?.error||`Falha ao enviar a imagem (HTTP ${response.status}).`);
  return result as UploadedSiteImage;
}
