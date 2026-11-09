export const W = 1200, H = 800, MAX = 600;
export type Kind = 'herbivore' | 'predator';
export interface Genes { speed: number; vision: number; size: number; fertility: number; longevity: number; }
export interface Creature { id: number; x: number; y: number; angle: number; energy: number; age: number; generation: number; kind: Kind; genes: Genes; cooldown: number; dead: boolean; }
export const BASELINE_BALANCE = { predatorSpeed: 1.16, escapeSpeed: 1.25, predatorMetabolism: 1.35, predatorFertilityOffset: 0 };
export const DEFAULT_BALANCE = { ...BASELINE_BALANCE, predatorFertilityOffset: 20 };
export type DeathCause = 'starvation' | 'oldAge' | 'predation' | 'disaster';
function emptyStats() { return { hunts: 0, births: 0, deaths: { starvation: 0, oldAge: 0, predation: 0, disaster: 0 }, totalLifespan: 0, energySpent: 0, huntEnergy: 0, pursuitSeconds: 0 }; }
export interface Food { x: number; y: number; energy: number; }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export class Grid<T extends {x:number;y:number}> {
  cells = new Map<number, T[]>();
  build(items: T[]) { this.cells.clear(); for (const p of items) { const key = Math.floor(p.x / 80) + Math.floor(p.y / 80) * 32; const cell = this.cells.get(key); if (cell) cell.push(p); else this.cells.set(key, [p]); } }
  near(x:number,y:number,r:number) { const result:T[]=[]; for(let j=Math.max(0,Math.floor((y-r)/80));j<=Math.floor((y+r)/80);j++) for(let i=Math.max(0,Math.floor((x-r)/80));i<=Math.floor((x+r)/80);i++) { const cell=this.cells.get(i+j*32); if(cell) result.push(...cell); } return result; }
}
export class Simulation {
  creatures: Creature[]=[]; food:Food[]=[]; time=0; births=0; deaths=0; nextId=1; temperature=22; abundance=65; mutation=12; history:{h:number;p:number;t:number}[]=[]; event='Экосистема создана';
  stats = { herbivore: emptyStats(), predator: emptyStats() };
  private foodCredit=0; private sample=0; private cg=new Grid<Creature>(); private fg=new Grid<Food>();
  constructor(public random:()=>number=Math.random, public readonly balance = DEFAULT_BALANCE) { this.reset(); }
  reset() { this.stats={herbivore:emptyStats(),predator:emptyStats()};this.creatures=[];this.food=[];this.time=0;this.births=0;this.deaths=0;this.nextId=1;this.history=[];this.sample=0;this.foodCredit=0; for(let i=0;i<100;i++) this.add(i<85?'herbivore':'predator'); for(let i=0;i<420;i++)this.addFood();this.record();this.event='Новый мир · 100 основателей'; }
  add(kind:Kind,x=this.random()*W,y=this.random()*H,genes?:Genes,generation=1,energy=90) {
    if(this.creatures.length>=MAX)return;
    const g=genes??{speed:25+this.random()*25,vision:65+this.random()*75,size:3+this.random()*2,fertility:130+this.random()*35+(kind==='predator'?this.balance.predatorFertilityOffset:0),longevity:180+this.random()*180};
    this.creatures.push({id:this.nextId++,x:clamp(x,1,W-1),y:clamp(y,1,H-1),kind,genes:{...g},generation,energy,age:0,angle:this.random()*Math.PI*2,cooldown:12,dead:false});
  }
  addFood(x=this.random()*W,y=this.random()*H) { if(this.food.length<1400)this.food.push({x:clamp(x,0,W),y:clamp(y,0,H),energy:24}); }
  mutate(g:Genes):Genes { const child={...g}; const limits:Record<keyof Genes,[number,number]>={speed:[15,85],vision:[35,220],size:[2.5,8],fertility:[105,190],longevity:[100,500]}; for(const key of Object.keys(g) as (keyof Genes)[]) if(this.random()<this.mutation/100)child[key]=clamp(g[key]*(.8+this.random()*.4),...limits[key]); return child; }
  private die(c: Creature, cause: DeathCause) {
    if (c.dead) return;
    c.dead = true;
    this.deaths++;
    this.stats[c.kind].deaths[cause]++;
    this.stats[c.kind].totalLifespan += c.age;
  }
  speciesStats(kind: Kind) {
    const living = this.creatures.filter(c => c.kind === kind && !c.dead);
    const stats = this.stats[kind];
    const deaths = Object.values(stats.deaths).reduce((a,b) => a+b, 0);
    return { ...stats, deaths: {...stats.deaths}, population: living.length,
      meanEnergy: living.length ? living.reduce((n,c) => n+c.energy,0)/living.length : null,
      meanAge: living.length ? living.reduce((n,c) => n+c.age,0)/living.length : null,
      meanLifespan: deaths ? stats.totalLifespan/deaths : null };
  }
  record() {this.history.push({h:this.creatures.filter(c=>c.kind==='herbivore').length,p:this.creatures.filter(c=>c.kind==='predator').length,t:this.time});if(this.history.length>180)this.history.shift();}
  step(dt:number) {
    this.time+=dt; this.foodCredit+=dt*this.abundance*.2*Math.max(.1,1-Math.abs(this.temperature-22)/35);
    while(this.foodCredit>=1){this.addFood();this.foodCredit--;}
    this.cg.build(this.creatures);this.fg.build(this.food);
    const newborns: {parent:Creature;genes:Genes;energy:number}[]=[];
    for(const c of this.creatures){
      if(c.dead)continue; const g=c.genes;c.age+=dt;c.cooldown-=dt;
      let tx=0,ty=0,best=g.vision*g.vision,target:Creature|Food|undefined; let fleeing=false;
      const neighbors=this.cg.near(c.x,c.y,g.vision);
      if(c.kind==='herbivore') {
        for(const other of neighbors){const d=(other.x-c.x)**2+(other.y-c.y)**2;if(other.kind==='predator'&&!other.dead&&d<best){best=d;target=other;fleeing=true;}}
        if(!fleeing)for(const f of this.fg.near(c.x,c.y,g.vision)){const d=(f.x-c.x)**2+(f.y-c.y)**2;if(f.energy>0&&d<best){best=d;target=f;}}
      } else for(const other of neighbors){const d=(other.x-c.x)**2+(other.y-c.y)**2;if(other.kind==='herbivore'&&!other.dead&&d<best){best=d;target=other;}}
      if(target){tx=(target.x-c.x)*(fleeing?-1:1);ty=(target.y-c.y)*(fleeing?-1:1);c.angle=Math.atan2(ty,tx);}else c.angle+=(this.random()-.5)*2.8*Math.sqrt(dt);
      const speed=g.speed*(c.kind==='predator'?this.balance.predatorSpeed:1)*(fleeing?this.balance.escapeSpeed:1)*Math.max(.45,1-Math.abs(this.temperature-22)*.018);
      c.x+=Math.cos(c.angle)*speed*dt;c.y+=Math.sin(c.angle)*speed*dt;
      if(c.x<0||c.x>W){c.angle=Math.PI-c.angle;c.x=clamp(c.x,0,W);} if(c.y<0||c.y>H){c.angle=-c.angle;c.y=clamp(c.y,0,H);}
      const cost=dt*(.65+g.speed**2*.00032+g.vision*.003+g.size*.11+Math.abs(this.temperature-22)*.07)*(c.kind==='predator'?this.balance.predatorMetabolism:1);
      c.energy-=cost;this.stats[c.kind].energySpent+=cost;
      if(c.kind==='predator'&&target)this.stats.predator.pursuitSeconds+=dt;
      if(target&&!fleeing&&(target.x-c.x)**2+(target.y-c.y)**2<(g.size+6)**2){
        if('kind' in target){if(!target.dead){const before=c.energy;c.energy=Math.min(240,c.energy+Math.max(35,target.energy*.7));this.stats.predator.hunts++;this.stats.predator.huntEnergy+=c.energy-before;this.die(target,'predation');}}
        else if(target.energy>0){c.energy=Math.min(240,c.energy+target.energy);target.energy=0;}
      }
      if(c.energy<=0||c.age>g.longevity){this.die(c,c.energy<=0?'starvation':'oldAge');continue;}
      if(c.energy>g.fertility&&c.cooldown<=0&&this.creatures.length+newborns.length<MAX){const energy=c.energy*.42;c.energy-=energy+12;c.cooldown=18;newborns.push({parent:c,genes:this.mutate(g),energy});}
    }
    this.creatures=this.creatures.filter(c=>!c.dead);this.food=this.food.filter(f=>f.energy>0);
    for(const n of newborns){this.add(n.parent.kind,n.parent.x+this.random()*16-8,n.parent.y+this.random()*16-8,n.genes,n.parent.generation+1,n.energy);this.births++;this.stats[n.parent.kind].births++;}
    this.sample+=dt;if(this.sample>=2){this.sample-=2;this.record();}
  }
  disaster(type:'drought'|'meteor'|'cold') {
    if(type==='drought'){this.food.splice(0,Math.floor(this.food.length*.8));this.abundance=15;this.event='Засуха · потеря 80% растений';}
    if(type==='cold'){this.temperature=0;this.event='Ледниковый период · температура 0 °C';}
    if(type==='meteor'){const x=this.random()*W,y=this.random()*H;const before=this.creatures.length;for(const c of this.creatures)if((c.x-x)**2+(c.y-y)**2<=240**2)this.die(c,'disaster');this.creatures=this.creatures.filter(c=>!c.dead);this.food=this.food.filter(f=>(f.x-x)**2+(f.y-y)**2>240**2);this.event=`Метеорит · погибло ${before-this.creatures.length} существ`;return {x,y};}
  }
}
