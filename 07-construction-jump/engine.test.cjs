const assert=require('node:assert/strict');
const Jump=require('./engine.js');

function randomSeed(seed){let value=seed>>>0;return ()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/2**32);}

let earlyCount=0,lateCount=0,earlyGap=0,lateGap=0,earlySpeed=0,lateSpeed=0;
const signatures=new Set(),cargoX=new Set(),cargoIntervals=new Set();
for(let seed=1;seed<=30;seed++){
  const state=Jump.create(randomSeed(seed));Jump.start(state);
  const latePlatforms=new Map();
  const wrapRoutes=new Set(),hardRoutes=new Map();let crossings=0;
  const cargo=new Map();
  let steps=0;
  while(state.phase==='running'&&state.maxHeight<36000&&steps++<90000){
    // Validate the underlying platform route separately from combat and flight.
    for(const item of state.obstacles)cargo.set(item.id,item.anchor);
    state.powerups=[];state.obstacles=[];
    const next=state.platforms.find(item=>item.route!==null&&item.y>state.lastLandingY+10);
    assert.ok(next,'A route scaffold is generated ahead of the player');
    const raw=next.x-state.player.x,period=Jump.width+30;
    const dx=Math.abs(raw)>period/2?raw-Math.sign(raw)*period:raw;
    const previousX=state.player.x;
    Jump.advance(state,1/120,Math.abs(dx)>3?Math.sign(dx):0);
    if(Math.abs(state.player.x-previousX)>Jump.width/2)crossings++;
    for(const item of state.platforms){if(item.hard){assert.equal(item.type,'moving');assert.ok(item.speed>=5.8);hardRoutes.set(item.route,item);} }
    for(const item of state.platforms)if(item.wrap){
      assert.ok(item.y>=Jump.base+50*Jump.floorHeight);
      wrapRoutes.add(item.route);
    }
    assert.ok(state.platforms.length<30&&state.materials.length<18&&state.powerups.length<8,'Offscreen objects are pruned');
    for(let a=0;a<state.platforms.length;a++){
      const p=state.platforms[a];assert.equal(p.w,Jump.platformWidth,'All generated platforms have equal width');
      for(let b=a+1;b<state.platforms.length;b++){
        const q=state.platforms[b];
        if(Math.abs(p.y-q.y)<48){
          const motion=(p.type==='moving'?p.amplitude:0)+(q.type==='moving'?q.amplitude:0);
          assert.ok(Math.abs(p.anchor-q.anchor)>=(p.w+q.w)/2+12+motion,'Full platform travel envelopes do not overlap');
        }
      }
    }
    if(seed===1)for(const item of state.platforms)if(item.y>=7600&&item.y<8500)latePlatforms.set(item.id,item);
  }
  assert.ok(state.maxHeight>=36000,`Seed ${seed} should remain climbable, reached ${Math.round(state.maxHeight)}`);
  assert.equal(state.phase,'running','The climb never ends at a fixed roof');
  assert.ok(wrapRoutes.size>=2&&crossings>=2,'High routes require repeated crossings through screen edges');
  assert.ok(Jump.floors(state)>=199);
  assert.ok([...hardRoutes.values()].filter(item=>item.wrap).length>5,'Mixed high routes retain edge crossings');
  assert.ok(new Set([...hardRoutes.values()].map(item=>item.pattern)).size>=4,'High routes mix several layouts');
  const high=[...hardRoutes.values()];
  assert.ok(new Set(high.slice(1).map((item,i)=>Math.round(item.y-high[i].y))).size>=8,'High gaps vary');
  assert.ok(new Set(high.map(item=>Math.round(item.phase*10))).size>20,'Platforms do not move in lockstep');
  signatures.add(high.slice(0,40).map(item=>Math.round(item.anchor)).join(','));
  const cargoIds=[...cargo.keys()];
  for(let i=0;i<cargoIds.length;i++){
    cargoX.add(Math.floor(cargo.get(cargoIds[i])/50));
    if(i)cargoIntervals.add(cargoIds[i]-cargoIds[i-1]);
  }
  assert.ok(Jump.score(state)>850);
  const route=state.platforms.filter(item=>item.route!==null);
  for(let i=1;i<route.length;i++){
    assert.ok(route[i].y-route[i-1].y<=124,'The next gap stays within jump range');
    const distance=Math.abs(route[i].anchor-route[i-1].anchor);
    assert.ok(Math.min(distance,Jump.width+30-distance)<=100,'Next scaffold stays reachable through an edge when needed');
  }
  if(seed===1){
    const platforms=[...latePlatforms.values()].sort((a,b)=>a.y-b.y);
    const routes=platforms.filter(item=>item.route!==null);
    lateCount=platforms.length;
    lateGap=routes.slice(1).reduce((sum,item,i)=>sum+item.y-routes[i].y,0)/(routes.length-1);
    lateSpeed=Math.max(...high.map(item=>item.speed));
  }
}
assert.equal(signatures.size,30,'Different seeds produce different high-altitude routes');
assert.ok(cargoX.size>=5 && cargoIntervals.size>=5,'Cargo positions and spacing vary independently');

