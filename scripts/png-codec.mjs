// Minimal 8-bit RGB/RGBA PNG codec for deterministic offline 3D texture packaging.
import {inflateSync,deflateSync} from 'node:zlib';
export function decodePNG(bytes){
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),channels=bytes[25]===2?3:4;
 if(bytes[24]!==8||![2,6].includes(bytes[25])||bytes[28]!==0)throw Error('Unsupported PNG layout');
 const chunks=[];for(let p=8;p<bytes.length;){const n=bytes.readUInt32BE(p);if(bytes.toString('ascii',p+4,p+8)==='IDAT')chunks.push(bytes.subarray(p+8,p+8+n));p+=n+12;}
 const packed=inflateSync(Buffer.concat(chunks)),stride=width*channels,data=Buffer.alloc(height*stride);
 for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
  const f=packed[y*(stride+1)],v=packed[y*(stride+1)+1+x],a=x>=channels?data[y*stride+x-channels]:0,b=y?data[(y-1)*stride+x]:0,c=y&&x>=channels?data[(y-1)*stride+x-channels]:0;
  let predictor=0;if(f===1)predictor=a;else if(f===2)predictor=b;else if(f===3)predictor=Math.floor((a+b)/2);else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}else if(f!==0)throw Error('Unknown PNG filter');
  data[y*stride+x]=(v+predictor)&255;
 }
 return {width,height,channels,data};
}
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,-4)),out.length-4);return out;}
export function encodePNG(image){const {width,height,channels,data}=image,stride=width*channels,rows=Buffer.alloc((stride+1)*height);for(let y=0;y<height;y++)data.copy(rows,y*(stride+1)+1,y*stride,(y+1)*stride);const hdr=Buffer.alloc(13);hdr.writeUInt32BE(width);hdr.writeUInt32BE(height,4);hdr[8]=8;hdr[9]=channels===3?2:6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
