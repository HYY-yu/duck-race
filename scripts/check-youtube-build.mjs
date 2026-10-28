import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const output=resolve('dist-youtube');
const html=await readFile(resolve(output,'index.html'),'utf8');
assert.match(html,/<script src="https:\/\/www.youtube.com\/game_api\/v1"><\/script>/);
assert.ok(html.indexOf('game_api/v1')<html.indexOf('type="module"'),'SDK must load before game code');
assert.doesNotMatch(html,/canonical|application\/ld\+json|<input|<textarea/i);
for(const path of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match=>match[1])){
 if(path==='https://www.youtube.com/game_api/v1')continue;
 assert.ok(path.startsWith('./'),'Bundled references must be relative');
 await readFile(resolve(output,path));
}
const files=await readdir(output);assert.deepEqual(files.sort(),['assets','index.html','models']);
const js=(await Promise.all((await readdir(resolve(output,'assets'))).filter(name=>name.endsWith('.js')).map(name=>readFile(resolve(output,'assets',name),'utf8')))).join('\n');
assert.doesNotMatch(js,/posthog|SpeechRecognition|webkitSpeechRecognition|getUserMedia|localStorage|navigator\.clipboard|duck-rush-history/i);
for(const name of ['duck','tree-broadleaf','tree-pine','bird','scarf'])await readFile(resolve(output,`models/${name}.glb`));
console.info('[youtube-build] isolated entry, SDK order, relative assets and excluded website capabilities verified');
