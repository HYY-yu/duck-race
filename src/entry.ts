import './style.css';
import {pageLanguage} from './i18n-routing';
import {observeWebVitals, trackEvent} from './observability';
import {resolveTrack,trackSearch} from './track-navigation';

const language = pageLanguage();
const params = new URLSearchParams(location.search);
const course = resolveTrack(params.get('track'));
if(params.get('track')==='standard'){
  history.replaceState(null,'',`${location.pathname}${trackSearch(location.search,'long')}${location.hash}`);
  console.info('[navigation] retired course mapped',{from:'standard',to:course});
}
trackEvent('page_view', {language, course});
observeWebVitals(language);

let loading: Promise<unknown> | null = null;
function loadGame(reason: 'viewport' | 'interaction') {
  if (loading) return loading;
  document.querySelector('#app')?.classList.add('game-loading');
  trackEvent('game_load_started', {language, reason, sinceNavigationMs:Math.round(performance.now())});
  loading = import('./main').catch(error => {
    document.querySelector('#app')?.classList.remove('game-loading');
    console.error('[app] game module failed to load', error);
    const status = document.querySelector<HTMLElement>('[data-game-load-status]');
    if (status) status.textContent = language === 'zh' ? '3D 游戏加载失败。下方玩法与隐私说明仍可阅读。' : 'The 3D game failed to load. The guide and privacy information below are still available.';
  });
  return loading;
}

document.querySelector('[data-load-game]')?.addEventListener('click', () => void loadGame('interaction'));
const app = document.querySelector('#app');
if (app && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      requestAnimationFrame(() => void loadGame('viewport'));
    }
  }, {rootMargin: '160px'});
  observer.observe(app);
} else {
  requestAnimationFrame(() => void loadGame('viewport'));
}
