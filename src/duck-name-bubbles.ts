import * as THREE from 'three';
export type BubbleAnchor={id:number;x:number;y:number;width:number};
/** Keep nearby names readable without detaching their horizontal head anchors. */
export function layoutNameBubbles(anchors:readonly BubbleAnchor[],height:number){
 const placed:{id:number;x:number;y:number;width:number}[]=[];
 for(const a of [...anchors].sort((a,b)=>a.y-b.y||a.id-b.id)){
  let y=a.y;
  for(let attempt=0;attempt<anchors.length;attempt++){
   const overlaps=placed.filter(b=>Math.abs(a.x-b.x)<(a.width+b.width)/2+5&&Math.abs(y-b.y)<27);
   if(!overlaps.length)break;
   y=Math.min(...overlaps.map(b=>b.y-28));
  }
  placed.push({...a,y:Math.max(28,Math.min(height-8,y))});
 }
 return placed;
}
/** DOM labels stay sharp at every zoom; no canvas textures or extra WebGL draws. */
export class DuckNameBubbles {
 private layer?:HTMLDivElement;private labels:HTMLDivElement[]=[];private widths:number[]=[];
 private head=new THREE.Vector3();
 bind(scene:HTMLElement,names:readonly string[],colors:readonly string[]){
  this.layer?.remove();this.layer=document.createElement('div');this.layer.className='duck-name-layer';this.layer.setAttribute('aria-hidden','true');scene.appendChild(this.layer);
  this.setNames(names,colors);
 }
 setNames(names:readonly string[],colors:readonly string[]){
  if(!this.layer)return;
  this.layer.replaceChildren();this.labels=names.map((name,id)=>{
   const label=document.createElement('div');label.className='duck-name-bubble';label.title=name;label.dataset.duck=String(id);label.style.setProperty('--duck-color',colors[id]??'#ffcf42');
   const text=document.createElement('span');text.textContent=name;label.appendChild(text);this.layer!.appendChild(label);return label;
  });
  this.measure();
  console.debug('[labels] names bound',{count:names.length});
 }
 measure(){this.widths=this.labels.map(label=>label.offsetWidth);}
 update(camera:THREE.Camera,ducks:readonly {id:number;position:THREE.Vector3}[],width:number,height:number){
  if(!this.layer)return;
  const anchors:BubbleAnchor[]=[];const anchorY=new Map<number,number>();
  for(const {id,position}of ducks){
   const label=this.labels[id];if(!label)continue;
   this.head.copy(position);this.head.y+=2.8;this.head.project(camera);
   const x=(this.head.x+1)*width/2,y=(1-this.head.y)*height/2;
   const visible=this.head.z>=-1&&this.head.z<=1&&x>=0&&x<=width&&y>=0&&y<=height;
   label.hidden=!visible;if(!visible)continue;
   anchors.push({id,x:Math.max(this.widths[id]/2+4,Math.min(width-this.widths[id]/2-4,x)),y,width:this.widths[id]});anchorY.set(id,y);
  }
  for(const a of layoutNameBubbles(anchors,height)){
   const label=this.labels[a.id];label.style.transform=`translate3d(${a.x}px,${a.y}px,0) translate(-50%,-100%)`;
   label.style.setProperty('--stem',`${Math.max(5,anchorY.get(a.id)!-a.y+5)}px`);
  }
 }
}
