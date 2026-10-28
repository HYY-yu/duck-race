export const STEERING_KEYS=new Map([['KeyA',-1],['ArrowLeft',-1],['KeyD',1],['ArrowRight',1]]);

/** Track each held input independently: releasing one finger must not release another. */
export class SteeringInput {
 private held=new Map<string,number>();
 press(source:string,direction:number){this.held.set(source,direction<0?-1:1);}
 release(source:string){this.held.delete(source);}
 clear(){this.held.clear();}
 get axis(){const directions=[...this.held.values()];return Number(directions.includes(1))-Number(directions.includes(-1));}
}
