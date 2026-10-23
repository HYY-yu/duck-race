import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courseLabel,resolveTrack,trackSearch} from '../src/track-navigation';

test('track switching supports every course and preserves unrelated query parameters',()=>{
 assert.equal(trackSearch('?track=long&seed=917','mountain'),'?track=mountain&seed=917');
 assert.equal(trackSearch('?track=standard&seed=917','long'),'?track=long&seed=917');
 assert.equal(trackSearch('?seed=917','mountain'),'?seed=917&track=mountain');
});

test('only the two active courses can be selected and retired links map to the valley',()=>{
 assert.equal(resolveTrack('long'),'long');assert.equal(resolveTrack('mountain'),'mountain');
 assert.equal(resolveTrack('standard'),'long');assert.equal(resolveTrack(null),'mountain');assert.equal(resolveTrack('invalid'),'mountain');
 assert.equal(courseLabel('long','zh'),'松风山谷');assert.equal(courseLabel('long','en'),'Pinewood Valley');
 assert.equal(courseLabel('standard','zh'),'标准赛道（已下线）');
});
