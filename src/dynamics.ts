import {FALLS,sample,width} from './track';
import {waterWave} from './water-wave';
export const GRAVITY=9.81;
export const FLOAT_OFFSET=-.19;
export interface Motion {
 y:number;vy:number;pitch:number;pitchV:number;roll:number;rollV:number;yaw:number;yawV:number;
 airborne:boolean;lastFall:number;landings:number;lastLanding:number;entrySpeed:number;
}
export interface Body extends Motion {s:number;lane:number;v:number;lv:number;}
export function waterline(s:number,lane:number,time:number){return sample(s).y+FLOAT_OFFSET+waterWave(s,lane,width(s)-Math.abs(lane),time);}
export function createMotion(s:number,lane:number):Motion{return {y:waterline(s,lane,0),vy:0,pitch:0,pitchV:0,roll:0,rollV:0,yaw:0,yawV:0,airborne:false,lastFall:-1,landings:0,lastLanding:-1,entrySpeed:0};}
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
/** Contact impulses affect translation and rotation, never an artificial racing boost. */
export function contactImpulse(d:Body,js:number,jl:number,vertical=0){
 d.v+=js;d.lv+=jl;d.yawV=clamp(d.yawV+jl*.62+js*d.lane*.14,-5,5);
 d.rollV=clamp(d.rollV-jl*.68,-5,5);d.pitchV=clamp(d.pitchV+js*.35,-4,4);d.vy+=vertical;
}
/** A distinct ballistic state carries the duck over the lip; landing then excites
 * damped buoyancy/rotation instead of moving the mesh directly onto the water. */
export function stepMotion(d:Body,oldS:number,time:number,dt:number):{kind:'takeoff'|'landing';strength:number}|null{
 let event:{kind:'takeoff'|'landing';strength:number}|null=null;
 for(let i=0;i<FALLS.length;i++){const f=FALLS[i];if(oldS<=f.lip&&d.s>f.lip&&d.lastFall<i){d.airborne=true;d.lastFall=i;d.y=waterline(f.lip,d.lane,time);d.vy=-.25;d.pitchV+=.7;event={kind:'takeoff',strength:d.v};}}
 const target=waterline(d.s,d.lane,time);
 if(d.airborne){
  d.vy-=GRAVITY*dt;d.y+=d.vy*dt;
  if(d.s>=FALLS[d.lastFall].impact-.3&&d.y<=target){const speed=-d.vy;d.airborne=false;d.y=target-.12;d.vy=-Math.min(2,speed*.2);d.pitchV-=Math.min(3.8,speed*.38);d.rollV+=Math.sin(d.lane*2)*Math.min(2.2,speed*.22);d.landings++;d.lastLanding=time;d.entrySpeed=speed;d.v*=.81;event={kind:'landing',strength:speed};}
 }else{
  d.vy+=((target-d.y)*55-d.vy*7.4)*dt;d.y+=d.vy*dt;
  // Bound immersion in exceptional low-frame-rate contacts; normal entries settle freely.
  d.y=clamp(d.y,target-.46,target+.5);
 }
 const bow=waterline(d.s+.55,d.lane,time),stern=waterline(Math.max(0,d.s-.55),d.lane,time);
 const right=waterline(d.s,d.lane+.4,time),left=waterline(d.s,d.lane-.4,time);
 const pitch=d.airborne?clamp(Math.atan2(-d.vy,Math.max(1,d.v))*.7,-.3,1.05):clamp(Math.atan2(stern-bow,1.1),-.25,.55);
 const roll=d.airborne?0:clamp(Math.atan2(right-left,.8)-d.lv*.035,-.3,.3);
 d.pitchV+=((pitch-d.pitch)*(d.airborne?8:29)-d.pitchV*(d.airborne?1.4:5.1))*dt;
 d.rollV+=((roll-d.roll)*24-d.rollV*(d.airborne?1:4.5))*dt;
 d.pitch=clamp(d.pitch+d.pitchV*dt,-.9,1.3);d.roll=clamp(d.roll+d.rollV*dt,-.9,.9);
 d.yawV*=Math.exp(-dt*(d.airborne?.25:1.65));d.yaw=Math.atan2(Math.sin(d.yaw+d.yawV*dt),Math.cos(d.yaw+d.yawV*dt));
 return event;
}
