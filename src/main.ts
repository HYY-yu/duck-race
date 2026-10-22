import './style.css';
import { VERSION, getStandings } from './simulation';
import { COUNT, COURSE_LENGTH, FINISH_S, START_S, SECTIONS, sampleCourse, sampleSurface, channelAt, sampleChannel, RIVER_REACHES, flowAt } from './course';
import { RaceController, type RaceSignal } from './race';
import { RaceInsights } from './race-insights';
import { createRaceScene, DUCK_COLORS } from './scene';

// Visual thesis: a sculpted mountain valley, layered rock and lively turquoise tributaries.
// Content: the course is the workspace; five follow targets and one race control.
// Interaction: split currents, visible cascades and a widening chase camera explain each change of position.
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" aria-label="Duck Circuit"><svg viewBox="0 0 40 36" aria-hidden="true"><path d="M5 21c4 0 6-1 8-5 1-2 2-3 5-3 0-6 3-9 8-9 5 0 8 4 8 8l5 3-7 3c1 10-6 15-15 15C8 33 3 28 5 21Z" fill="currentColor"/><circle cx="28" cy="10" r="1.4" fill="#f6f5ed"/></svg><span>DUCK<span class="brand-light">CIRCUIT</span></span><sup>03</sup></a>
    <span id="header-caption"></span><button id="language" class="quiet">EN</button>
  </header>
  <main class="workspace">
    <section class="course" aria-label="3D race course">
      <div id="canvas"></div>
      <div class="course-heading"><div><p class="eyebrow" id="course-kicker"></p><h1 id="course-title"></h1><p id="course-description"></p></div><button id="view-mode" class="glass-button"></button></div>
      <div class="race-status"><span id="status"></span><span id="clock">00:00.0</span></div>
      <div id="countdown-overlay" class="countdown-overlay" role="status" aria-live="polite" hidden><div class="starting-lights">${Array.from({length: 5}, () => '<i></i>').join('')}</div><strong id="countdown-number"></strong><span id="countdown-caption"></span></div>
      <div id="winner" class="winner" role="status" hidden><span id="winner-label"></span><strong id="winner-name"></strong><span id="winner-time"></span></div>
      <div class="map-inset"><div class="map-label"><span id="map-label"></span><span>↓</span></div><svg id="minimap" viewBox="0 0 100 174" role="img"><path id="map-bed"/><path id="map-line"/><g id="map-ducks"></g></svg></div>
      <button id="waterfall-view" class="waterfall-view"></button><div class="camera-dock"><button id="previous-duck" class="camera-arrow">←</button><div><span id="follow-label"></span><strong id="follow-name"></strong></div><button id="next-duck" class="camera-arrow">→</button><span class="keyboard-hint">1 – 5</span></div>
      <div id="race-moment" class="race-moment" role="status" aria-live="polite" hidden><span id="moment-label"></span><strong id="moment-text"></strong></div>
      <div id="error" role="alert" hidden></div>
    </section>
    <aside class="race-panel">
      <div class="panel-heading"><span class="eyebrow" id="panel-kicker"></span><span class="entry-count">05</span></div>
      <h2 id="rank-title"></h2><p id="rank-hint" class="muted"></p>
      <ol id="ranking"></ol>
      <div class="race-controls"><button id="start" class="primary"></button><button id="reset" class="secondary"></button></div>
      <details id="setup"><summary id="setup-title"></summary><label for="names" id="names-label"></label><textarea id="names" rows="5" spellcheck="false" maxlength="400"></textarea><div class="seed-line"><label for="seed" id="seed-label"></label><input id="seed" type="number" min="1" max="4294967295" step="1" value="42"/></div></details>
      <div class="river-info"><span class="eyebrow" id="section-label"></span><h3 id="section-name"></h3><p id="section-description"></p><div class="river-measure"><span id="flow-label"></span><strong id="flow-value"></strong></div><div class="river-measure"><span id="drop-label"></span><strong id="drop-value"></strong></div><div class="river-measure"><span id="route-label"></span><strong id="route-value"></strong></div><div class="river-measure"><span id="passes-label"></span><strong id="passes-value">0</strong></div><div class="course-progress"><i id="progress-bar"></i></div><div class="progress-meta"><span id="progress-label"></span><span id="progress-value"></span></div></div>
      <p id="note" class="panel-note"></p>
    </aside>
  </main>
  <footer><span id="footer-caption"></span><span id="finished"></span></footer>`;

type Language = 'zh' | 'en';
let language: Language = 'zh';
const words = {
  zh: {
    header: '山谷分流 · 逐浪竞速', kicker: '02 / THE HIGHLANDS', title: '叠瀑山谷', description: '分流选线，汇流争先。',
    rosterKicker: 'THE PADDOCK', roster: '五位漂流选手', rankHint: '点击选手，切换跟随视角',
    start: '开始比赛', pause: '暂停比赛', resume: '继续比赛', again: '再赛一场', reset: '↺  重置比赛',
    setup: '参赛设置', names: '每行一个名字，最多 5 位', seed: '起跑种子',
    ready: '等待发令', countdown: '起跑倒计时', running: '比赛进行中', paused: '比赛已暂停', done: '全部抵达',
    overview: '全景赛道', follow: '跟随视角', overviewAction: '↗  全景赛道', followAction: '◎  跟随鸭子',
    following: '正在跟随', previous: '跟随上一只鸭子', next: '跟随下一只鸭子', map: '河道全图',
    section: '当前河段', flow: '水流速度', drop: '剩余落差', progress: '赛道进度',
    note: '不同的水路，相遇时重新争先。', footer: '双汊河网 / 山谷叠瀑 / 摆锤 / 汇流争位',
    lights: '准备出发', go: '出发', winner: '率先抵达', complete: '已完赛',
    route: '当前水路', passes: '本场超越', main: '主河道', left: '左侧支流', right: '右侧支流', pass: '名次变化', split: '进入分流', merge: '重新汇流', position: '暂列第',
    namesDefault: ['小黄', '蜜桃', '薄荷', '蓝莓', '奶油'],
    sections: {
      launch: ['山顶起跑池', '五盏灯熄灭，闸门开启，水流带着选手进入弯道。'],
      bends: ['回旋弯道', '连续弯道改变流向，内外侧水流与碰撞拉开距离。'],
      cascade: ['源头叠瀑', '落差让水流迅速加快，越过坡脚后进入平缓的分水池。'],
      fork_one: ['杉林双汊', '水流绕过杉林山岛，左侧更早下降，右侧保留后段冲刺。'],
      fork_two: ['双层汇流', '两条不同高程的支流绕岛而下，在出口争夺主河道。'],
      cascade_two: ['峡谷长瀑', '长坡急流穿过岩层，冲出浪花后迎接最后的高低闸杆。'],
      pendulums: ['大摆锤河湾', '摆锤横扫水面，把握水流与摆动之间的通行空隙。'],
      chute: ['深窄急流', '河道收窄、河床加深，较小过水截面形成高速水流。'],
      gates: ['高低闸杆', '交错升降的横杆截住水面，等待空隙，再顺流而下。'],
      finish: ['下游终点池', '经过最后一道弯，穿过棋盘终点线。'],
    },
    error: '无法启动 3D 场景，请使用支持 WebGL 的浏览器。', context: '图形上下文丢失，请刷新页面恢复。',
    renderError: '场景运行发生错误，比赛已停止，请刷新页面。', timeout: '比赛超时，已暂停。请重置后重试。',
  },
  en: {
    header: 'FORKING RIVERS · RACING CURRENTS', kicker: '02 / THE HIGHLANDS', title: 'Cascade Highlands', description: 'Separate paths. A race to rejoin.',
    rosterKicker: 'THE PADDOCK', roster: 'Meet the five', rankHint: 'Select a racer to follow their run',
    start: 'Start race', pause: 'Pause race', resume: 'Resume race', again: 'Race again', reset: '↺  Reset race',
    setup: 'Race setup', names: 'One name per line, up to 5 racers', seed: 'Starting seed',
    ready: 'ON THE GRID', countdown: 'LIGHTS ON', running: 'RACE IN PROGRESS', paused: 'RACE PAUSED', done: 'RACE COMPLETE',
    overview: 'Course overview', follow: 'Follow camera', overviewAction: '↗  Course overview', followAction: '◎  Follow duck',
    following: 'FOLLOWING', previous: 'Follow previous duck', next: 'Follow next duck', map: 'RIVER MAP',
    section: 'ON THIS STRETCH', flow: 'Current speed', drop: 'Drop remaining', progress: 'Course progress',
    note: 'Different currents. New rivals at every confluence.', footer: 'TWIN FORKS / MOUNTAIN CASCADES / PENDULUMS / CONFLUENCE',
    lights: 'ON YOUR MARKS', go: 'GO', winner: 'FIRST TO THE FINISH', complete: 'finished',
    route: 'Current route', passes: 'Passes this race', main: 'Main river', left: 'Left tributary', right: 'Right tributary', pass: 'POSITION CHANGE', split: 'TAKING THE FORK', merge: 'CURRENTS REJOIN', position: 'Now in',
    namesDefault: ['Sunny', 'Peach', 'Mint', 'Berry', 'Cream'],
    sections: {
      launch: ['The headwaters', 'Lights out, gate up. The current carries all five into the first bend.'],
      bends: ['Winding bends', 'Changing currents and contact create different lines through the bends.'],
      cascade: ['Headwater cascades', 'A steep drop gathers speed before the river opens into the first fork.'],
      fork_one: ['Cedar island fork', 'Split around the wooded island. One side descends early; the other gains speed later.'],
      fork_two: ['Terraced confluence', 'Tributaries at different elevations circle the island, then race to rejoin.'],
      cascade_two: ['Canyon plunge', 'A long rapid cuts through the rock before the final lift gates.'],
      pendulums: ['Pendulum reach', 'Giant pendulums sweep the water. Drift through the opening.'],
      chute: ['The deep narrows', 'A narrower, deeper channel reduces the flow area and speeds up the current.'],
      gates: ['High & low gates', 'Alternating lift bars hold racers at the surface until a gap opens.'],
      finish: ['The finish pool', 'Around the last bend and through the chequered finish line.'],
    },
    error: 'Could not start 3D. Use a browser with WebGL support.', context: 'Graphics context lost. Refresh the page to recover.',
    renderError: 'The scene encountered an error. Refresh the page to recover.', timeout: 'The race timed out and paused. Reset to retry.',
  },
};

const race = new RaceController(42);
const insights = new RaceInsights();
type Moment = {type: 'pass' | 'split' | 'merge'; id: number; position?: number; route?: 'main' | 'left' | 'right'; until: number};
let moment: Moment | null = null;
let waterfallPreview = new URLSearchParams(location.search).has('waterfall');
let followId = 0, overview = true, customNames: string[] = [], errorKey: 'error' | 'context' | 'renderError' | 'timeout' | null = null;
let fatal = false, raceId = crypto.randomUUID(), scene: ReturnType<typeof createRaceScene> | undefined;
const debug = new URLSearchParams(location.search).has('debug');
const lifecycle = new AbortController();
const color = (id: number) => `#${DUCK_COLORS[id].toString(16).padStart(6, '0')}`;
const displayName = (id: number) => customNames[id] || words[language].namesDefault[id];
function log(level: 'debug' | 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
  if (level === 'debug' && !debug) return;
  console[level]('[duck-circuit]', event, { race_id: raceId, version: VERSION, seed: race.seed, time: Math.round(race.time * 100) / 100, ...data });
}
// TODO(observability): connect race spans, contact counters, frame-time histograms and timeout rates to a telemetry adapter; never include roster names.
function signals(items: RaceSignal[]) {
  for (const item of items) {
    log(item.type === 'timeout' ? 'warn' : 'info', `race_${item.type}`, item.type === 'complete' ? { contacts: race.ducks.reduce((sum, duck) => sum + duck.contacts, 0), duration: race.time } : {});
    if (item.type === 'timeout') errorKey = 'timeout';
  }
}
function selectDuck(id: number) {
  if (id < 0 || id >= COUNT) return;
  followId = id; overview = false; waterfallPreview = false;
  log('debug', 'camera_follow', { id }); updateUI();
}

