/** WebP upload guard for images stored in the existing Cloudflare D1 binding.
 * Keep well below D1's 2 MB BLOB limit and disallow arbitrary SVG/HTML execution.
 */
export const MEDIA_MAX_BYTES = 900 * 1024;
export const MEDIA_MAX_DIMENSION = 4096;
export const MEDIA_SUGGESTED_DIMENSIONS = {width:1600,height:900} as const;
export type ImageDimensions = {width:number;height:number};
function fourcc(bytes:Uint8Array,offset:number):string {
  return String.fromCharCode(...bytes.slice(offset,offset+4));
}
export function inspectWebp(bytes:Uint8Array):ImageDimensions {
  if(bytes.byteLength<30 || fourcc(bytes,0)!=='RIFF' || fourcc(bytes,8)!=='WEBP'){
    throw new Error('Arquivo inválido. Envie uma imagem em formato WebP.');
  }
  const actualFileSize=bytes.byteLength;
  const declaredSize=(bytes[4] | (bytes[5]<<8) | (bytes[6]<<16) | (bytes[7]<<24)) >>> 0;
  if(declaredSize+8!==actualFileSize){
    throw new Error('Arquivo WebP incompleto ou com tamanho inválido.');
  }
  const chunk=fourcc(bytes,12);
  const chunkSize=(bytes[16] | (bytes[17]<<8) | (bytes[18]<<16) | (bytes[19]<<24)) >>> 0;
  if(chunkSize+20>actualFileSize) throw new Error('Dados da imagem incompletos.');
  let width=0,height=0;
  if(chunk==='VP8X' && chunkSize>=10 && actualFileSize>=30){
    width=1+(bytes[24] | (bytes[25]<<8) | (bytes[26]<<16));
    height=1+(bytes[27] | (bytes[28]<<8) | (bytes[29]<<16));
  } else if(chunk==='VP8L' && chunkSize>=5 && bytes[20]===0x2f){
    width=1+(bytes[21] | ((bytes[22]&0x3f)<<8));
    height=1+((bytes[22]>>6) | (bytes[23]<<2) | ((bytes[24]&0x0f)<<10));
  } else if(chunk==='VP8 ' && chunkSize>=10 &&
            bytes[23]===0x9d && bytes[24]===0x01 && bytes[25]===0x2a){
    width=(bytes[26] | (bytes[27]<<8)) & 0x3fff;
    height=(bytes[28] | (bytes[29]<<8)) & 0x3fff;
  } else {
    throw new Error('Formato interno WebP não reconhecido.');
  }
  if(width<1||height<1||width>MEDIA_MAX_DIMENSION||height>MEDIA_MAX_DIMENSION){
    throw new Error('Dimensões fora do limite permitido (até 4096 px por lado).');
  }
  return {width,height};
}
export async function readImageUpload(request:Request):Promise<Uint8Array>{
  if(request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()!=='image/webp'){
    throw new Error('O envio deve conter uma imagem em formato .webp.');
  }
  const lengthHeader=request.headers.get('Content-Length');
  if(lengthHeader && Number(lengthHeader)>MEDIA_MAX_BYTES){
    throw new Error('Imagem maior que 900 KB. Reduza o tamanho do arquivo.');
  }
  if(!request.body) throw new Error('Nenhuma imagem recebida.');
  const reader=request.body.getReader();
  let length=0;
  const chunks:Uint8Array[]=[];
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      length+=value.byteLength;
      if(length>MEDIA_MAX_BYTES)throw new Error('Imagem maior que 900 KB. Reduza o tamanho do arquivo.');
      chunks.push(value);
    }
  }finally{reader.releaseLock()}
  if(length===0)throw new Error('O arquivo está vazio.');
  const result=new Uint8Array(length);
  let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength}
  inspectWebp(result);
  return result;
}
export function mediaUrl(id:string):string{
  if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Identificador de imagem inválido');
  return `/api/media/${id}.webp`;
}
