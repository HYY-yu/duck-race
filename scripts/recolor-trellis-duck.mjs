// Deterministic 3D material recoloring. Preserve the generated geometry and UVs.
import {readFile,writeFile} from 'node:fs/promises';
import {inflateSync,deflateSync} from 'node:zlib';
const base=new URL('../assets/generated/',import.meta.url);
function decodePNG(bytes){
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),channels=bytes[25]===2?3:4;
 if(bytes[24]!==8||![2,6].includes(bytes[25])||bytes[28]!==0)throw Error('Unsupported PNG layout');
 const chunks=[];for(let p=8;p<bytes.length;){const n=bytes.readUInt32BE(p);if(bytes.toString('ascii',p+4,p+8)==='IDAT')chunks.push(bytes.subarray(p+8,p+8+n));p+=n+12;}
 const packed=inflateSync(Buffer.concat(chunks)),stride=width*channels,data=Buffer.alloc(height*stride);
 for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
  const f=packed[y*(stride+1)],v=packed[y*(stride+1)+1+x],a=x>=channels?data[y*stride+x-channels]:0,b=y?data[(y-1)*stride+x]:0,c=y&&x>=channels?data[(y-1)*stride+x-channels]:0;
  let predictor=0;if(f===1)predictor=a;else if(f===2)predictor=b;else if(f===3)predictor=Math.floor((a+b)/2);else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}else if(f!==0)throw Error('Unknown PNG filter');
  data[y*stride+x]=(v+predictor)&255;
 }
 return {width,height,channels,data};
}
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,-4)),out.length-4);return out;}
function encodePNG(image){const {width,height,channels,data}=image,stride=width*channels,rows=Buffer.alloc((stride+1)*height);for(let y=0;y<height;y++)data.copy(rows,y*(stride+1)+1,y*stride,(y+1)*stride);const hdr=Buffer.alloc(13);hdr.writeUInt32BE(width);hdr.writeUInt32BE(height,4);hdr[8]=8;hdr[9]=channels===3?2:6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
const reference=decodePNG(await readFile(new URL('duck-base-sam-v1/reference.png',base)));
function samplePatch(cx,cy,radius=16){const values=[[],[],[]];for(let y=cy-radius;y<=cy+radius;y++)for(let x=cx-radius;x<=cx+radius;x++){const p=(y*reference.width+x)*reference.channels;for(let k=0;k<3;k++)values[k].push(reference.data[p+k]);}return values.map(v=>v.sort((a,b)=>a-b)[Math.floor(v.length/2)]);}
// Broad well-lit patches, avoiding the eye, specular highlights and deep creases.
const body=samplePatch(650,260),bill=samplePatch(380,460);
const raw=await readFile(new URL('duck-base-trellis-v1/raw/1.glb',base)),n=raw.readUInt32LE(12),gltf=JSON.parse(raw.subarray(20,20+n)),binary=raw.subarray(28+n);
const mat=gltf.materials[0],imageIndex=gltf.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source,imageView=gltf.bufferViews[gltf.images[imageIndex].bufferView];
const texture=decodePNG(binary.subarray(imageView.byteOffset,imageView.byteOffset+imageView.byteLength));
let bodyPixels=0,billPixels=0;
for(let p=0;p<texture.data.length;p+=texture.channels){const [r,green,b]=texture.data.subarray(p,p+3);
 // Leave the eyes and their highlights intact. The ratio separates the orange bill from yellow skin.
 if(r<190||r<green*1.02||b>r*.72)continue;
 const isBill=green/r<.57,target=isBill?bill:body;
 // Remove most baked shading while retaining a little surface variation.
 const shade=.88+.12*(r/255);for(let k=0;k<3;k++)texture.data[p+k]=Math.round(target[k]*shade);
 if(isBill)billPixels++;else bodyPixels++;
}
const png=encodePNG(texture),views=[],parts=[];let offset=0;
// Repack geometry views without changing their bytes. Drop the unused generated PBR texture.
const used=new Set(gltf.accessors.map(a=>a.bufferView));used.add(gltf.images[imageIndex].bufferView);
const remap=new Map();for(const old of [...used].sort((a,b)=>a-b)){
 const view=gltf.bufferViews[old],data=old===gltf.images[imageIndex].bufferView?png:binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
 remap.set(old,views.length);views.push({...view,byteOffset:offset,byteLength:data.length});parts.push({offset,data});offset+=(data.length+3)&~3;
}
for(const a of gltf.accessors)a.bufferView=remap.get(a.bufferView);
gltf.bufferViews=views;gltf.images=[{bufferView:remap.get(gltf.images[imageIndex].bufferView),mimeType:'image/png'}];gltf.textures=[{source:0,sampler:0}];
mat.name='Duck_ReferencePalette';mat.pbrMetallicRoughness={baseColorTexture:{index:0},baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.65};
gltf.asset.generator='TRELLIS.2 / local reference palette correction';gltf.buffers=[{byteLength:offset}];
const bin=Buffer.alloc(offset);for(const part of parts)part.data.copy(bin,part.offset);
const txt=Buffer.from(JSON.stringify(gltf)),json=Buffer.alloc((txt.length+3)&~3,32);txt.copy(json);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
const out=Buffer.concat([header,json,bh,bin]),folder=new URL('duck-base-trellis-color-v1/',base);
await writeFile(new URL('duck-reference-colors.glb',folder),out);
const hex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
const report={body:{srgb:body,hex:hex(body),referencePatch:[650,260]},bill:{srgb:bill,hex:hex(bill),referencePatch:[380,460]},bodyPixels,billPixels,bytes:out.length,triangles:10000,geometryAndUVs:'byte-for-byte preserved',material:{metallic:0,roughness:.65},additionalCostUsd:0};
await writeFile(new URL('palette.json',folder),JSON.stringify(report,null,2)+'\n');console.info('[duck-material] Recolored',report);
