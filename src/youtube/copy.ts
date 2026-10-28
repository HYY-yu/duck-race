import {COLORS,COLOR_NAMES} from '../duck-palette';
export type Language='en'|'zh';
export const copy={
 en:{choose:'Choose your duck',hint:'Pick a color and number. Hold left or right to steer through the rapids.',start:'Start race',pause:'Pause',resume:'Resume',again:'Race again',left:'Steer left',right:'Steer right',keys:'A / D or ← / → · Hold to steer',you:'Your duck',ready:'Ready to race',racing:'Race in progress',paused:'Paused',finished:'Race complete',results:'Finishing order',waiting:'Your duck has finished. Watch the others!',position:'Place',overview:'Overview',follow:'Follow',sound:'Sound',error:'The 3D scene could not start. Please reload the game.',context:'Graphics interrupted. Reload the game to continue.',language:'Language'},
 zh:{choose:'选择你的小鸭',hint:'按颜色和编号选鸭，按住左右按钮，在激流中转向。',start:'开始比赛',pause:'暂停',resume:'继续',again:'再来一场',left:'向左转向',right:'向右转向',keys:'A / D 或 ← / → · 按住转向',you:'你的小鸭',ready:'准备就绪',racing:'比赛进行中',paused:'已暂停',finished:'比赛结束',results:'冲线排名',waiting:'你的小鸭已冲线，继续观看其他小鸭！',position:'名次',overview:'全局',follow:'跟随',sound:'预览音效',error:'3D 场景启动失败，请重新加载游戏。',context:'图形渲染已中断，请重新加载游戏。',language:'语言'},
};
export function duckLabel(id:number,language:Language){return `${String(id+1).padStart(2,'0')} · ${COLOR_NAMES[language][id]}`;}
export const DUCK_COLORS=COLORS;
export const touchHint={en:'Hold ← / → to steer',zh:'按住左右按钮转向'};