const sample=Jump.create(randomSeed(99));
earlyCount=sample.platforms.filter(item=>item.y<900).length;
const earlyRoutes=sample.platforms.filter(item=>item.route!==null);
earlyGap=earlyRoutes.slice(1).reduce((sum,item,i)=>sum+item.y-earlyRoutes[i].y,0)/(earlyRoutes.length-1);
earlySpeed=Math.max(...sample.platforms.filter(item=>item.type==='moving').map(item=>item.speed),0);
assert.ok(lateCount<earlyCount,'Optional scaffolds become less frequent');
assert.ok(lateGap>earlyGap,'Vertical gaps grow');
assert.ok(lateSpeed>earlySpeed,'Moving scaffolds speed up');
assert.equal(Jump.difficulty(100000),1,'Difficulty has a safe upper bound');

const paused=Jump.create(randomSeed(5));Jump.start(paused);Jump.pause(paused);
const before=paused.player.y;Jump.advance(paused,1,1);assert.equal(paused.player.y,before);
Jump.resume(paused);Jump.advance(paused,.05,0);assert.ok(paused.player.y>before);

const fragile=Jump.create(randomSeed(2)),platform={id:999,route:null,x:200,y:110,w:94,type:'fragile',broken:false};
fragile.platforms.push(platform);Jump.start(fragile);
fragile.player.x=platform.x;fragile.player.y=platform.y+.2;fragile.player.vy=-100;
Jump.advance(fragile,.02,0);assert.equal(platform.broken,true);

const spring=Jump.create(randomSeed(6)),springPad={id:999,route:null,x:200,y:110,w:94,type:'spring',broken:false};
spring.platforms.push(springPad);Jump.start(spring);
spring.player.x=200;spring.player.y=110+.2;spring.player.vy=-100;
Jump.advance(spring,.02,0);assert.ok(spring.player.vy>Jump.jumpSpeed,'Spring platform gives a higher bounce');

for(const kind of Object.keys(Jump.boosts)){
  const boosted=Jump.create(randomSeed(7));Jump.start(boosted);
  boosted.powerups.push({id:999,kind,x:200,y:43,collected:false});
  Jump.advance(boosted,.02,0);assert.equal(boosted.boost.kind,kind);assert.equal(boosted.boostsUsed,1);
  const start=boosted.player.y;
  for(let i=0;i<10;i++)Jump.advance(boosted,.1,0);
  assert.ok(boosted.player.y>start+300,'A boost lifts the player substantially');
  for(let i=0;i<25;i++)Jump.advance(boosted,.1,0);
  assert.equal(boosted.boost,null,'Boost expires');
}
assert.ok(Math.abs(Jump.springSpeed**2/Jump.jumpSpeed**2-2.25)<.001,'Spring apex is 2.25 times the normal apex');

const fallen=Jump.create(randomSeed(3));Jump.start(fallen);
fallen.camera=1000;fallen.player.y=900;fallen.player.vy=-10;Jump.advance(fallen,.02,0);
assert.equal(fallen.phase,'failed');
console.log('PASS: 30 climbs to floor 200, repeated edge crossings after floor 50, 2.25x spring height, three flight boosts and bounded world.');
