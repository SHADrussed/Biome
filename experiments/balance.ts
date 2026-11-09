import {writeFileSync} from 'node:fs';
import {Simulation, BASELINE_BALANCE, DEFAULT_BALANCE} from '../src/simulation';
export function seeded(seed:number) { let state=seed>>>0; return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}; }
const seeds=Array.from({length:10},(_,i)=>i+1);
const mode=process.argv[2]??'baseline';
if(!['baseline','adjusted','metabolism-trial'].includes(mode))throw new Error('Use baseline, adjusted or metabolism-trial');
const balance=mode==='baseline'?BASELINE_BALANCE:mode==='metabolism-trial'?{...BASELINE_BALANCE,predatorMetabolism:1.20}:DEFAULT_BALANCE;
const runs=seeds.map(seed=>{
 const sim=new Simulation(seeded(seed),balance);
 const checkpoints=[];
 for(let tick=1;tick<=9000;tick++){
  sim.step(1/30);
  if([1800,5400,9000].includes(tick))checkpoints.push({seconds:tick/30,herbivore:sim.speciesStats('herbivore'),predator:sim.speciesStats('predator')});
 }
 return {seed,checkpoints};
});
const summary=[60,180,300].map(seconds=>{
 const points=runs.map(r=>r.checkpoints.find(p=>p.seconds===seconds)!);
 return {seconds,...Object.fromEntries((['herbivore','predator'] as const).map(kind=>{
 const rows=points.map(p=>p[kind]);const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
 const deaths=rows.reduce((n,r)=>n+Object.values(r.deaths).reduce((a,b)=>a+b,0),0);
 const alive=rows.reduce((n,r)=>n+r.population,0);
 return [kind,{population:mean(rows.map(r=>r.population)),min:Math.min(...rows.map(r=>r.population)),max:Math.max(...rows.map(r=>r.population)),extinctRuns:rows.filter(r=>!r.population).length,hunts:mean(rows.map(r=>r.hunts)),births:mean(rows.map(r=>r.births)),starvation:mean(rows.map(r=>r.deaths.starvation)),oldAge:mean(rows.map(r=>r.deaths.oldAge)),meanEnergy:alive?rows.reduce((n,r)=>n+(r.meanEnergy??0)*r.population,0)/alive:null,meanLifespan:deaths?rows.reduce((n,r)=>n+r.totalLifespan,0)/deaths:null,energySpent:mean(rows.map(r=>r.energySpent)),huntEnergy:mean(rows.map(r=>r.huntEnergy)),pursuitSeconds:mean(rows.map(r=>r.pursuitSeconds))}];
 }))};
});
const report={mode,seeds,dt:1/30,conditions:{temperature:22,abundance:65,mutation:12},balance,runs,summary};
writeFileSync(`experiments/${mode}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
