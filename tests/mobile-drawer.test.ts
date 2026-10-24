import assert from 'node:assert/strict';
import test from 'node:test';
import {installMobileDrawer} from '../src/mobile-drawer';

// A DOM boundary fixture exercises menu state and keyboard contracts without WebGL.
class ElementStub extends EventTarget {
 inert=false;
 attrs=new Map<string,string>();
 classes=new Set<string>();
 classList={toggle:(name:string,value:boolean)=>value?this.classes.add(name):this.classes.delete(name)};
 children:ElementStub[]=[];
 constructor(readonly id:string,readonly owner:{activeElement:ElementStub|null}){super();}
 setAttribute(name:string,value:string){this.attrs.set(name,value);}
 removeAttribute(name:string){this.attrs.delete(name);}
 focus(){this.owner.activeElement=this;}
 contains(el:unknown){return el===this||this.children.includes(el as ElementStub);}
 getClientRects(){return [{}];}
 getBoundingClientRect(){return {};}
 querySelectorAll(){return this.children;}
}
function fixture(compact=true){
 const doc=Object.assign(new EventTarget(),{activeElement:null as ElementStub|null,body:{style:{overflow:'auto'}},querySelectorAll:()=>background});
 const elements=new Map<string,ElementStub>();
 for(const id of ['race-menu','menu-toggle','drawer-close','drawer-backdrop','start','help','scene','topbar'])elements.set(id,new ElementStub(id,doc));
 const menu=elements.get('race-menu')!,close=elements.get('drawer-close')!,toggle=elements.get('menu-toggle')!;
 menu.children=[close,elements.get('start')!,elements.get('help')!];
 const background=[elements.get('scene')!,elements.get('topbar')!];
 const media=Object.assign(new EventTarget(),{matches:compact});
 const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),oldMatch=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');
 Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
 Object.defineProperty(globalThis,'matchMedia',{value:()=>media,configurable:true});
 const app=Object.assign(new ElementStub('app',doc),{querySelector:(selector:string)=>elements.get(selector.slice(1))});
 const drawer=installMobileDrawer(app as unknown as HTMLElement,'en');
 const click=(id:string)=>elements.get(id)!.dispatchEvent(new Event('click'));
 const key=(key:string,shiftKey=false)=>{const event=Object.assign(new Event('keydown',{cancelable:true}),{key,shiftKey});doc.dispatchEvent(event);return event;};
 return {doc,menu,toggle,background,media,app,drawer,click,key,cleanup(){drawer.close();if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document');if(oldMatch)Object.defineProperty(globalThis,'matchMedia',oldMatch);else Reflect.deleteProperty(globalThis,'matchMedia');}};
}

test('mobile drawer isolates the scene, exposes dialog state, and restores focus and scrolling',()=>{
 const f=fixture();try{
  assert.equal(f.menu.inert,true);
  f.click('menu-toggle');
  assert.equal(f.drawer.isOpen,true);
  assert.equal(f.toggle.attrs.get('aria-expanded'),'true');
  assert.equal(f.menu.attrs.get('aria-modal'),'true');
  assert.equal(f.doc.activeElement?.id,'drawer-close');
  assert.ok(f.background.every(el=>el.inert));
  assert.equal(f.doc.body.style.overflow,'hidden');
  f.click('drawer-backdrop');
  assert.equal(f.drawer.isOpen,false);
  assert.equal(f.menu.inert,true);
  assert.equal(f.menu.attrs.has('aria-modal'),false);
  assert.ok(f.background.every(el=>!el.inert));
  assert.equal(f.doc.activeElement?.id,'menu-toggle');
  assert.equal(f.doc.body.style.overflow,'auto');
 }finally{f.cleanup();}
});

test('drawer traps Tab in both directions and Escape closes it',()=>{
 const f=fixture();try{
  f.click('menu-toggle');
  assert.equal(f.key('Tab',true).defaultPrevented,true);
  assert.equal(f.doc.activeElement?.id,'help');
  assert.equal(f.key('Tab').defaultPrevented,true);
  assert.equal(f.doc.activeElement?.id,'drawer-close');
  assert.equal(f.key('Escape').defaultPrevented,true);
  assert.equal(f.drawer.isOpen,false);
 }finally{f.cleanup();}
});

test('resizing an open drawer restores the desktop sidebar and re-collapses on mobile',()=>{
 const f=fixture();try{
  f.click('menu-toggle');f.media.matches=false;f.media.dispatchEvent(new Event('change'));
  assert.equal(f.drawer.isOpen,false);
  assert.equal(f.menu.inert,false);
  assert.equal(f.doc.body.style.overflow,'auto');
  f.click('menu-toggle');assert.equal(f.drawer.isOpen,false);
  f.media.matches=true;f.media.dispatchEvent(new Event('change'));
  assert.equal(f.menu.inert,true);
 }finally{f.cleanup();}
});
