// Offline web packaging: conservative smoothing, UV-aware reduction, seam normals, 512px textures.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {MeshoptSimplifier} from 'meshoptimizer';
import {decodePNG,encodePNG} from './png-codec.mjs';
const folder='assets/generated/remaining-v1',output='public/models';await mkdir(output,{recursive:true});await MeshoptSimplifier.ready;MeshoptSimplifier.useExperimentalFeatures=true;
const specs=JSON.parse(await readFile(`${folder}/prompts.json`,'utf8'));const report=[];
for(const {id} of specs){
 const sourceId=existsSync(`${folder}/${id}-v2/raw/1.glb`)?`${id}-v2`:id;const source=`${folder}/${sourceId}/raw/1.glb`,temp=`/private/tmp/duck-assets-processed/${id}`;
 const result=spawnSync(process.execPath,['scripts/smooth-trellis-duck.mjs',source,temp,id==='scarf'?'10':'0'],{encoding:'utf8'});
 if(result.status!==0)throw Error(`Smoothing failed: ${id}\n${result.stderr}`);
 const raw=await readFile(`${temp}/duck-smoothed.glb`),n=raw.readUInt32LE(12),g=JSON.parse(raw.subarray(20,20+n)),binary=raw.subarray(28+n),prim=g.meshes[0].primitives[0];
 function read(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],Type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],width={SCALAR:1,VEC2:2,VEC3:3}[a.type],o=(v.byteOffset??0)+(a.byteOffset??0);return new Type(Uint8Array.from(binary.subarray(o,o+a.count*width*Type.BYTES_PER_ELEMENT)).buffer);}
 const pos=read(prim.attributes.POSITION),uv=read(prim.attributes.TEXCOORD_0),original=Uint32Array.from(read(prim.indices));
 const target=id.startsWith('tree')?2500:id.startsWith('audience')?4000:id==='rabbit'?3000:id==='bird'?2500:1800;
 let [reduced,error]=MeshoptSimplifier.simplifyWithAttributes(original,pos,3,uv,2,[.1,.1],null,target*3,.025);
 // Keep difficult thin/seamed forms intact rather than forcing a destructive reduction.
 if(reduced.length>target*3*1.3||['tree-broadleaf','audience-fox','pirate-hat','glasses'].includes(id)){reduced=original;error=0;}
 const remap=new Map();for(const i of reduced)if(!remap.has(i))remap.set(i,remap.size);
 const p=new Float32Array(remap.size*3),u=new Float32Array(remap.size*2),idx=Uint32Array.from(reduced,i=>remap.get(i));
 for(const [old,next]of remap){p.set(pos.subarray(old*3,old*3+3),next*3);u.set(uv.subarray(old*2,old*2+2),next*2);}
 // Average area-weighted normals across UV duplicates without welding texture coordinates.
 const groups=new Map(),weld=[];for(let i=0;i<remap.size;i++){const key=Array.from(p.subarray(i*3,i*3+3),x=>Math.round(x*1e6)).join(',');if(!groups.has(key))groups.set(key,groups.size);weld.push(groups.get(key));}
 const sums=new Float64Array(groups.size*3),normals=new Float32Array(p.length);
 for(let i=0;i<idx.length;i+=3){const [a,b,c]=idx.subarray(i,i+3),x=[0,1,2].map(k=>p[b*3+k]-p[a*3+k]),y=[0,1,2].map(k=>p[c*3+k]-p[a*3+k]),v=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];for(const j of [a,b,c])for(let k=0;k<3;k++)sums[weld[j]*3+k]+=v[k];}
 let fallbackNormals=0;const sourceNormals=read(prim.attributes.NORMAL);
 for(const [old,i]of remap){const j=weld[i];let normal=Array.from(sums.subarray(j*3,j*3+3)),len=Math.hypot(...normal);if(len<1e-12){fallbackNormals++;normal=Array.from(sourceNormals.subarray(old*3,old*3+3));len=Math.hypot(...normal);if(len<1e-12){normal=Array.from(p.subarray(i*3,i*3+3));len=Math.hypot(...normal);if(len<1e-12){normal=[0,1,0];len=1;}}}for(let k=0;k<3;k++)normals[i*3+k]=normal[k]/len;}
 if(fallbackNormals)console.warn('[assets] zero-area/cancelling vertex normals repaired',{id,count:fallbackNormals});
 const mat=g.materials[prim.material??0],im=g.images[g.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source],view=g.bufferViews[im.bufferView],png=decodePNG(binary.subarray(view.byteOffset,view.byteOffset+view.byteLength));
 const texture={width:512,height:512,channels:png.channels,data:Buffer.alloc(512*512*png.channels)};
 for(let y=0;y<512;y++)for(let x=0;x<512;x++)for(let k=0;k<png.channels;k++){let total=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)total+=png.data[((y*2+dy)*png.width+x*2+dx)*png.channels+k];texture.data[(y*512+x)*png.channels+k]=Math.round(total/4);}
 if(png.width!==1024||png.height!==1024)throw Error(`Unexpected texture size for ${id}`);
 const encoded=encodePNG(texture),parts=[Buffer.from(p.buffer),Buffer.from(idx.buffer),Buffer.from(u.buffer),Buffer.from(normals.buffer),encoded],views=[];let length=0;
 for(let i=0;i<parts.length;i++){views.push({buffer:0,byteOffset:length,byteLength:parts[i].length,...(i<4?{target:i===1?34963:34962}:{})});length+=(parts[i].length+3)&~3;}
 let bin=Buffer.alloc(length);parts.forEach((v,i)=>v.copy(bin,views[i].byteOffset));const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++){const k=i%3;min[k]=Math.min(min[k],p[i]);max[k]=Math.max(max[k],p[i]);}
 const doc={asset:{version:'2.0',generator:'TRELLIS.2 / local web asset pipeline'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:id,mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:2,NORMAL:3},indices:1,material:0,mode:4}]}],accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:p.length/3,min,max},{bufferView:1,componentType:5125,type:'SCALAR',count:idx.length},{bufferView:2,componentType:5126,type:'VEC2',count:u.length/2},{bufferView:3,componentType:5126,type:'VEC3',count:normals.length/3}],buffers:[{byteLength:length}],bufferViews:views,images:[{bufferView:4,mimeType:'image/png'}],textures:[{source:0,sampler:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],materials:[{name:`${id}-matte`,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.8},doubleSided:true}]};
 if(id==='scarf'){doc.materials[0].pbrMetallicRoughness={baseColorFactor:[.82,.11,.085,1],metallicFactor:0,roughnessFactor:.85};bin=bin.subarray(0,views[4].byteOffset);doc.images=[];doc.textures=[];doc.samplers=[];doc.bufferViews.pop();doc.buffers[0].byteLength=bin.length;}
 const text=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc((text.length+3)&~3,32);text.copy(json);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);const out=Buffer.concat([header,json,bh,bin]);await writeFile(`${output}/${id}.glb`,out);
 report.push({id,sourceId,triangles:idx.length/3,vertices:p.length/3,fallbackNormals,bytes:out.length,target,error,min,max});console.info('[assets] packaged',report.at(-1));
}
await writeFile(`${output}/duck.glb`,await readFile('assets/generated/duck-base-trellis-smooth-v1/duck-smoothed.glb'));
await writeFile(`${folder}/web-manifest.json`,JSON.stringify(report,null,2)+'\n');
