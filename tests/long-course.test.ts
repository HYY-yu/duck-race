import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('long course doubles length, clears scenery, and completes real races through new props',()=>{
 const out=execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./long-course.fixture.ts',import.meta.url))],{env:{...process.env,DUCK_TRACK:'long'},encoding:'utf8',timeout:60000});
 const result=JSON.parse(out.trim());assert.equal(result.runs.length,9);assert.ok(result.ratio>=2);
});
