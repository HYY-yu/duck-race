export interface PlayablesSDK {
 IN_PLAYABLES_ENV:boolean;
 game:{firstFrameReady():void;gameReady():void};
 system:{getLanguage():Promise<string>;isAudioEnabled():boolean;onAudioEnabledChange(fn:(enabled:boolean)=>void):unknown;onPause(fn:()=>void):unknown;onResume(fn:()=>void):unknown};
 health:{logError():void;logWarning():void};
}
declare global {interface Window {ytgame?:PlayablesSDK}}

/** Local browser previews work without impersonating the YouTube environment. */
export function playablesSDK(){return window.ytgame?.IN_PLAYABLES_ENV?window.ytgame:null;}
export function reportError(error:unknown){console.error('[youtube] game error',error);window.ytgame?.health.logError();}
