/// <reference types="vite/client" />
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Race,COLORS,NAMES} from './simulation';
import {sample,world,TRACK_LENGTH,FALLS,obstacles,COURSE_SCALE,LONG_COURSE,MOUNTAIN_COURSE,TRACK_SEED,SLIDE,WINDMILL_S,RAINBOWS} from './track';
import {World} from './world';
import {DuckNameBubbles} from './duck-name-bubbles';
import {COLOR_NAMES,isDuckColor,participantKey,type ColorChoice} from './duck-palette';
import {FollowCamera,stableLookAt} from './follow-camera';
import {FinishPresentation} from './finish-presentation';
import {RaceFeedback} from './race-feedback';
import {AudioScene} from './audio-scene';
import {parseParticipants,createDraw,escapeHTML,validateHistory,resultText,type DrawSession,type SavedDraw} from './draw';
import {courseLabel,trackSearch,type TrackChoice} from './track-navigation';
import {matchVoiceDirection,VoiceControl,type VoiceDirection} from './voice-control';
import {createVoiceLogStore} from './voice-diagnostics';
import {languagePath,pageLanguage} from './i18n-routing';
import {trackEvent} from './observability';
import {installMobileDrawer} from './mobile-drawer';
const MANUAL_MODE=import.meta.env.MODE==='manual'&&import.meta.env.VITE_ENABLE_MANUAL_MODE==='true';
const icons:Record<string,string>={history:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',duck:'<path d="M6 13c-3-2-4 0-3 3 1 4 6 5 11 4 4-1 6-4 5-7l-1-2c3-3 1-7-2-7s-5 2-4 5l1 3c-2 2-4 2-7 1Z" fill="currentColor"/><path d="m19 8 4 2-4 1" fill="#e79136"/><circle cx="16" cy="7.5" r=".85" fill="#294b42"/>',globe:'<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c5 5 5 11 0 16-5-5-5-11 0-16Z"/>',focus:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/><circle cx="12" cy="12" r="3"/>',arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 5 11 7-11 7Z"/>',reset:'<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',flag:'<path d="M5 21V4c5-5 9 5 14 0v9c-5 5-9-5-14 0"/>',wind:'<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7"/>',mountain:'<path d="m2 20 8-15 5 8 3-5 5 12Z"/><path d="m7 11 3 2 3-2"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',chevron:'<path d="m8 4 8 8-8 8"/>',mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',wheel:'<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M6 6l12 12M6 18 18 6"/>',bars:'<path d="M5 3v18M19 3v18M5 8h14M5 16h14"/>',pendulum:'<path d="M3 4h18M12 4l4 11"/><circle cx="17" cy="18" r="3"/>'};
function icon(name:string,size=17){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.duck}</svg>`}
icons.mic='<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>';
const htmlCache=new WeakMap<Element,string>();
function updateHTML(selector:string,html:string){const el=document.querySelector(selector)!;if(htmlCache.get(el)!==html){el.innerHTML=html;htmlCache.set(el,html)}}
const lang=pageLanguage();
const dict={zh:{race:'随机抽签',overview:'全局',follow:'跟随',roster:'本轮名单',standings:'实时排名',drag:'拖动旋转 · 滚轮缩放',valley:'松风山谷',track:'赛道',longTrack:'松风山谷',mountainTrack:'雪岭激流',count:'参与人数',time:'抽签用时',start:'开始抽签',pause:'暂停抽签',resume:'继续抽签',again:'同名单再抽',pendulum:'大摆锤',wheel:'旋转水车',bars:'高低杆',fan:'顺风加速',history:'抽签记录',help:'抽签说明',finished:'全部抵达',watchLake:'全部抵达 · 看小鸭游入湖中',viewResults:'查看结果',arrivalHint:'可切换镜头 · 随时查看结果',soundMuted:'声音 关',soundEnabled:'声音 开',soundOn:'开启声音',soundOff:'关闭声音',soundUnavailable:'声音不可用',contact:'碰撞反弹',landing:'入水',pass:'超越',winner:'中签',results:'抽签结果',record:'最近抽签',noRecord:'还没有抽签记录。',close:'关闭',helpTitle:'放手，让水流决定。',help1:'输入 2–12 位参与者',help1d:'每行一个名字，重名请加编号。开始抽签会锁定本轮名单，并生成完整冲线排名。',help2:'随机分配，真实冲线',help2d:'每轮用浏览器安全随机源，将名单独立随机分配给鸭子。姓名不参与物理计算，按真实冲线顺序生成完整排名，不预设赢家。',help3:'选择你的镜头',help3d:'全局镜头支持拖动与缩放；点击名单跟随小鸭，A / D 或方向键拨水转向。拨水会改变结果，记录会标注人工操作。',help4:'保留结果与使用边界',help4d:'支持复制结果和查看最近 10 轮。本工具在本机运行，没有独立审计或防篡改凭证。同名单再抽会包含所有人，不自动排除以前的第一名。',paused:'抽签已暂停',racing:'正在抽签',end:'已完赛',confirm:'重新开始本轮抽签？当前进度将丢失。',ok:'重新开始',cancel:'继续当前抽签',webgl:'无法启动 3D 场景，请启用浏览器硬件加速后刷新。'},en:{race:'Random draw',overview:'Overview',follow:'Follow',roster:'This draw’s entries',standings:'Live standings',drag:'Drag to orbit · Scroll to zoom',valley:'Pinewood Valley',track:'Course',longTrack:'Pinewood Valley',mountainTrack:'Snowpeak Rapids',count:'ENTRIES',time:'DRAW TIME',start:'Start draw',pause:'Pause draw',resume:'Resume draw',again:'Draw again',pendulum:'Pendulum',wheel:'Waterwheel',bars:'Moving bars',fan:'Tailwind',history:'Draw history',help:'How draws work',finished:'Everyone is home',watchLake:'Everyone is home · Floating into the lake',viewResults:'View results',arrivalHint:'Switch views · Results available anytime',soundMuted:'Sound off',soundEnabled:'Sound on',soundOn:'Enable sound',soundOff:'Mute sound',soundUnavailable:'Sound unavailable',contact:'Contact',landing:'Splashdown',pass:'passed',winner:'Selected',results:'Draw results',record:'Recent draws',noRecord:'No draws yet.',close:'Close',helpTitle:'Let the river decide.',help1:'Add 2–12 participants',help1d:'One name per line. Add a number to distinguish duplicates. Starting locks this draw’s entries and generates the full finishing order.',help2:'Random assignment, real finishes',help2d:'Browser cryptographic randomness independently assigns names to ducks each round. Names never affect physics. Results show the full finishing order, with no forced winner.',help3:'Find your perspective',help3d:'Drag and zoom in overview. Follow a duck and use A / D or arrow keys to steer. Steering affects results and is marked in the record.',help4:'Keep the result',help4d:'Copy results or browse the last 10 draws. This local tool has no independent audit or tamper-proof certificate. Drawing again includes everyone, including previous winners.',paused:'Draw paused',racing:'Drawing names',end:'Finished',confirm:'Restart this draw? Current progress will be lost.',ok:'Restart draw',cancel:'Keep this draw',webgl:'Unable to start 3D. Enable browser hardware acceleration and refresh.'}};
const drawCopy={zh:{color:'鸭子颜色',randomColor:'随机',colorHint:'可为每个人选颜色；不选则每轮随机。',setup:'设置名单',edit:'编辑名单',empty:'还没有参与者',emptyHint:'每行一个名字，支持 2–12 人。',label:'参与者名单',pick:'中签人数',apply:'保存名单',local:'姓名仅在本机处理。完成后的名单和结果保留最近 10 轮，可在记录中清除。',count:'请输入 2–12 位参与者。',duplicate:'名单有重名，请加编号区分（不区分大小写和全半角）。',length:'每个名字最多 40 个字符。',control:'名字不能包含控制字符或不可见的格式字符。',locked:'本轮名单已锁定',configured:'本轮抽取',copy:'复制结果',copied:'已复制结果',copyFailed:'复制失败，请选中下方文本手动复制。',randomFailed:'无法获取安全随机数，本轮未开始。请使用支持安全随机数的浏览器。',clear:'清除本机记录',clearFailed:'无法清除本机记录，请检查浏览器存储权限。',legacy:'旧版漂流成绩',selected:'中签',all:'完整顺序',repeat:'再次抽签包含本轮所有参与者。',proof:'本机抽签记录 · 非独立审计凭证',saveFailed:'本机记录保存失败，请复制结果留存。'},en:{color:'Duck color',randomColor:'Random',colorHint:'Pick a color for each person, or leave it random each round.',setup:'Set up draw',edit:'Edit entries',empty:'No entries yet',emptyHint:'One name per line. 2–12 people.',label:'Participant names',pick:'Number to select',apply:'Save entries',local:'Names stay on this device. The last 10 completed draws include names and results; clear them from history anytime.',count:'Enter 2–12 participants.',duplicate:'Duplicate names: add numbers to distinguish them (case and width insensitive).',length:'Use at most 40 characters per name.',control:'Names cannot contain control or invisible formatting characters.',locked:'Entries locked for this draw',configured:'To select',copy:'Copy results',copied:'Results copied',copyFailed:'Copy failed. Select the text below to copy manually.',randomFailed:'Secure randomness unavailable. The draw did not start. Please use a browser with secure random support.',clear:'Clear local history',clearFailed:'Could not clear local history. Check browser storage permissions.',legacy:'Legacy race result',selected:'Selected',all:'Full finishing order',repeat:'Drawing again includes everyone from this draw.',proof:'Local draw record · No independent audit',saveFailed:'Could not save locally. Please copy the result.'}};
const voiceCopy={zh:{on:'语音 开',off:'语音 关',start:'开启语音控制',stop:'关闭语音控制',starting:'正在连接语音识别…',listening:'正在听：说“向左转”或“向右转”',unsupported:'当前浏览器不支持语音识别',error:'语音识别不可用，请检查麦克风权限',miss:'没听懂，请说“向左转”或“向右转”',inactive:'请先开始比赛',follow:'请先跟随一只鸭子',left:'向左',right:'向右',log:'识别日志'},en:{on:'Voice on',off:'Voice off',start:'Enable voice control',stop:'Disable voice control',starting:'Connecting voice recognition…',listening:'Listening: say “turn left” or “turn right”',unsupported:'Voice recognition is not supported by this browser',error:'Voice recognition unavailable; check microphone permission',miss:'Command not recognized. Say “turn left” or “turn right”',inactive:'Start the race first',follow:'Follow a duck first',left:'left',right:'right',log:'Voice log'}};
const t=(k:keyof typeof dict.zh)=>dict[lang][k];
const dt=(k:keyof typeof drawCopy.zh)=>drawCopy[lang][k];
const vt=(k:keyof typeof voiceCopy.zh)=>voiceCopy[lang][k];
const DEFAULT_PARTICIPANTS=NAMES.slice(0,6).map(names=>names[lang==='zh'?0:1]);
let participants:string[]=[...DEFAULT_PARTICIPANTS];let participantColors:ColorChoice[]=DEFAULT_PARTICIPANTS.map(()=>null);let activeDraw:DrawSession|null=null;let storageFailed=false;
const defaultName=(id:number)=>NAMES[id]?.[lang==='zh'?0:1]??String(id+1);
const rawName=(id:number)=>activeDraw?.names[id]??participants[id]??defaultName(id);
const name=(id:number)=>escapeHTML(rawName(id));
const duckColor=(id:number)=>activeDraw?.colors?.[id]??participantColors[id]??COLORS[id];
const app=document.querySelector<HTMLDivElement>('#app')!;
const currentTrack:TrackChoice=MOUNTAIN_COURSE?'mountain':'long';
const race=new Race(6,0);let mode:'overview'|'follow'='overview',selected=0;const audio=new AudioScene(),feedback=new RaceFeedback();const finishPresentation=new FinishPresentation();const followCamera=new FollowCamera(true);let arrivalView=false;let modalKind='';let lastUI=0;let pausedByVisibility=false;
let voiceState:'idle'|'starting'|'listening'|'unsupported'|'error'='idle',voiceNotice='',voiceNoticeUntil=0;
let voiceSteering:{duck:number;direction:VoiceDirection;until:number}|null=null;
let lastVoiceCommand:{duck:number;direction:VoiceDirection;at:number}|null=null;
const voiceLogs=MANUAL_MODE?createVoiceLogStore():null;
const voice=MANUAL_MODE?new VoiceControl(handleVoiceTranscript,status=>{voiceState=status;voiceLogs?.record({kind:'status',status,raceState:race.state,camera:mode,selected});if(status==='error'){voiceNotice=vt('error');voiceNoticeUntil=performance.now()+5000;}queueMicrotask(voiceUI);},undefined,event=>voiceLogs?.record({kind:'engine',reason:event.kind,error:event.value,raceState:race.state,camera:mode,selected})):null;voice?.setLanguage(lang);
if(MANUAL_MODE)console.warn('[features] Local manual mode enabled; do not deploy this build publicly',{mode:import.meta.env.MODE});
function shell(){app.innerHTML=`
 <header class="topbar">
  <div class="brand-cluster"><button class="menu-toggle" id="menu-toggle" aria-controls="race-menu" aria-expanded="false" aria-label="${lang==='zh'?'打开比赛菜单':'Open race menu'}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><div class="brand"><div class="brand-mark">${icon('duck',27)}</div><div class="brand-name">duck rush<span>.</span></div></div><label class="track-switcher"><span>${t('track')}</span><select id="track-select" aria-label="${t('track')}"><option value="long"${currentTrack==='long'?' selected':''}>${t('longTrack')}</option><option value="mountain"${currentTrack==='mountain'?' selected':''}>${t('mountainTrack')}</option></select></label></div>
  <div class="top-right">${MANUAL_MODE?`<button class="plain voice-toggle" id="voice" aria-pressed="false" aria-label="${vt('start')}">${icon('mic',15)}<span>${vt('off')}</span></button>`:''}<button class="plain sound-toggle" id="sound" aria-pressed="false" aria-label="${t('soundOn')}">${t('soundMuted')}</button><a class="plain language-link" id="language" href="${languagePath(lang==='zh'?'en':'zh')}">${lang==='zh'?'EN':'中文'}</a></div>
 </header>
 <main class="game-surface">
  <div class="scene" id="scene"></div>
  <div class="drawer-backdrop" id="drawer-backdrop" hidden></div>
  <aside class="sidebar" id="race-menu" aria-label="${t('race')}">
   <button class="drawer-close" id="drawer-close" aria-label="${t('close')}">×</button>
   <h1>${lang==='zh'?'名单鸭子竞速器':'Duck Race Name Picker'}</h1>
   <p class="game-intro">${lang==='zh'?'快速输入 2–12 个名字。观看无预设赢家的刺激 3D 障碍河道竞速。':'Add 2–12 names in seconds. Watch an exciting 3D obstacle race with no preset winner.'}</p>
   <div class="roster-head"><div><span id="roster-title">${t('roster')}</span><span class="entry-total" id="count">0</span></div><button class="plain" id="edit-entries">${dt('edit')}</button></div>
   <div class="roster" id="roster"></div>
   <div class="draw-actions">
    <div class="draw-summary" id="draw-note"></div>
    <div class="draw-timing" id="draw-timing"><span>${t('time')}</span><div class="timer" id="timer">00:00<span>.00</span></div></div>
    <div class="progress-line" id="draw-progress"><div class="progress-fill" id="progress"></div></div>
    <div class="status-pill" id="status" role="status"></div>
    <button class="start-button" id="start"><span>${dt('setup')}</span>${icon('arrow')}</button>
    <button class="reset-button" id="reset">${icon('reset',14)}<span id="reset-label">${t('again')}</span></button>
   </div>
   <nav class="sidebar-nav">${MANUAL_MODE?`<button class="plain" id="voice-log">${icon('mic',16)}${vt('log')}${icon('chevron',12)}</button>`:''}<button class="plain" id="history">${icon('history',16)}${t('history')}${icon('chevron',12)}</button><button class="plain" id="help">${icon('info',16)}${t('help')}${icon('chevron',12)}</button></nav>
  </aside>
  <div class="camera-tools"><div class="segmented"><button id="overview" class="active">${icon('globe',14)}${t('overview')}</button><button id="follow">${icon('focus',14)}${t('follow')}</button></div><select id="duck-select" aria-label="${t('follow')}" class="hidden"></select></div>
  ${MANUAL_MODE?'<div class="voice-feedback" id="voice-feedback" role="status" aria-live="polite"></div>':''}
  <div class="scene-caption">${t('drag')}</div>
  <div class="race-events" id="race-events" aria-live="polite" aria-atomic="true"></div>
  <div class="track-tag">${icon('mountain',16)}<span>${MOUNTAIN_COURSE?(lang==='zh'?'雪岭激流':'Snowpeak Rapids')+' · '+TRACK_SEED:t('valley')}</span></div>
  <button class="start-button mobile-race-action" id="mobile-start"></button>
  <div class="countdown" id="countdown"><span>3</span></div>
 </main>`;}

shell();
const mobileDrawer=installMobileDrawer(app,lang);
let renderer:THREE.WebGLRenderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(error){console.error('[render] WebGL initialization failed',error);trackEvent('asset_failed',{language:lang,asset:'webgl-context'});app.insertAdjacentHTML('beforeend',`<div class="error">${t('webgl')}</div>`);throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=THREE.SRGBColorSpace;
const nameBubbles=new DuckNameBubbles();
const worldView=new World(renderer);worldView.setDucks(race.ducks.length);
const camera=new THREE.PerspectiveCamera(39,1,.1,1000);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=12;controls.maxDistance=190*COURSE_SCALE;controls.maxPolarAngle=Math.PI*.47;controls.target.set(0,15,0);
function overview(){camera.fov=innerWidth<700?48:39;camera.updateProjectionMatrix();arrivalView=false;mode='overview';controls.enabled=true;camera.position.set(111,106,145).multiplyScalar(COURSE_SCALE*(innerWidth<700?1.16:1));if(MOUNTAIN_COURSE){const start=sample(0),angle=Math.atan2(start.z,start.x);camera.position.set(Math.cos(angle)*340,280,Math.sin(angle)*340);}controls.target.set(0,13,-4*COURSE_SCALE);controls.update();cameraUI();}
function follow(id:number){arrivalView=false;followCamera.reset();selected=id;mode='follow';controls.enabled=false;cameraUI();}
function cameraUI(){
 const following=mode==='follow'&&!arrivalView;
 document.querySelector('.game-surface')?.classList.toggle('follow-mode',following);
 document.querySelector('#overview')?.classList.toggle('active',mode==='overview'&&!arrivalView);
 document.querySelector('#follow')?.classList.toggle('active',following);
 const select=document.querySelector<HTMLSelectElement>('#duck-select');if(select){select.classList.toggle('hidden',!following);select.value=String(selected);}
 const caption=document.querySelector('.scene-caption');if(caption)caption.textContent=following?(MANUAL_MODE?(lang==='zh'?'A / D · ← / → 拨水转向':'A / D · ← / → Paddle to steer'):(lang==='zh'?'仅观看 · 自动竞速':'View only · Automatic race')):t(arrivalView?'arrivalHint':'drag');
}

function voiceUI(){
 if(!MANUAL_MODE)return;
 const button=document.querySelector<HTMLButtonElement>('#voice');
 if(button&&voice){button.disabled=!voice.available;button.setAttribute('aria-pressed',String(voice.enabled));button.setAttribute('aria-label',vt(voice.enabled?'stop':'start'));button.dataset.voiceState=voiceState;button.innerHTML=`${icon('mic',15)}<span>${vt(voice.enabled?'on':'off')}</span>`;}
 const status=document.querySelector<HTMLElement>('#voice-feedback');if(!status)return;
 const notice=performance.now()<voiceNoticeUntil?voiceNotice:voiceState==='listening'?vt('listening'):voiceState==='starting'?vt('starting'):voiceState==='unsupported'?vt('unsupported'):'';
 status.textContent=notice;status.classList.toggle('show',!!notice);
}
function handleVoiceTranscript(transcripts:readonly string[],isFinal=true){
 if(!MANUAL_MODE)return;
 voiceLogs?.record({kind:'recognition',transcripts:[...transcripts],final:isFinal,raceState:race.state,camera:mode,selected});
 if(race.state!=='racing'){voiceLogs?.record({kind:'decision',accepted:false,reason:'race-inactive',raceState:race.state,camera:mode,selected});voiceNotice=vt('inactive');voiceNoticeUntil=performance.now()+2600;console.debug('[voice] command ignored',{reason:'race-inactive'});voiceUI();return;}
 if(mode!=='follow'){if(isFinal){voiceLogs?.record({kind:'decision',accepted:false,reason:'no-follow-target',raceState:race.state,camera:mode,selected});voiceNotice=vt('follow');voiceNoticeUntil=performance.now()+2600;console.debug('[voice] command ignored',{reason:'no-follow-target'});voiceUI();}return;}
 const match=matchVoiceDirection(transcripts),direction=match?.direction??null;
 if(direction===null){if(isFinal){voiceLogs?.record({kind:'decision',accepted:false,reason:'unmatched',raceState:race.state,camera:mode,selected});voiceNotice=vt('miss');voiceNoticeUntil=performance.now()+2600;console.debug('[voice] command ignored',{reason:'unmatched'});voiceUI();}return;}
 if(race.ducks[selected]?.finish!==null){if(isFinal){voiceLogs?.record({kind:'decision',accepted:false,reason:'duck-finished',raceState:race.state,camera:mode,selected});voiceNotice=vt('miss');voiceNoticeUntil=performance.now()+2600;console.debug('[voice] command ignored',{reason:'duck-finished'});voiceUI();}return;}
 const now=performance.now();if(lastVoiceCommand&&lastVoiceCommand.duck===selected&&lastVoiceCommand.direction===direction&&now-lastVoiceCommand.at<1600){voiceLogs?.record({kind:'decision',accepted:false,reason:'duplicate',direction:direction<0?'left':'right',raceState:race.state,camera:mode,selected});return;}
 lastVoiceCommand={duck:selected,direction,at:now};
 voiceSteering={duck:selected,direction,until:performance.now()+1200};
 nameBubbles.command(selected,direction);audio.command(direction);
 voiceNotice=`${rawName(selected)} · ${vt(direction<0?'left':'right')}`;voiceNoticeUntil=performance.now()+2600;
 voiceLogs?.record({kind:'decision',accepted:true,direction:direction<0?'left':'right',match:match!.source,raceState:race.state,camera:mode,selected});
 // Metrics hook: count accepted direction commands by course; raw text stays in bounded local diagnostics only.
 console.info('[voice] command accepted',{duck:selected,direction:direction<0?'left':'right',corrected:match!.source==='correction',course:currentTrack});voiceUI();
}

function attach(){
 const scene=document.querySelector<HTMLElement>('#scene')!;scene.appendChild(renderer.domElement);nameBubbles.bind(scene,race.ducks.map(d=>rawName(d.id)),race.ducks.map(d=>duckColor(d.id)));
 if(MANUAL_MODE&&voice){document.querySelector('#voice')?.addEventListener('click',()=>voice.toggle());voice.setLanguage(lang);voiceUI();}
 document.querySelector<HTMLSelectElement>('#track-select')!.addEventListener('change',e=>{const to=(e.target as HTMLSelectElement).value as TrackChoice;if(to===currentTrack)return;console.info('[navigation] track changed',{from:currentTrack,to});location.search=trackSearch(location.search,to);});
 document.querySelector('#sound')!.addEventListener('click',async()=>{await audio.toggle();audioUI();});audioUI();
 document.querySelector('#language')!.addEventListener('click',()=>trackEvent('language_switch',{from:lang,to:lang==='zh'?'en':'zh'}));document.querySelector('#overview')!.addEventListener('click',overview);document.querySelector('#follow')!.addEventListener('click',()=>follow(selected));document.querySelector('#duck-select')!.addEventListener('change',e=>follow(Number((e.target as HTMLSelectElement).value)));
 document.querySelector('#mobile-start')!.addEventListener('click',()=>document.querySelector<HTMLButtonElement>('#start')!.click());
 document.querySelector('#edit-entries')!.addEventListener('click',showSetup);document.querySelector('#start')!.addEventListener('click',()=>{if(race.state==='ready')beginDraw();else if(race.state==='finished')showResults();else race.pause();updateUI()});
 document.querySelector('#reset')!.addEventListener('click',()=>{if(race.state==='racing'||race.state==='paused'||race.state==='countdown'){showModal('restart',`<h2>${t('again')}</h2><p>${t('confirm')}</p><button class="start-button" id="confirm-reset">${t('ok')}</button><button class="plain" id="cancel-reset" style="width:100%;margin-top:10px">${t('cancel')}</button>`);document.querySelector('#confirm-reset')!.addEventListener('click',()=>{reset();closeModal()});document.querySelector('#cancel-reset')!.addEventListener('click',closeModal);}else reset()});
 if(MANUAL_MODE)document.querySelector('#voice-log')?.addEventListener('click',showVoiceLogs);
 document.querySelector('#help')!.addEventListener('click',showHelp);document.querySelector('#history')!.addEventListener('click',showHistory);document.querySelector('#roster')!.addEventListener('click',e=>{const row=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-duck]');if(row){follow(Number(row.dataset.duck));mobileDrawer.close();}});
 const select=document.querySelector('#duck-select')!;select.innerHTML=race.ducks.map(d=>`<option value="${d.id}">${String(d.id+1).padStart(2,'0')} · ${name(d.id)}</option>`).join('');cameraUI();
}
function reset(){activeDraw=null;storageFailed=false;voiceSteering=null;lastVoiceCommand=null;race.reset(participants.length||race.ducks.length,0);feedback.update(race);finishPresentation.reset(race.generation);arrivalView=false;controls.enabled=mode==='overview';followCamera.reset();if(mode==='overview')overview();worldView.setDucks(race.ducks.length,participantColors);refreshNames();updateUI();}
function refreshNames(){nameBubbles.setNames(race.ducks.map(d=>rawName(d.id)),race.ducks.map(d=>duckColor(d.id)));document.querySelector('#duck-select')!.innerHTML=race.ducks.map(d=>`<option value="${d.id}">${name(d.id)}</option>`).join('');}
function beginDraw(){
 mobileDrawer.close();
 if(!participants.length){showSetup();return;}
 let session:DrawSession;
 try{session=createDraw(participants,participants.length,undefined,participantColors);}catch(error){console.error('[draw] secure setup failed',error);showModal('error',`<h2>${dt('randomFailed')}</h2>`);return;}
 activeDraw=session;storageFailed=false;
 race.reset(session.names.length,session.seed);feedback.update(race);finishPresentation.reset(race.generation);arrivalView=false;followCamera.reset();controls.enabled=mode==='overview';
 worldView.setDucks(race.ducks.length,session.colors);refreshNames();follow(0);
 // Start audio in the initiating user gesture; repeated draws must not toggle it off.
 void audio.setEnabled(true).then(audioUI);race.start();
 // Metrics hook: draw started, entry/selection counts and ID only. Never log participant names.
 console.info('[draw] started',{drawId:session.id,count:session.names.length,mode:'ranking'});
 trackEvent('race_started',{language:lang,course:currentTrack,entryCount:session.names.length});
 updateUI();
}
function showSetup(){
 if(!['ready','finished'].includes(race.state))return;
 showModal('setup',`<div class="eyebrow">DUCK RUSH / RANDOM DRAW</div><h2>${dt('setup')}</h2><form id="draw-form" class="draw-setup"><label for="entries">${dt('label')}</label><textarea id="entries" maxlength="8192" rows="7" placeholder="${lang==='zh'?'小林\n小周\n小陈':'Alex\nSam\nRobin'}" aria-describedby="list-error draw-local">${escapeHTML(participants.join('\n'))}</textarea><div class="setup-meta"><span id="entry-count"></span></div><p id="list-error" class="form-error" aria-live="polite"></p><section id="color-config" class="color-config" aria-label="${dt('color')}"></section><p id="draw-local">${dt('local')}</p><button class="start-button" type="submit" id="save-entries">${dt('apply')}${icon('arrow')}</button></form>`);
 const input=document.querySelector<HTMLTextAreaElement>('#entries')!,save=document.querySelector<HTMLButtonElement>('#save-entries')!;
 const draftColors=new Map(participants.map((n,i)=>[participantKey(n),participantColors[i]??null]));
 const colorConfig=document.querySelector<HTMLElement>('#color-config')!;
 const renderColors=(names:string[],valid:boolean)=>{colorConfig.innerHTML=valid?`<h3>${dt('color')}</h3><p>${dt('colorHint')}</p>${names.map((n,i)=>{const value=draftColors.get(participantKey(n))??null;return `<label class="entry-color" for="entry-color-${i}"><span class="color-dot ${value?'':'random'}" style="${value?'background:'+value:''}"></span><span class="entry-color-name" title="${escapeHTML(n)}">${escapeHTML(n)}</span><select id="entry-color-${i}" data-color-index="${i}" aria-label="${escapeHTML(n)} · ${dt('color')}"><option value="" ${value===null?'selected':''}>${dt('randomColor')}</option>${COLORS.map((c,j)=>`<option value="${c}" ${c===value?'selected':''}>${COLOR_NAMES[lang][j]}</option>`).join('')}</select></label>`;}).join('')}`:'';};
 colorConfig.addEventListener('change',e=>{const el=e.target as HTMLSelectElement;if(!el.matches('select[data-color-index]'))return;const names=parseParticipants(input.value).names,name=names[Number(el.dataset.colorIndex)];if(!name)return;const value=isDuckColor(el.value)?el.value:null;draftColors.set(participantKey(name),value);const dot=el.parentElement!.querySelector<HTMLElement>('.color-dot')!;dot.classList.toggle('random',value===null);dot.style.background=value??'';});
 const validate=()=>{const parsed=parseParticipants(input.value);document.querySelector('#entry-count')!.textContent=`${parsed.names.length} / 12`;document.querySelector('#list-error')!.textContent=parsed.error?dt(parsed.error):'';input.setAttribute('aria-invalid',String(!!parsed.error));save.disabled=!!parsed.error;renderColors(parsed.names,!parsed.error);};
 input.addEventListener('input',validate);validate();input.focus();
 document.querySelector('#draw-form')!.addEventListener('submit',e=>{e.preventDefault();const parsed=parseParticipants(input.value);if(parsed.error){validate();return;}participants=[...parsed.names];participantColors=participants.map(n=>draftColors.get(participantKey(n))??null);selected=Math.min(selected,participants.length-1);reset();closeModal();console.info('[draw] entries configured',{count:participants.length});});
}
function formatTime(time:number){const m=Math.floor(time/60).toString().padStart(2,'0'),s=Math.floor(time%60).toString().padStart(2,'0'),ms=Math.floor(time%1*100).toString().padStart(2,'0');return `${m}:${s}.${ms}`;}
function audioUI(){const button=document.querySelector<HTMLButtonElement>('#sound');if(button){button.textContent=t(!audio.available?'soundUnavailable':audio.enabled?'soundEnabled':'soundMuted');button.setAttribute('aria-label',t(audio.enabled?'soundOff':'soundOn'));button.setAttribute('aria-pressed',String(audio.enabled));button.dataset.audioState=audio.diagnostics.context;button.disabled=!audio.available;}}
function updateUI(){audioUI();const ready=race.state==='ready',finished=race.state==='finished';document.querySelector('#count')!.textContent=String(participants.length);const edit=document.querySelector<HTMLButtonElement>('#edit-entries')!;edit.disabled=!ready&&!finished;edit.classList.toggle('hidden',!participants.length);edit.textContent=dt('edit');document.querySelector('#draw-note')!.textContent=participants.length?dt('all'):dt('emptyHint');document.querySelector('#draw-note')!.classList.toggle('hidden',!participants.length);document.querySelector('#draw-timing')!.classList.toggle('hidden',ready);document.querySelector('#draw-progress')!.classList.toggle('hidden',ready);document.querySelector('#reset')!.classList.toggle('hidden',ready);document.querySelector('#reset-label')!.textContent=finished?t('again'):t('ok');const time=formatTime(race.time);document.querySelector('#timer')!.innerHTML=`${time.slice(0,5)}<span>${time.slice(5)}</span>`;updateHTML('#start',`<span>${(ready&&!participants.length?dt('setup'):t(ready?'start':finished?'viewResults':race.state==='paused'?'resume':'pause'))}</span>${icon(ready||finished?'arrow':race.state==='paused'?'play':'pause')}`);updateHTML('#mobile-start',document.querySelector('#start')!.innerHTML);document.querySelector('#roster-title')!.textContent=t(ready?'roster':'standings');updateHTML('#roster',(!participants.length&&ready)?`<div class="empty-roster"><span class="empty-duck">${icon('duck',33)}</span><span>${dt('empty')}</span><small>${dt('emptyHint')}</small></div>`:(ready?[...race.ducks].sort((a,b)=>a.id-b.id):race.ranking()).map((d,i)=>`<button class="racer ${mode==='follow'&&selected===d.id?'active':''} ${race.floatTime>=feedback.hits[d.id]&&race.floatTime-feedback.hits[d.id]<1.1?'recent-hit':''}" data-duck="${d.id}" aria-label="${t('follow')} ${name(d.id)}"><span class="num">${String(ready?d.id+1:i+1).padStart(2,'0')}</span><span class="duck-dot" style="--duck:${duckColor(d.id)};color:#42604b">${icon('duck',18)}</span><span class="racer-name" title="${name(d.id)}">${name(d.id)}</span><span class="value">${d.finish!==null?formatTime(d.finish):ready?'↗':`${Math.min(99,Math.floor(d.s/(TRACK_LENGTH-2)*100))}%`}</span></button>`).join(''));const progress=Math.min(100,Math.max(...race.ducks.map(d=>d.s))/(TRACK_LENGTH-2)*100);(document.querySelector('#progress')as HTMLElement).style.width=ready?'0':`${progress}%`;const count=document.querySelector('#countdown')!;count.classList.toggle('show',race.state==='countdown');count.querySelector('span')!.textContent=String(Math.max(1,Math.ceil(race.countdown)));const status=document.querySelector('#status')!;status.classList.toggle('show',race.state==='paused'||race.state==='racing'||finished);updateHTML('#race-events',feedback.notices.map(n=>`<div class="race-event ${n.kind}"><span class="event-dot" style="background:${duckColor(n.duck)}"></span><span>${name(n.duck)} ${n.kind==='pass'?`${t('pass')} ${name(n.other!)}`:`· ${t(n.kind)}`}</span></div>`).join(''));status.textContent=race.state==='paused'?t('paused'):finished?t(finishPresentation.shown?'finished':'watchLake'):`${t('racing')} · ${race.results.length}/${race.ducks.length}`;cameraUI();}
function currentRecord():SavedDraw{return {mode:'ranking',course:MOUNTAIN_COURSE?'mountain':'long',trackSeed:TRACK_SEED,controlled:MANUAL_MODE&&race.controlled,date:activeDraw?.date??new Date().toISOString(),seed:race.seed,results:race.results.map(d=>({id:d.id,time:d.finish!})),...(activeDraw?{names:[...activeDraw.names],...(activeDraw.colors?{colors:[...activeDraw.colors]}:{}),drawId:activeDraw.id}:{})};}
function readHistory():SavedDraw[]{try{const raw:unknown=JSON.parse(localStorage.getItem('duck-rush-history')||'[]');const history=validateHistory(raw);if(!Array.isArray(raw)||history.length<Math.min(raw.length,10))console.warn('[storage] Invalid history records skipped');return history;}catch(error){console.warn('[storage] History could not be read',{errorType:error instanceof Error?error.name:'unknown'});return [];}}
function saveRace(){if(!activeDraw)return;try{const history=readHistory();history.unshift(currentRecord());localStorage.setItem('duck-rush-history',JSON.stringify(history.slice(0,10)));console.info('[draw] completed',{drawId:activeDraw.id,count:race.results.length,mode:'ranking'});}catch(error){storageFailed=true;console.warn('[storage] Draw result could not be persisted',error);}}
let lastFocused:HTMLElement|null=null;let modalPaused=false;
function showModal(kind:string,html:string){mobileDrawer.close();if(modalKind)closeModal();lastFocused=document.activeElement as HTMLElement;modalPaused=race.state==='racing'||race.state==='countdown';if(modalPaused)race.pause();modalKind=kind;const label=kind==='voice-log'?vt('log'):kind==='setup'?dt('setup'):t(kind==='results'?'results':kind==='history'?'record':kind==='restart'?'again':'help');app.insertAdjacentHTML('beforeend',`<div class="modal-shade"><div class="modal-frame"><section class="modal" role="dialog" aria-modal="true" aria-label="${label}"><button class="close" aria-label="${t('close')}">×</button>${html}</section></div></div>`);document.querySelector<HTMLButtonElement>('.close')!.onclick=closeModal;document.querySelector<HTMLButtonElement>('.close')!.focus();document.querySelector('.modal-shade')!.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});}
function closeModal(){document.querySelector('.modal-shade')?.remove();modalKind='';if(modalPaused&&race.state==='paused')race.pause();modalPaused=false;lastFocused?.focus();}
function showHelp(){const cameraHelp=lang==='zh'?'全局镜头支持拖动与缩放；也可跟随任意小鸭观看。公开版本只有自动竞速，观看不会改变比赛结果。':'Drag and zoom in overview, or follow any duck as a view-only camera. The public version is automatic-only, so watching cannot change the result.';showModal('help',`<div class="eyebrow">DUCK RUSH / FIELD GUIDE</div><h2>${t('helpTitle')}</h2>${[1,2,3,4].map(i=>`<div class="help-row"><b>0${i} · ${t(`help${i}` as keyof typeof dict.zh)}</b><span>${i===3&&!MANUAL_MODE?cameraHelp:t(`help${i}d` as keyof typeof dict.zh)}</span></div>`).join('')}`)}
function showVoiceLogs(){
 if(!MANUAL_MODE||!voiceLogs)return;
 const entries=voiceLogs.entries,text=voiceLogs.text(),empty=lang==='zh'?'还没有识别记录。开启语音并说几次“左”或“右”。':'No recognition records yet. Enable voice and say “left” or “right”.';
 showModal('voice-log',`<div class="eyebrow">DUCK RUSH / VOICE DIAGNOSTICS</div><h2>${vt('log')}</h2><p>${lang==='zh'?'日志包含浏览器返回的原始识别文本，最多保留 80 条并在 24 小时后过期，仅存于当前浏览器。':'Logs contain raw recognition text, retain at most 80 entries for 24 hours, and stay in this browser.'}</p><pre class="voice-log-output" id="voice-log-output">${entries.length?escapeHTML(text):escapeHTML(empty)}</pre><button class="copy-button" id="copy-voice-log">${lang==='zh'?'复制日志':'Copy log'}</button><button class="copy-button voice-log-clear" id="clear-voice-log">${lang==='zh'?'清除日志':'Clear log'}</button><p id="voice-log-status" role="status"></p>`);
 document.querySelector('#copy-voice-log')!.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(voiceLogs.text());document.querySelector('#voice-log-status')!.textContent=lang==='zh'?'已复制':'Copied';}catch(error){console.warn('[voice] diagnostics copy failed',{errorType:error instanceof Error?error.name:'unknown'});document.querySelector('#voice-log-status')!.textContent=lang==='zh'?'复制失败':'Copy failed';}});
 document.querySelector('#clear-voice-log')!.addEventListener('click',()=>{voiceLogs.clear();document.querySelector('#voice-log-output')!.textContent=empty;document.querySelector('#voice-log-status')!.textContent=lang==='zh'?'已清除':'Cleared';});
}
function showResults(){
 if(!race.results.length)return;
 finishPresentation.shown=true;console.info('[presentation] results opened',{viewingSeconds:finishPresentation.age});
 const record=currentRecord();
 showModal('results',`<div class="eyebrow">${t('results')}</div><h2>${dt('all')}</h2><div class="draw-winners">${race.results.slice(0,1).map(d=>`<div><span class="duck-dot" style="--duck:${duckColor(d.id)}">${icon('duck',20)}</span><strong>${name(d.id)}</strong></div>`).join('')}</div><div class="result-meta">${record.drawId?escapeHTML(record.drawId):''}</div><p>${dt('all')} · ${formatTime(race.time)}${race.controlled?(lang==='zh'?' · 含人工拨水':' · Manual steering'):''}</p><div class="results-list">${race.results.map((d,i)=>`<div class="result-row ${i===0?'is-selected':''}"><span>${String(i+1).padStart(2,'0')}</span><span class="result-name">${name(d.id)}</span>${i===0?`<small>${lang==='zh'?'第一名':'1st'}</small>`:''}<span class="time">${formatTime(d.finish!)}</span></div>`).join('')}</div><button class="copy-button" id="copy-results">${dt('copy')}</button><p id="copy-status" role="status">${storageFailed?dt('saveFailed'):dt('proof')}</p><button class="start-button" id="race-again">${t('again')}${icon('arrow')}</button><p>${dt('repeat')}</p>`);
 document.querySelector('#race-again')!.addEventListener('click',()=>{reset();closeModal()});
 document.querySelector('#copy-results')!.addEventListener('click',async()=>{const text=resultText(record,lang,defaultName);try{await navigator.clipboard.writeText(text);const status=document.querySelector('#copy-status');if(status)status.textContent=dt('copied');}catch(error){console.warn('[draw] Clipboard unavailable',error);const status=document.querySelector('#copy-status');if(status){status.textContent=dt('copyFailed');document.querySelector('.copy-fallback')?.remove();status.insertAdjacentHTML('afterend',`<textarea class="copy-fallback" readonly aria-label="${dt('copy')}">${escapeHTML(text)}</textarea>`);document.querySelector<HTMLTextAreaElement>('.copy-fallback')?.select();}}});
}
function showHistory(){
 const history=readHistory();
 showModal('history',`<div class="eyebrow">DUCK RUSH / LOCAL HISTORY</div><h2>${t('record')}</h2>${history.length?history.map(r=>`<div class="help-row"><b>${new Date(r.date).toLocaleString(lang==='zh'?'zh-CN':'en-GB')}</b>${!r.names?`<div class="result-meta">${dt('legacy')}</div>`:''}${r.course?`<div class="result-meta">${courseLabel(r.course,lang)}</div>`:''}${r.controlled?`<div class="result-meta">${lang==='zh'?'含人工拨水':'Manual steering'}</div>`:''}${r.trackSeed!==undefined?`<div class="result-meta">${lang==='zh'?'地图种子':'Track seed'} · ${r.trackSeed}</div>`:''}${r.drawId?`<div class="result-meta">${escapeHTML(r.drawId)}</div>`:''}<span>${r.results.map((d,i)=>`${i+1}. ${escapeHTML(r.names?.[d.id]??defaultName(d.id))}${r.mode!=='ranking'&&r.names&&i<(r.winnerCount??1)?` [${dt('selected')}]`:''} ${formatTime(d.time)}`).join(' · ')}</span></div>`).join(''):`<p>${t('noRecord')}</p>`}<p>${dt('local')}</p>${history.length?`<button class="copy-button" id="clear-history">${dt('clear')}</button>`:''}`);
 document.querySelector('#clear-history')?.addEventListener('click',()=>{try{localStorage.removeItem('duck-rush-history');console.info('[storage] Local draw history cleared');showHistory();}catch(error){console.warn('[storage] Could not clear history',error);document.querySelector('#clear-history')!.textContent=dt('clearFailed');}});
}
let wasCompact=innerWidth<700;
function resize(){if(wasCompact!==(innerWidth<700)){wasCompact=innerWidth<700;if(mode==='overview')overview();}const el=document.querySelector('#scene')!;const rect=el.getBoundingClientRect();renderer.setSize(rect.width,rect.height);nameBubbles.measure();camera.aspect=rect.width/rect.height;camera.fov=innerWidth<700?48:39;camera.updateProjectionMatrix();}
attach();overview();resize();updateUI();window.addEventListener('resize',resize);
// Development-only reproducible inspection. This runs the real fixed-step simulation,
// freezes at a physical event (or continues post-race lake drift) without changing normal races or production builds.
if(import.meta.env.DEV){
 void import('./preview-capture').then(({installPreviewCapture})=>installPreviewCapture(renderer,worldView.scene,camera)).catch(error=>console.error('[preview] capture helper unavailable',error));
 const inspection=new URLSearchParams(location.search).get('inspect');
 if(MANUAL_MODE&&inspection==='voice'){participants=[...DEFAULT_PARTICIPANTS];participantColors=DEFAULT_PARTICIPANTS.map(()=>null);reset();race.start();for(let i=0;i<181;i++)race.step(1/60);follow(0);handleVoiceTranscript(['王者'],false);nameBubbles.command(0,-1,6000);updateUI();console.info('[inspection] corrected current follow voice direction',{state:race.state,target:0,direction:'left'});}
 if(inspection==='audience'){race.reset(6,42);race.start();for(let i=0;i<15000&&!race.results.length;i++)race.step(1/60);for(let i=0;i<68;i++)race.step(1/60);race.pause();const p=world(TRACK_LENGTH-1);camera.position.set(p.x-8,14,p.z+19);controls.target.set(-1,4.8,40);controls.update();updateUI();console.info('[inspection] bridge audience',{finishers:race.results.length,time:race.time});}
 if(inspection==='cone'||inspection==='cone-down'){
  race.reset(6,42);race.start();
  if(inspection==='cone-down'){for(let i=0;i<2400;i++){race.step(1/60);if(!race.cone.upright&&race.cone.tilt>1.4)break;}race.pause();}
  const p=sample(race.cone.s);camera.position.set(p.x+p.tx*7-p.tz*7,p.y+5,p.z+p.tz*7+p.tx*7);controls.target.set(p.x,p.y+.5,p.z);controls.update();
 }
 if(LONG_COURSE&&inspection&&['rainbow','slide','windmill'].includes(inspection)){const s=inspection==='rainbow'?RAINBOWS[0]:inspection==='slide'?(SLIDE.start+SLIDE.end)/2:WINDMILL_S,p=sample(s);race.reset(6,42);race.start();for(let i=0;i<24000&&race.ducks[0].s<s;i++)race.step(1/60);race.pause();updateUI();camera.position.set(p.x+p.tx*18-p.tz*20,p.y+14,p.z+p.tz*18+p.tx*20);controls.target.set(p.x,p.y+1,p.z);controls.update();}
 if(inspection==='connector'){camera.position.set(-170,170,245);controls.target.set(25,45,135);controls.update();}
 if(inspection==='spring'){const p=sample(0);camera.position.set(p.x+p.tx*16+p.tz*10,p.y+11,p.z+p.tz*16-p.tx*10);controls.target.set(p.x,p.y+1,p.z);controls.update();}
 if(inspection&&['fall','landing','contact','pendulum','lake','arrival'].includes(inspection)){
  race.reset(6,42);race.start();let found=false;
  for(let step=0;step<15000;step++){race.step(1/60);const impact=inspection==='pendulum'?race.events.find(e=>e.source==='pendulum'):undefined;if(impact)selected=impact.duck;const d=race.ducks[selected];
   found=inspection==='pendulum'?!!impact:inspection==='lake'||inspection==='arrival'?race.state==='finished':inspection==='fall'?d.airborne&&d.s>FALLS[1].lip+.5:inspection==='landing'?d.landings===2&&race.time-d.lastLanding>.12:d.hits>0&&Math.abs(d.roll)>.15;
   if(found)break;
  }
  if(found){if(inspection==='pendulum')for(let i=0;i<7;i++)race.step(1/60);if(inspection==='lake'){for(let i=0;i<1200;i++)race.step(1/60);finishPresentation.reset(race.generation);finishPresentation.started=true;finishPresentation.shown=true;}race.pause();const d=race.ducks[selected],p=world(d.s,d.lane),f=sample(d.s);camera.position.set(p.x+f.tx*10-f.tz*12,d.y+6,p.z+f.tz*10+f.tx*12);controls.target.set(p.x,d.y+.3,p.z);controls.update();console.info('[inspection] checkpoint',{inspection,time:race.time,duck:0,airborne:d.airborne,entrySpeed:d.entrySpeed});}
  else console.warn('[inspection] checkpoint not reached',{inspection});updateUI();
 }
}

const paddleKeys=new Set<string>();
const paddleCodes=['KeyA','KeyD','ArrowLeft','ArrowRight'];
if(MANUAL_MODE){
 document.addEventListener('keydown',event=>{
  if(!paddleCodes.includes(event.code)||modalKind||mobileDrawer.isOpen||mode!=='follow'||arrivalView||/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName))return;
  event.preventDefault();paddleKeys.add(event.code);
 });
 document.addEventListener('keyup',event=>paddleKeys.delete(event.code));
}
window.addEventListener('blur',()=>{paddleKeys.clear();race.setSteering(-1,0);});
document.addEventListener('visibilitychange',()=>{paddleKeys.clear();voice?.visibility(document.hidden);race.setSteering(-1,0);});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(race.state==='racing'||race.state==='countdown')race.pause();console.warn('[render] WebGL context lost');showModal('error',`<h2>${t('paused')}</h2><p>${t('webgl')}</p>`)});renderer.domElement.addEventListener('webglcontextrestored',()=>{console.info('[render] WebGL context restored');closeModal()});
document.addEventListener('visibilitychange',()=>{void audio.visibility(!document.hidden);if(document.hidden&&(race.state==='racing'||race.state==='countdown')){race.pause();pausedByVisibility=true;}else if(!document.hidden&&pausedByVisibility){pausedByVisibility=false;updateUI();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalKind)closeModal();if(e.key==='Tab'&&modalKind){const focusable=Array.from(document.querySelectorAll<HTMLElement>('.modal button:not(:disabled),.modal select:not(:disabled),.modal textarea:not(:disabled)'));if(e.shiftKey&&document.activeElement===focusable[0]){e.preventDefault();focusable.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===focusable.at(-1)){e.preventDefault();focusable[0]?.focus()}}if(e.code==='Space'&&!modalKind&&!mobileDrawer.isOpen&&e.target===document.body){e.preventDefault();if(race.state==='ready')beginDraw();else race.pause();}});
const reduceCameraMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let last=performance.now(),accumulator=0,elapsed=0;const followTarget=new THREE.Vector3(),cameraAim=new THREE.Vector3(),followPosition=new THREE.Vector3();
function tick(now:number){
 const delta=Math.min((now-last)/1000,.1);last=now;elapsed+=delta;accumulator+=delta;
 const keyboardAxis=MANUAL_MODE?Number(paddleKeys.has('KeyD')||paddleKeys.has('ArrowRight'))-Number(paddleKeys.has('KeyA')||paddleKeys.has('ArrowLeft')):0;
 if(voiceSteering&&now>=voiceSteering.until)voiceSteering=null;
 const spoken=MANUAL_MODE&&voiceSteering&&race.state==='racing'?voiceSteering:null;
 race.setSteering(keyboardAxis&&mode==='follow'&&!modalKind&&!mobileDrawer.isOpen&&!arrivalView?selected:spoken?.duck??-1,keyboardAxis&&mode==='follow'&&!modalKind&&!mobileDrawer.isOpen&&!arrivalView?keyboardAxis:spoken?.direction??0);
 while(accumulator>=1/60){race.step(1/60);accumulator-=1/60;}
 feedback.update(race);worldView.update(elapsed,race,feedback.hits);
 const presentation=finishPresentation.update(race,delta,!document.hidden&&!modalKind,TRACK_LENGTH+6);
 if(presentation.started){
  if(!(import.meta.env.DEV&&new URLSearchParams(location.search).has('inspect')))saveRace();
  trackEvent('race_finished',{language:lang,course:currentTrack,entryCount:race.results.length,durationMs:Math.round(race.time*1000),manual:MANUAL_MODE&&race.controlled});
  arrivalView=true;controls.enabled=false;
  console.info('[presentation] lake arrival started',{delaySeconds:9});
 }
 if(mode==='follow'&&!arrivalView){
  const d=race.ducks[selected],p=world(d.s,d.lane),dir=sample(d.s);followTarget.set(p.x,d.y+1,p.z);
  // Preview the drop/obstacle before reaching it, while visibility still targets the actual duck.
  const drop=FALLS.find(f=>d.s>f.lip-12&&d.s<f.impact),obstacle=obstacles.find(o=>o.kind!=='fan'&&d.s>o.s-10&&d.s<o.s+3);
  const anticipation=drop?Math.max(0,Math.min(1,(d.s-drop.lip+12)/9)):obstacle?.4:0;
  cameraAim.copy(followTarget);cameraAim.x+=dir.tx*anticipation*2;cameraAim.z+=dir.tz*anticipation*2;
  controls.target.lerp(cameraAim,1-Math.exp(-delta*4));
  followCamera.update(camera,followTarget,dir.tx,dir.tz,delta,worldView.clearCameraView,anticipation*1.2,(x,z)=>worldView.height(x,z),d.v);
  const ahead=sample(d.s+5+Math.min(5,d.v*.2));cameraAim.set(ahead.x,ahead.y+1.3+(d.airborne?Math.max(0,d.y-dir.y)*.4:0),ahead.z);controls.target.lerp(cameraAim,1-Math.exp(-delta*10));
  const targetFov=59+Math.min(1.6,d.v/20)*7+(d.airborne?3:0);camera.fov=THREE.MathUtils.damp(camera.fov,targetFov,4,delta);camera.updateProjectionMatrix();
  stableLookAt(camera,controls.target,delta,6);
  if(!reduceCameraMotion){const impact=[...race.events].reverse().find(e=>e.duck===selected&&e.kind!=='takeoff'&&race.time-e.time<.4);if(impact){const age=race.time-impact.time,amount=Math.min(.3,impact.strength*.025)*Math.exp(-age*10);camera.position.x+=Math.sin(age*61)*amount;camera.position.y+=Math.sin(age*47)*amount*.6;}}

 }else if(arrivalView){
  const end=sample(TRACK_LENGTH);followTarget.set(0,0,0);
  for(const d of race.ducks){const p=world(d.s,d.lane);followTarget.add(new THREE.Vector3(p.x,d.y+1,p.z));}
  followTarget.multiplyScalar(1/race.ducks.length);
  let spread=0;for(const d of race.ducks){const p=world(d.s,d.lane);spread=Math.max(spread,Math.hypot(p.x-followTarget.x,p.z-followTarget.z));}
  const distance=Math.max(30,spread*2.4);
  followPosition.set(followTarget.x+end.tx*distance-end.tz*distance*.6,followTarget.y+distance*.8,followTarget.z+end.tz*distance+end.tx*distance*.6);
  followCamera.moveTo(camera,followPosition,delta);controls.target.lerp(followTarget,1-Math.exp(-delta*2));stableLookAt(camera,controls.target,delta);
 }else controls.update();
 renderer.render(worldView.scene,camera);nameBubbles.update(camera,worldView.duckMeshes.map((m,id)=>({id,position:m.position})),renderer.domElement.clientWidth,renderer.domElement.clientHeight);audio.update(camera,race,!document.hidden&&!modalKind);
 if(now-lastUI>120){updateUI();voiceUI();lastUI=now;}
 if(presentation.reveal&&!modalKind){showResults();}
 requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
console.info('[app] ready',{renderer:renderer.capabilities.isWebGL2?'WebGL2':'WebGL',trackLength:TRACK_LENGTH,course:MOUNTAIN_COURSE?'mountain':'long',trackSeed:TRACK_SEED,manualMode:MANUAL_MODE,controlled:race.controlled});
trackEvent('game_ready',{language:lang,renderer:renderer.capabilities.isWebGL2?'WebGL2':'WebGL',course:currentTrack,sinceNavigationMs:Math.round(performance.now())});
// Read-only diagnostics for automated acceptance and future observability integrations.
Object.defineProperty(window,'__DUCK_RUSH__',{get:()=>({state:race.state,time:race.time,course:MOUNTAIN_COURSE?'mountain':'long',trackSeed:TRACK_SEED,manualMode:MANUAL_MODE,controlled:race.controlled,trackLength:TRACK_LENGTH,drawId:activeDraw?.id,entryCount:participants.length,count:race.ducks.length,seed:race.seed,results:race.results.map(d=>({id:d.id,time:d.finish})),camera:mode,selected,voiceLogs:voiceLogs?.entries??[],cameraDistance:camera.position.distanceTo(controls.target),cameraAvoided:followCamera.avoided,cameraClear:followCamera.clear,cameraStep:followCamera.lastStep,cameraRouteChanges:followCamera.routeChanges,arrivalView,arrivalSeconds:finishPresentation.age,resultsShown:finishPresentation.shown,audio:audio.diagnostics,audience:worldView.audienceState,effects:worldView.effects.diagnostics,feedback:feedback.notices,physics:race.ducks.map(d=>({id:d.id,s:d.s,x:world(d.s,d.lane).x,z:world(d.s,d.lane).z,y:d.y,airborne:d.airborne,pitch:d.pitch,roll:d.roll,yaw:d.yaw,landings:d.landings,hits:d.hits,entrySpeed:d.entrySpeed})),generatedAssets:{ready:worldView.generatedReady,coreReady:worldView.generatedAssets.has('duck')&&!worldView.generatedAssets.diagnostics.attachmentFailed.includes('duck'),stage:worldView.generatedStage,...worldView.generatedAssets.diagnostics},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles})});
