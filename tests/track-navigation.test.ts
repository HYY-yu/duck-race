import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackSearch} from '../src/track-navigation';

test('track switching supports every course and preserves unrelated query parameters',()=>{
 assert.equal(trackSearch('?track=long&seed=917','standard'),'?track=standard&seed=917');
 assert.equal(trackSearch('?track=standard&seed=917','long'),'?track=long&seed=917');
 assert.equal(trackSearch('?seed=917','mountain'),'?seed=917&track=mountain');
});
