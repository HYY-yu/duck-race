import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchVoiceDirection,parseVoiceDirection,VoiceControl} from '../src/voice-control';

test('recognizes concise Chinese left and right commands',()=>{
 for(const phrase of ['左','向左','往左','左边','请往左面一点','朝左手边'])assert.equal(parseVoiceDirection([phrase]),-1,phrase);
 for(const phrase of ['右','向右','往右','右边','请往右侧一点','朝右手边'])assert.equal(parseVoiceDirection([phrase]),1,phrase);
});

test('normalizes punctuation, width and English commands',()=>{
 assert.equal(parseVoiceDirection(['往 左！']),-1);
 assert.equal(parseVoiceDirection(['please turn right']),1);
});

test('checks lower recognition alternatives and rejects ambiguous directions',()=>{
 assert.equal(parseVoiceDirection(['王座','往左']),-1);
 assert.equal(parseVoiceDirection(['左右都可以']),null);
 assert.equal(parseVoiceDirection(['向左还是向右']),null);
 assert.equal(parseVoiceDirection(['快一点']),null);
});

test('corrects only complete misrecognitions observed in Chinese voice logs',()=>{
 for(const phrase of ['王者','王者王','王座'])assert.deepEqual(matchVoiceDirection([phrase]),{direction:-1,source:'correction',candidate:0},phrase);
 assert.deepEqual(matchVoiceDirection(['我要']),{direction:1,source:'correction',candidate:0});
 assert.equal(matchVoiceDirection(['王']),null);assert.equal(matchVoiceDirection(['我']),null);
 assert.deepEqual(matchVoiceDirection(['我要','向右转']),{direction:1,source:'direct',candidate:1});
});

test('voice control forwards a complete interim transcript without waiting for final',()=>{
 class FakeRecognition {
  static latest:FakeRecognition;continuous=false;interimResults=false;lang='';maxAlternatives=1;
  onstart=(_event:Event)=>{};onend=(_event:Event)=>{};onerror=(_event:{error:string})=>{};onresult=(_event:unknown)=>{};
  constructor(){FakeRecognition.latest=this;}
  start(){this.onstart({} as Event);}stop(){}
  emit(transcripts:string[],isFinal:boolean){const alternatives=Object.assign(transcripts.map(transcript=>({transcript})),{isFinal,length:transcripts.length});this.onresult({resultIndex:0,results:Object.assign([alternatives],{length:1})});}
 }
 const heard:{transcripts:readonly string[];isFinal:boolean}[]=[],statuses:string[]=[];
 const voice=new VoiceControl((transcripts,isFinal)=>heard.push({transcripts,isFinal}),status=>statuses.push(status),FakeRecognition);
 voice.start();FakeRecognition.latest.emit(['王座','往左'],false);
 assert.equal(FakeRecognition.latest.interimResults,true);assert.equal(FakeRecognition.latest.continuous,false);
 assert.equal(FakeRecognition.latest.maxAlternatives,5);
 assert.deepEqual(heard,[{transcripts:['王座','往左'],isFinal:false}]);assert.deepEqual(statuses,['starting','listening']);
});
