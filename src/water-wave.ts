/** The GPU surface and CPU buoyancy probes use the same waves and shore fade. */
const waves = [
  { amplitude: .085, along: .9, across: 1.7, frequency: .7 },
  { amplitude: .035, along: 2.1, across: -2.5, frequency: 1.1 },
  { amplitude: .018, along: 3.9, across: 3.1, frequency: 1.7 },
];
export function waterWave(s:number,lateral:number,bankDistance:number,time:number){
 const edge=Math.max(0,Math.min(1,bankDistance/.7));if(edge===0)return 0;
 return edge*edge*(3-2*edge)*waves.reduce((h,w)=>h+w.amplitude*Math.sin(s*w.along+lateral*w.across-(time%20)*Math.PI*2*w.frequency),0);
}
export const WATER_WAVE_GLSL=`float riverSurfaceWave(float s,float lateral,float bankDistance,float time){
 float waveClock=mod(time,20.0)*6.283185307;
 return smoothstep(0.,.7,bankDistance)*(${waves.map(w=>`${w.amplitude}*sin(s*${w.along}+lateral*${w.across}-waveClock*${w.frequency})`).join('+')});}
`;
