import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectWebp, readImageUpload, MEDIA_MAX_BYTES, mediaUrl} from '../functions/_lib/media.ts';

function webpHeader(width=1600,height=900):Uint8Array{
 const out=new Uint8Array(30);
 const write=(offset:number,str:string)=>{for(let i=0;i<str.length;i++)out[offset+i]=str.charCodeAt(i)};
 write(0,'RIFF');write(8,'WEBP');write(12,'VP8X');
 out[4]=22;out[16]=10;
 const w=width-1,h=height-1;
 out[24]=w&255;out[25]=(w>>8)&255;out[26]=(w>>16)&255;
 out[27]=h&255;out[28]=(h>>8)&255;out[29]=(h>>16)&255;
 return out;
}
test('reads WebP dimensions from file header',()=>{
 assert.deepEqual(inspectWebp(webpHeader()),{width:1600,height:900});
 assert.equal(mediaUrl('12345678-aaaa-4bbb-8ccc-123456789012'),'/api/media/12345678-aaaa-4bbb-8ccc-123456789012.webp');
});
test('rejects corrupted formats and excessive dimensions',()=>{
 const invalid=webpHeader();invalid[8]=0;
 assert.throws(()=>inspectWebp(invalid),/WebP/);
 assert.throws(()=>inspectWebp(webpHeader(4100,900)),/Dimensões/);
});
test('accepts WebP upload and refuses non-WebP MIME',async()=>{
 const request=new Request('https://example.test/api/media/upload',{method:'POST',headers:{'Content-Type':'image/webp'},body:webpHeader()});
 const data=await readImageUpload(request);
 assert.deepEqual(inspectWebp(data),{width:1600,height:900});
 const other=new Request('https://example.test/api/media/upload',{method:'POST',headers:{'Content-Type':'text/html'},body:'<script></script>'});
 await assert.rejects(readImageUpload(other),/webp/i);
});
test('media upload stays below Cloudflare D1 BLOB maximum',()=>{
 assert.equal(MEDIA_MAX_BYTES,900*1024);
 assert.ok(MEDIA_MAX_BYTES<2_000_000);
});
