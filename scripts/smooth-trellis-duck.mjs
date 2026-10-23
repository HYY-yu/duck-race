// Offline sample: stitch coincident vertices for adjacency/normals, without changing UVs or topology.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const source=process.argv[2]?pathToFileURL(resolve(process.argv[2])):new URL('../assets/generated/duck-base-trellis-color-v1/duck-reference-colors.glb',import.meta.url);
const folder=process.argv[3]?pathToFileURL(resolve(process.argv[3])+'/'):new URL('../assets/generated/duck-base-trellis-smooth-v1/',import.meta.url);await mkdir(folder,{recursive:true});
const raw=await readFile(source),size=raw.readUInt32LE(12),gltf=JSON.parse(raw.subarray(20,20+size)),bin=raw.subarray(28+size);
const primitive=gltf.meshes[0].primitives[0],pa=gltf.accessors[primitive.attributes.POSITION],ia=gltf.accessors[primitive.indices];
function bytes(a){const v=gltf.bufferViews[a.bufferView];return bin.subarray((v.byteOffset??0)+(a.byteOffset??0),(v.byteOffset??0)+(a.byteOffset??0)+a.count*(a.type==='VEC3'?3:1)*(a.componentType===5123?2:4));}
const positions=new Float32Array(Uint8Array.from(bytes(pa)).buffer),indices=ia.componentType===5125?new Uint32Array(Uint8Array.from(bytes(ia)).buffer):new Uint16Array(Uint8Array.from(bytes(ia)).buffer);
const groups=new Map(),weld=[],original=[];
for(let i=0;i<pa.count;i++){
 const p=Array.from(positions.subarray(i*3,i*3+3)),key=p.map(x=>Math.round(x*1e6)).join(',');
 if(!groups.has(key)){groups.set(key,original.length/3);original.push(...p);}weld.push(groups.get(key));
}
const count=original.length/3,neighbors=Array.from({length:count},()=>new Set()),edges=new Map(),faces=[];
function cross(a,b,c,p){const u=[0,1,2].map(k=>p[b*3+k]-p[a*3+k]),v=[0,1,2].map(k=>p[c*3+k]-p[a*3+k]);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];}
for(let i=0;i<indices.length;i+=3){const face=Array.from(indices.subarray(i,i+3),v=>weld[v]);faces.push(face);const n=cross(...face,original),len=Math.hypot(...n)||1,normal=n.map(v=>v/len);
 for(let k=0;k<3;k++){const a=face[k],b=face[(k+1)%3];if(a===b)continue;neighbors[a].add(b);neighbors[b].add(a);const key=a<b?`${a},${b}`:`${b},${a}`;if(!edges.has(key))edges.set(key,{a,b,normals:[]});edges.get(key).normals.push(normal);}
}
const strength=new Float64Array(count).fill(1);let boundary=0,feature=0;
for(const {a,b,normals} of edges.values()){
 if(normals.length!==2){strength[a]=strength[b]=0;boundary++;continue;}
 const dot=normals[0].reduce((sum,v,k)=>sum+v*normals[1][k],0);
 // Damp sharp creases (bill rim/wing folds), leaving broad body surfaces free to relax.
 if(dot<Math.cos(Math.PI/3)){strength[a]=Math.min(strength[a],.12);strength[b]=Math.min(strength[b],.12);feature++;}
}
let smooth=Float64Array.from(original);const lambda=.35,mu=-.36,cycles=Number(process.argv[4]??12),maxMove=.014;
function step(factor){const next=smooth.slice();for(let i=0;i<count;i++){if(!neighbors[i].size||!strength[i])continue;for(let k=0;k<3;k++){let mean=0;for(const j of neighbors[i])mean+=smooth[j*3+k];next[i*3+k]+=factor*strength[i]*(mean/neighbors[i].size-smooth[i*3+k]);}}smooth=next;}
for(let it=0;it<cycles;it++){step(lambda);step(mu);for(let i=0;i<count;i++){const delta=[0,1,2].map(k=>smooth[i*3+k]-original[i*3+k]),length=Math.hypot(...delta);if(length>maxMove)for(let k=0;k<3;k++)smooth[i*3+k]=original[i*3+k]+delta[k]*maxMove/length;}}
// Preserve tiny folded details: undo movement locally if a face turns over.
const restored=new Set();let remainingFlips=0;
for(let pass=0;pass<30;pass++){
 const bad=[];for(const face of faces){const a=cross(...face,original),b=cross(...face,smooth);if(a.reduce((s,v,k)=>s+v*b[k],0)<=0)bad.push(face);}
 remainingFlips=bad.length;if(!remainingFlips)break;
 for(const face of bad)for(const i of face){restored.add(i);for(let k=0;k<3;k++)smooth[i*3+k]=original[i*3+k];}
}
if(remainingFlips)throw Error('Could not preserve face orientation; no sample exported');
function normals(p){const n=new Float64Array(count*3);for(const face of faces){const v=cross(...face,p);for(const i of face)for(let k=0;k<3;k++)n[i*3+k]+=v[k];}const result=new Float32Array(pa.count*3);for(let i=0;i<pa.count;i++){const j=weld[i],length=Math.hypot(n[j*3],n[j*3+1],n[j*3+2])||1;for(let k=0;k<3;k++)result[i*3+k]=n[j*3+k]/length;}return result;}
async function exportGLB(name,p){
 const g=structuredClone(gltf),data=Buffer.from(bin),v=g.bufferViews[pa.bufferView],offset=(v.byteOffset??0)+(pa.byteOffset??0),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<pa.count;i++)for(let k=0;k<3;k++){const value=p[weld[i]*3+k];data.writeFloatLE(value,offset+(i*3+k)*4);min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);}
 g.accessors[primitive.attributes.POSITION].min=min;g.accessors[primitive.attributes.POSITION].max=max;
 const normal=Buffer.from(normals(p).buffer),padding=Buffer.alloc((4-data.length%4)%4),normalOffset=data.length+padding.length,binary=Buffer.concat([data,padding,normal]);
 const view=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:normalOffset,byteLength:normal.length,target:34962});const accessor=g.accessors.length;g.accessors.push({bufferView:view,componentType:5126,type:'VEC3',count:pa.count});g.meshes[0].primitives[0].attributes.NORMAL=accessor;g.buffers[0].byteLength=binary.length;g.asset.generator='TRELLIS.2 / seam-aware normals and local Taubin sample';
 const text=Buffer.from(JSON.stringify(g)),json=Buffer.alloc((text.length+3)&~3,32);text.copy(json);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);const output=Buffer.concat([header,json,bh,binary]);await writeFile(new URL(name,folder),output);return {bytes:output.length,min,max};
}
const onlyNormals=await exportGLB('duck-normals.glb',original),smoothed=await exportGLB('duck-smoothed.glb',smooth);
let maxDisplacement=0,sum=0;for(let i=0;i<count;i++){const d=Math.hypot(...[0,1,2].map(k=>smooth[i*3+k]-original[i*3+k]));maxDisplacement=Math.max(maxDisplacement,d);sum+=d*d;}
const report={triangles:indices.length/3,vertices:pa.count,weldedVertices:count,sharpEdgesDamped:feature,boundaryEdgesLocked:boundary,verticesRestoredForFaceOrientation:restored.size,taubin:{lambda,mu,cycles,maxMove},maxDisplacement,rmsDisplacement:Math.sqrt(sum/count),onlyNormals,smoothed,additionalCostUsd:0};await writeFile(new URL('stats.json',folder),JSON.stringify(report,null,2)+'\n');console.info('[duck-smooth] Complete',report);