// Reuse rows so periodic standings updates preserve keyboard focus.
const rows = race.ducks.map(duck => {
  const li = document.createElement('li');
  const button = document.createElement('button'); button.className = 'racer';
  button.innerHTML = `<span class="position"></span><span class="duck-avatar" style="--duck-color:${color(duck.id)}"><svg viewBox="0 0 40 36" aria-hidden="true"><path d="M5 21c4 0 6-1 8-5 1-2 2-3 5-3 0-6 3-9 8-9 5 0 8 4 8 8l5 3-7 3c1 10-6 15-15 15C8 33 3 28 5 21Z"/><circle cx="28" cy="10" r="1.4"/></svg></span><span class="racer-copy"><span class="racer-name"></span><span class="racer-state"></span></span><span class="racer-result"></span><span class="racer-progress"></span>`;
  button.onclick = () => selectDuck(duck.id); li.append(button); $('ranking').append(li);
  return { li, button, position: button.querySelector<HTMLElement>('.position')!, name: button.querySelector<HTMLElement>('.racer-name')!, status: button.querySelector<HTMLElement>('.racer-state')!, result: button.querySelector<HTMLElement>('.racer-result')!, progress: button.querySelector<HTMLElement>('.racer-progress')! };
});
const svgNS = 'http://www.w3.org/2000/svg';
// Draw each water route, including its lateral separation, in the same world projection.
const mapSamples = RIVER_REACHES.flatMap(reach => Array.from({length: 60}, (_, i) => {
  const s = reach.start + (reach.end - reach.start) * i / 59;
  const f = sampleCourse(s), channel = sampleChannel(s, reach.route), lateral = (channel.min + channel.max) / 2;
  return {x: f.x + f.nx * lateral, z: f.z + f.nz * lateral};
}));
const minX = Math.min(...mapSamples.map(p => p.x)), maxX = Math.max(...mapSamples.map(p => p.x));
const minZ = Math.min(...mapSamples.map(p => p.z)), maxZ = Math.max(...mapSamples.map(p => p.z));
const mapScale = Math.min(76 / (maxX - minX), 150 / (maxZ - minZ));
function mapPoint(s: number, lateral = 0) {
  const p = sampleCourse(s);
  return {x: 50 + (p.x + p.nx * lateral - (maxX + minX) / 2) * mapScale, y: 12 + (p.z + p.nz * lateral - minZ) * mapScale};
}
const mapPath = RIVER_REACHES.map(reach => Array.from({length: 60}, (_, i) => {
  const s = reach.start + (reach.end - reach.start) * i / 59, span = sampleChannel(s, reach.route);
  const lateral = reach.route !== 'main' && (i === 0 || i === 59) ? 0 : (span.min + span.max) / 2;
  const p = mapPoint(s, lateral);
  return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
}).join(' ')).join(' ');
$('map-bed').setAttribute('d', mapPath); $('map-line').setAttribute('d', mapPath);
const mapDots = race.ducks.map(d => {const circle = document.createElementNS(svgNS, 'circle'); circle.setAttribute('r', '3.2'); circle.setAttribute('fill', color(d.id)); $('map-ducks').append(circle); return circle;});

