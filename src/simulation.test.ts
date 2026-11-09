import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation, MAX, W, H} from './simulation';
function seeded(){let s=42;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
test('100 founders, both trophic levels',()=>{const s=new Simulation(seeded());assert.equal(s.creatures.length,100);assert.equal(s.creatures.filter(c=>c.kind==='predator').length,15);});
test('reproduction transfers energy and copies genes without mutation',()=>{const s=new Simulation(seeded());s.creatures=[];s.food=[];s.abundance=0;s.mutation=0;s.add('herbivore',500,500);const parent=s.creatures[0];parent.energy=200;parent.cooldown=0;s.step(1/30);assert.equal(s.creatures.length,2);const child=s.creatures[1];assert.deepEqual(child.genes,parent.genes);assert.notEqual(child.genes,parent.genes);assert.equal(child.generation,2);assert.ok(parent.energy+child.energy<188);assert.equal(s.births,1);});
test('food provides energy and predators kill prey',()=>{const s=new Simulation(()=>.5);s.creatures=[];s.food=[];s.abundance=0;s.add('herbivore',100,100);s.addFood(100,100);s.step(.01);assert.ok(s.creatures[0].energy>100);assert.equal(s.food.length,0);s.add('predator',100,100);s.step(.01);assert.equal(s.creatures.length,1);assert.equal(s.creatures[0].kind,'predator');assert.equal(s.deaths,1);});
test('starvation and inherited lifespan cause death',()=>{const s=new Simulation(seeded());s.creatures=[];s.food=[];s.abundance=0;s.add('herbivore');s.creatures[0].energy=.001;s.add('herbivore');s.creatures[1].age=501;s.step(1/30);assert.equal(s.creatures.length,0);assert.equal(s.deaths,2);});
test('mutations vary inherited genes within bounds',()=>{const s=new Simulation(seeded());s.mutation=100;const g=s.creatures[0].genes;const m=s.mutate(g);assert.notDeepEqual(g,m);for(const k of Object.keys(g) as (keyof typeof g)[])assert.ok(m[k]>=g[k]*.8&&m[k]<=g[k]*1.2);});
test('long simulation respects finite positions, population and food limits',()=>{const s=new Simulation(seeded());for(let i=0;i<18000;i++)s.step(1/30);assert.ok(s.births>0);assert.ok(s.deaths>0);assert.ok(s.creatures.length<=MAX);assert.ok(s.food.length<=1400);assert.ok(s.history.length<=180);for(const c of s.creatures){assert.ok(Number.isFinite(c.energy));assert.ok(c.x>=0&&c.x<=W&&c.y>=0&&c.y<=H);}});
test('catastrophes apply persistent environmental changes and reset clears history',()=>{const s=new Simulation(seeded());s.disaster('drought');assert.equal(s.food.length,84);assert.equal(s.abundance,15);s.disaster('cold');assert.equal(s.temperature,0);s.disaster('meteor');assert.ok(s.deaths>0);s.reset();assert.equal(s.deaths,0);assert.equal(s.creatures.length,100);assert.equal(s.history.length,1);});

test('species counters account for kills, births and completed lifetimes exactly once',()=>{
 const s=new Simulation(()=>.5);s.creatures=[];s.food=[];s.abundance=0;
 s.add('herbivore',100,100);s.creatures[0].age=10;
 s.add('predator',100,100);s.creatures[1].energy=200;s.creatures[1].cooldown=0;
 s.step(.01);
 assert.equal(s.speciesStats('predator').hunts,1);
 assert.equal(s.speciesStats('herbivore').deaths.predation,1);
 assert.equal(s.speciesStats('herbivore').meanLifespan,10.01);
 assert.equal(s.speciesStats('herbivore').meanEnergy,null);
 assert.equal(s.speciesStats('predator').births,1);
 assert.equal(s.speciesStats('predator').population,2);
 assert.ok(s.speciesStats('predator').huntEnergy>0);
 s.step(.01);assert.equal(s.speciesStats('predator').hunts,1);
 assert.equal(s.births,s.stats.predator.births+s.stats.herbivore.births);
});
test('starvation, old age and disaster statistics are distinct and reset',()=>{
 const s=new Simulation(()=>.5);s.creatures=[];s.food=[];s.abundance=0;
 s.add('predator',100,100);s.creatures[0].energy=.001;
 s.add('herbivore',900,700);s.creatures[1].age=501;
 s.step(.01);assert.equal(s.stats.predator.deaths.starvation,1);assert.equal(s.stats.herbivore.deaths.oldAge,1);
 s.add('predator',600,400);s.disaster('meteor');assert.equal(s.stats.predator.deaths.disaster,1);assert.equal(s.deaths,3);
 const snapshot=s.speciesStats('predator');snapshot.deaths.starvation=999;assert.equal(s.stats.predator.deaths.starvation,1);
 s.reset();assert.equal(s.stats.predator.hunts,0);assert.equal(s.stats.predator.deaths.starvation,0);assert.equal(s.speciesStats('predator').meanLifespan,null);assert.equal(s.speciesStats('predator').meanEnergy,90);
});
test('predators without prey can still become extinct under adjusted balance',()=>{
 const s=new Simulation(seeded());s.creatures=[];s.food=[];s.abundance=0;s.add('predator',500,500);
 for(let i=0;i<90*30;i++)s.step(1/30);
 assert.equal(s.creatures.length,0);assert.equal(s.stats.predator.deaths.starvation,1);
});
test('fixed seed reproduces population, energy and event statistics',()=>{
 const a=new Simulation(seeded()),b=new Simulation(seeded());
 for(let i=0;i<1800;i++){a.step(1/30);b.step(1/30);}
 assert.deepEqual(a.creatures,b.creatures);assert.deepEqual(a.stats,b.stats);
 const counts=Object.values(a.stats).reduce((sum,s)=>sum+Object.values(s.deaths).reduce((n,v)=>n+v,0),0);
 assert.equal(a.deaths,counts);
});

test('adjusted founder threshold stays inheritable and does not alter metabolic or speed multipliers',()=>{
 const s=new Simulation(seeded());
 for(const c of s.creatures) assert.ok(c.genes.fertility>=(c.kind==='predator'?150:130)&&c.genes.fertility<(c.kind==='predator'?185:165));
 assert.equal(s.balance.predatorSpeed,1.16);assert.equal(s.balance.escapeSpeed,1.25);assert.equal(s.balance.predatorMetabolism,1.35);
 s.creatures=[];s.food=[];s.abundance=0;s.mutation=0;s.add('predator',500,500);
 const parent=s.creatures[0];parent.energy=240;parent.cooldown=0;s.step(.01);
 assert.equal(s.creatures.length,2);assert.deepEqual(s.creatures[1].genes,parent.genes);
});

test('equal-speed prey widens the chase gap and predator pays the original metabolic cost',()=>{
 const s=new Simulation(()=>.5);s.creatures=[];s.food=[];s.abundance=0;
 const genes={speed:37.5,vision:200,size:4,fertility:165,longevity:300};
 s.add('herbivore',380,400,genes);s.add('predator',300,400,genes);
 const prey=s.creatures[0],predator=s.creatures[1];
 for(let i=0;i<30;i++)s.step(1/30);
 assert.ok(prey.x-predator.x>80);
 const expected=(.65+37.5**2*.00032+200*.003+4*.11)*1.35;
 assert.ok(Math.abs(predator.energy-(90-expected))<1e-9);
 assert.equal(s.stats.predator.hunts,0);assert.ok(Math.abs(s.stats.predator.pursuitSeconds-1)<1e-9);
});
