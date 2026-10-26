import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectionEntry} from '../src/inspection-navigation';

test('checkpoint entry is consumed once; refreshing the resulting URL is normal startup',()=>{
 const entry=inspectionEntry('http://localhost:5183/zh/?track=mountain&seed=42&inspect=wheel')!;
 assert.equal(entry.inspection,'wheel');assert.equal(entry.url,'/zh/?track=mountain&seed=42');
 assert.equal(inspectionEntry(new URL(entry.url,'http://localhost:5183').href),null);
});
test('consuming a checkpoint retains language, course, seed, campaign attribution and hash',()=>{
 const entry=inspectionEntry('http://localhost:5183/en/?track=long&seed=917&utm_source=x&utm_campaign=launch&inspect=pendulum#race')!;
 assert.equal(entry.inspection,'pendulum');assert.equal(entry.url,'/en/?track=long&seed=917&utm_source=x&utm_campaign=launch#race');
});
test('all duplicate inspection values are removed and unrelated links are untouched',()=>{
 assert.deepEqual(inspectionEntry('http://localhost/zh/?inspect=wheel&inspect=landing'),{inspection:'wheel',url:'/zh/'});
 assert.equal(inspectionEntry('http://localhost/en/?seed=42'),null);
});