function translate() {
  const w = words[language]; document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = language === 'zh' ? 'Duck Circuit · 叠瀑山谷' : 'Duck Circuit · Cascade Highlands';
  $('canvas').querySelector('canvas')?.setAttribute('aria-label', language === 'zh' ? '3D 鸭子水流赛道' : '3D duck river circuit');
  const labels: Record<string, string> = {'header-caption': w.header, 'course-kicker': w.kicker, 'course-title': w.title, 'course-description': w.description, 'panel-kicker': w.rosterKicker, 'rank-title': w.roster, 'rank-hint': w.rankHint, 'setup-title': w.setup, 'names-label': w.names, 'seed-label': w.seed, 'reset': w.reset, 'map-label': w.map, 'section-label': w.section, 'flow-label': w.flow, 'drop-label': w.drop, 'route-label': w.route, 'passes-label': w.passes, 'progress-label': w.progress, 'note': w.note, 'footer-caption': w.footer, 'winner-label': w.winner};
  for (const [id, text] of Object.entries(labels)) $(id).textContent = text;
  $('language').textContent = language === 'zh' ? 'EN' : '中文';
  $('language').setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换中文');
  $('previous-duck').setAttribute('aria-label', w.previous); $('next-duck').setAttribute('aria-label', w.next);
  $('minimap').setAttribute('aria-label', w.map); document.querySelector('.course')!.setAttribute('aria-label', language === 'zh' ? '3D 水流赛道' : '3D river race course');
  $<HTMLTextAreaElement>('names').placeholder = w.namesDefault.join('\n'); updateUI();
}
function updateUI() {
  const w = words[language], phase = race.phase, standings = getStandings(race.ducks), selected = race.ducks[followId];
  $('status').textContent = w[phase]; $('status').dataset.phase = phase;
  const tenths = Math.round(race.time * 10);
  $('clock').textContent = `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
  $('start').textContent = phase === 'ready' ? `${w.start}  ↗` : phase === 'done' ? `${w.again}  ↗` : phase === 'paused' ? `${w.resume}  ▷` : `${w.pause}  Ⅱ`;
  $<HTMLButtonElement>('start').disabled = fatal || race.timedOut;
  $<HTMLTextAreaElement>('names').disabled = phase !== 'ready'; $<HTMLInputElement>('seed').disabled = phase !== 'ready';
  $('waterfall-view').textContent = language === 'zh' ? (waterfallPreview ? '返回赛道 ↗' : '瀑布近景 ↗') : (waterfallPreview ? 'Back to race ↗' : 'Waterfall close-up ↗');
  $('waterfall-view').setAttribute('aria-pressed',String(waterfallPreview));
  $('view-mode').textContent = overview ? w.followAction : w.overviewAction; $('view-mode').setAttribute('aria-pressed', String(overview));
  $('follow-label').textContent = waterfallPreview ? (language === 'zh' ? '瀑布近景' : 'Waterfall close-up') : overview ? w.overview : w.following; $('follow-name').textContent = displayName(followId);
  $('follow-name').style.setProperty('--follow-color', color(followId));
  standings.forEach((duck, i) => {
    const row = rows[duck.id]; row.li.style.order = String(i); row.position.textContent = String(i + 1).padStart(2, '0');
    row.name.textContent = displayName(duck.id); row.button.classList.toggle('selected', duck.id === followId);
    row.button.setAttribute('aria-pressed', String(duck.id === followId));
    row.button.setAttribute('aria-label', `${displayName(duck.id)} · ${w.follow}`);
    row.status.textContent = duck.finish !== null ? w.complete : duck.id === followId && !overview ? w.following : `#${String(duck.id + 1).padStart(2, '0')}`;
    row.result.textContent = duck.finish !== null ? `${duck.finish.toFixed(1)}s` : phase === 'ready' || phase === 'countdown' ? '—' : `${Math.max(0, Math.min(100, Math.floor((duck.s - START_S) / (FINISH_S - START_S) * 100)))}%`;
    row.progress.style.width = `${Math.max(0, Math.min(100, (duck.s - START_S) / (FINISH_S - START_S) * 100))}%`;
  });
  const section = SECTIONS.find(s => selected.s >= s.start && selected.s < s.end) ?? SECTIONS[SECTIONS.length - 1];
  const sectionText = w.sections[section.id as keyof typeof w.sections];
  $('section-name').textContent = sectionText[0]; $('section-description').textContent = sectionText[1];
  const frame = sampleSurface(selected.s, selected.lateral), finishFrame = sampleCourse(FINISH_S);
  $('flow-value').textContent = `${flowAt(selected.s, selected.lateral, race.time).forward.toFixed(1)} m/s`;
  $('drop-value').textContent = `${Math.max(0, frame.y - finishFrame.y).toFixed(1)} m`;
  const currentRoute = channelAt(selected.s, selected.lateral).route;
  $('route-value').textContent = w[currentRoute];
  $('passes-value').textContent = String(insights.passCount);
  $('race-moment').hidden = !moment || race.time > moment.until || phase === 'ready' || phase === 'countdown' || phase === 'done';
  if (moment) {
    $('moment-label').textContent = w[moment.type];
    $('moment-text').textContent = moment.type === 'pass' ? `${displayName(moment.id)} · ${w.position} ${moment.position}` : `${displayName(moment.id)} · ${w[moment.route ?? 'main']}`;
  }
  const progress = Math.max(0, Math.min(100, (selected.s - START_S) / (FINISH_S - START_S) * 100));
  $('progress-value').textContent = `${Math.floor(progress)}%`; $('progress-bar').style.width = `${progress}%`;
  const finished = race.ducks.filter(d => d.finish !== null).length;
  $('finished').textContent = `${String(finished).padStart(2, '0')} / 05 ${w.complete}`;
  const counting = phase === 'countdown', go = phase === 'running' && race.time < .8;
  $('countdown-overlay').hidden = !counting && !go; $('countdown-overlay').classList.toggle('go', go);
  const digit = counting ? String(Math.max(1, Math.ceil(race.countdown))) : w.go;
  if ($('countdown-number').textContent !== digit) $('countdown-number').textContent = digit;
  $('countdown-caption').textContent = w.lights;
  document.querySelectorAll<HTMLElement>('.starting-lights i').forEach((light, i) => light.classList.toggle('lit', counting && i < Math.ceil((3 - race.countdown) / 3 * 5)));
  $('winner').hidden = phase !== 'done';
  if (phase === 'done') { $('winner-name').textContent = displayName(standings[0].id); $('winner-time').textContent = `${standings[0].finish!.toFixed(2)} s`; }
  for (const duck of race.ducks) { const point = mapPoint(duck.s, duck.lateral); const dot = mapDots[duck.id]; dot.setAttribute('cx', String(point.x)); dot.setAttribute('cy', String(point.y)); dot.setAttribute('stroke-width', duck.id === followId ? '2' : '.8'); }
  $('error').hidden = errorKey === null; if (errorKey) $('error').textContent = w[errorKey];
}
function resetRace() {
  raceId = crypto.randomUUID(); insights.reset(); moment = null; signals(race.reset()); errorKey = fatal ? errorKey : null; overview = true; updateUI();
}
$('language').onclick = () => { language = language === 'zh' ? 'en' : 'zh'; translate(); };
$('start').onclick = () => {
  if (fatal || race.timedOut) return;
  if (race.phase === 'done') resetRace();
  if (race.phase === 'ready') {
    const rawSeed = Number($<HTMLInputElement>('seed').value);
    const seed = Number.isSafeInteger(rawSeed) && rawSeed >= 1 && rawSeed <= 4294967295 ? rawSeed : 42;
    if (seed !== rawSeed) log('warn', 'invalid_seed', { fallback: seed });
    $<HTMLInputElement>('seed').value = String(seed);
    customNames = $<HTMLTextAreaElement>('names').value.split('\n').map(name => name.trim().slice(0, 32)).filter(Boolean).slice(0, COUNT);
    $<HTMLDetailsElement>('setup').open = false; overview = false; signals(race.start(seed));
  } else signals(race.togglePause());
  updateUI();
};
$('reset').onclick = resetRace;
$('waterfall-view').onclick = () => { waterfallPreview = !waterfallPreview; log('debug', 'waterfall_preview', { active: waterfallPreview }); updateUI(); };
$('view-mode').onclick = () => { waterfallPreview = false; overview = !overview; log('debug', 'camera_mode', { overview }); updateUI(); };
$('previous-duck').onclick = () => selectDuck((followId + COUNT - 1) % COUNT);
$('next-duck').onclick = () => selectDuck((followId + 1) % COUNT);
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
  if (/^[1-5]$/.test(event.key)) selectDuck(Number(event.key) - 1);
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); selectDuck((followId + (event.key === 'ArrowLeft' ? COUNT - 1 : 1)) % COUNT); }
}, { signal: lifecycle.signal });
// Hidden tabs pause instead of silently fast-forwarding the competition.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (race.phase === 'running' || race.phase === 'countdown')) { signals(race.togglePause()); log('info', 'race_background_pause'); updateUI(); }
}, { signal: lifecycle.signal });
translate();
let animationId = 0;
function fail(kind: 'context-lost' | 'render-error' | 'initialization', error?: unknown) {
  fatal = true; if (race.phase === 'running' || race.phase === 'countdown') signals(race.togglePause());
  errorKey = kind === 'context-lost' ? 'context' : kind === 'initialization' ? 'error' : 'renderError';
  log('error', kind === 'context-lost' ? 'webgl_context_lost' : kind === 'initialization' ? 'scene_initialization_failed' : 'scene_render_failed', { message: error instanceof Error ? error.message : String(error ?? kind) });
  cancelAnimationFrame(animationId); updateUI();
}
try {
  scene = createRaceScene($('canvas'), { onSelect: selectDuck, onError: fail });
  let last = performance.now(), uiElapsed = 0, lastContactLog = -Infinity, frameSeconds = 0, frameCount = 0;
  const animate = (now: number) => {
    if (fatal) return;
    const wallDelta = Math.max(0, (now - last) / 1000);
    const delta = Math.min(wallDelta, .1); last = now;
    try {
      const result = race.advance(delta);
      for (const event of result.events) {
        if (event.type === 'takeoff' || event.type === 'splash') log('info', `duck_${event.type}`, { id: event.id, waterfall: event.obstacle, entry_speed: race.ducks[event.id].entrySpeed });
        else if (event.type === 'finish') log('info', 'duck_finish', { id: event.id, finish: event.time });
        else if (event.type === 'split' || event.type === 'merge') {
          log('info', `river_${event.type}`, { id: event.id, junction: event.obstacle, route: event.route });
          if (event.id === followId) moment = {type: event.type, id: event.id, route: event.route, until: race.time + 3.2};
        }
        else if (now - lastContactLog > 500) { log('debug', 'obstacle_contact', { id: event.id, obstacle: event.obstacle }); lastContactLog = now; }
      }
      // Record the final crossing before announcing race completion.
      signals(result.signals);
      scene!.update(race.ducks, race.time, delta, { followId, overview, phase: race.phase, countdown: race.countdown, waterfallPreview });
      uiElapsed += delta; if (uiElapsed >= .1 || result.signals.length) {
        const passes = insights.update(getStandings(race.ducks), race.time);
        for (const pass of passes) log('debug', 'position_change', { id: pass.id, passed: pass.passed, position: pass.position });
        const followedPass = passes.find(pass => pass.id === followId);
        if (followedPass && (!moment || race.time > moment.until)) moment = {type: 'pass', id: followedPass.id, position: followedPass.position, until: race.time + 2.6};
        updateUI(); uiElapsed = 0;
      }
      // Performance samples use real wall time, independent of capped simulation time.
      if (document.hidden) { frameSeconds = 0; frameCount = 0; }
      else { frameSeconds += wallDelta; frameCount++; }
      if (frameSeconds >= 10) {
        log('debug', 'frame_sample', {
          fps: Math.round(frameCount / frameSeconds), ...scene?.stats(),
          // TODO(metrics): sample angular speed with the render span when telemetry is connected.
          drift: race.ducks.map(d => ({ id: d.id, heading_deg: Math.round(d.heading * 180 / Math.PI), spin_rad_s: Number(d.angularVelocity.toFixed(2)) })),
        });
        frameSeconds = 0; frameCount = 0;
      }
      animationId = requestAnimationFrame(animate);
    } catch (error) { fail('render-error', error); }
  };
  translate();
  animationId = requestAnimationFrame(animate); log('info', 'scene_ready', { duckCount: COUNT, courseLength: Math.round(COURSE_LENGTH), motionModel: 'passive-angular-buoyancy-ballistic', buoyancyProbes: 4, waterfallPrototype: 'headwater-drop' });
} catch (error) { fail('initialization', error); }
if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(animationId); lifecycle.abort(); scene?.dispose(); });
