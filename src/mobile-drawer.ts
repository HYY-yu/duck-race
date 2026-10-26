import {localized, type PageLanguage} from './i18n-routing';
/** Mobile menus overlay the scene without resizing WebGL or changing race progress. */
export function installMobileDrawer(app:HTMLElement,language:PageLanguage){
 const compact=matchMedia('(max-width: 1000px)');
 const menu=app.querySelector<HTMLElement>('#race-menu')!;
 const toggle=app.querySelector<HTMLButtonElement>('#menu-toggle')!;
 const dismiss=app.querySelector<HTMLButtonElement>('#drawer-close')!;
 const backdrop=app.querySelector<HTMLElement>('#drawer-backdrop')!;
 const background=Array.from(document.querySelectorAll<HTMLElement>('.topbar,#scene,.camera-tools,.mobile-race-action,.seo-content,.site-footer'));
 let opened=false,previousOverflow='';
 function setOpen(value:boolean){
  const next=value&&compact.matches;
  if(opened===next)return;
  opened=next;
  app.classList.toggle('drawer-open',opened);
  backdrop.hidden=!opened;
  toggle.setAttribute('aria-expanded',String(opened));
  toggle.setAttribute('aria-label',opened?localized(language,'关闭比赛菜单','Close race menu','Đóng menu cuộc đua'):localized(language,'打开比赛菜单','Open race menu','Mở menu cuộc đua'));
  menu.inert=compact.matches&&!opened;
  if(opened){
   previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
   menu.setAttribute('role','dialog');menu.setAttribute('aria-modal','true');
   background.forEach(el=>el.inert=true);
   // Resolve the hidden-to-visible style before moving focus into the drawer.
   menu.getBoundingClientRect();dismiss.focus();
   // Native click focus can settle after this handler; restore it once the slide finishes.
   setTimeout(()=>{if(opened&&!menu.contains(document.activeElement))dismiss.focus();},240);
  }else{
   document.body.style.overflow=previousOverflow;
   menu.removeAttribute('role');menu.removeAttribute('aria-modal');
   background.forEach(el=>el.inert=false);
   if(compact.matches)toggle.focus();
  }
  // Observability hook: drawer interactions contain no participant data.
  console.debug('[ui] race drawer changed',{open:opened});
 }
 toggle.addEventListener('click',()=>setOpen(!opened));
 dismiss.addEventListener('click',()=>setOpen(false));
 backdrop.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',event=>{
  if(!opened)return;
  if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
  if(event.key!=='Tab')return;
  const items=Array.from(menu.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href]')).filter(el=>el.getClientRects().length>0);
  const first=items[0],last=items.at(-1);
  if(!menu.contains(document.activeElement)){event.preventDefault();first?.focus();}
  else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 });
 compact.addEventListener('change',()=>{setOpen(false);menu.inert=compact.matches;});
 menu.inert=compact.matches;
 return {close:()=>setOpen(false),get isOpen(){return opened;}};
}
