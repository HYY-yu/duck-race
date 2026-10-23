export const COLORS=['#ffcf42','#f492aa','#7f8cdd','#68cbb1','#ef8c42','#6db9e6','#a8cb57','#c995d9','#f5edcb','#eb6b61','#55b9b4','#b79877'];
export type ColorChoice=string|null;
export const isDuckColor=(value:unknown):value is string=>typeof value==='string'&&COLORS.includes(value);
export const COLOR_NAMES={zh:['黄色','粉色','蓝紫','薄荷绿','橙色','天蓝','青柠绿','葡萄紫','奶油白','珊瑚红','湖蓝','可可棕'],en:['Yellow','Pink','Periwinkle','Mint','Orange','Sky blue','Lime','Grape','Cream','Coral','Teal','Cocoa']};
export const participantKey=(name:string)=>name.normalize('NFKC').toLowerCase();
