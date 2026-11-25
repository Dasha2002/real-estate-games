const {test}=require('node:test');
const assert=require('node:assert/strict');
const A=require('./engine.js');
function rng(seed=71){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
function running(level='easy'){const s=A.create(level,rng());A.start(s);s.spawnIn=1000;return s;}
function cargo(count,shape='single',lane='brown'){return Array.from({length:count},()=>({shape,lane}));}
function drop(s,{lane=s.lane,shape='single',type='material',x=s.player}={}){
  s.falling.push({id:++s.sequence,type,lane,shape,x,progress:.999});A.advance(s,.02);
}

test('A round is exactly 90 active seconds; ready/paused/finished states never advance',()=>{
  const s=A.create();A.advance(s,20);assert.equal(s.elapsed,0);
  A.start(s);A.advance(s,10);A.pause(s);const snapshot=JSON.stringify(s);
  A.advance(s,50);assert.equal(JSON.stringify(s),snapshot);
  A.resume(s);A.advance(s,100);assert.equal(s.phase,'finished');assert.equal(s.elapsed,90);
  const end=JSON.stringify(s);A.advance(s,10);assert.equal(JSON.stringify(s),end);
});
test('Only materials on the active depth plane can be caught',()=>{
  const s=running();drop(s,{lane:'blue'});assert.equal(s.cargo.length,0);
  A.switchLane(s,'blue');drop(s,{lane:'blue'});assert.equal(s.cargo.length,1);
  A.switchLane(s,'brown');drop(s,{lane:'brown',shape:'wide'});assert.equal(s.cargo.length,2);
  assert.deepEqual(s.cargo.map(c=>c.lane),['blue','brown']);assert.equal(s.materials,0);
});
test('Loaded boxes do not change the incoming flight time and follow plane switches',()=>{
  const s=running();s.cargo=cargo(4);
  s.falling.push({id:1,type:'material',lane:s.lane,shape:'corner',x:s.player,progress:.7});
  A.advance(s,.4);assert.equal(s.cargo.length,4);
  A.advance(s,.2);assert.equal(s.cargo.length,5);assert.equal(s.caught,3);assert.equal(A.cargoCount(s),7);
  const before=JSON.stringify(s.cargo);A.switchLane(s,'blue');assert.equal(JSON.stringify(s.cargo),before);
});
test('Three forms contribute 100 / 150 / 200 units; multiplier depends on box count',()=>{
  const s=running();s.cargo=[{shape:'single',lane:'blue'},{shape:'wide',lane:'brown'},{shape:'corner',lane:'brown'}];
  assert.equal(A.cargoCount(s),6);assert.equal(A.multiplier(s),2);
  const batch=A.submit(s);assert.equal(batch.raw,450);assert.equal(batch.amount,900);assert.equal(batch.count,6);assert.equal(s.submitted,6);assert.equal(s.materials,900);
  assert.equal(s.cargo.length,0);assert.equal(s.lit,0);
  s.cargo=cargo(4);A.submit(s);assert.equal(s.materials,1700);assert.equal(s.lit,1);
});
test('Submitting a high stack is instantaneous, empties all cargo and cannot be awarded twice',()=>{
  const s=running();s.player=.27;s.lane='blue';s.cargo=cargo(7);
  const at=s.elapsed,batch=A.submit(s);
  assert.equal(batch.factor,3);assert.equal(batch.amount,2100);assert.equal(batch.windows,2);
  assert.equal(s.lit,2);assert.equal(s.litAt.length,2);assert.equal(s.elapsed,at);assert.equal(s.cargo.length,0);
  assert.equal(A.submit(s),null);assert.equal(s.materials,2100);
});
test('Delivery retains an independent animation snapshot, freezes on pause and expires without duplicate rewards',()=>{
  const s=running();s.cargo=[{shape:'corner',lane:'blue',count:2,value:400/3},{shape:'wide',lane:'brown'}];
  s.player=.3;s.lane='blue';const batch=A.submit(s),amount=s.materials;
  assert.equal(s.deliveries.length,1);assert.equal(s.deliveries[0].boxes.length,4);
  assert.equal(s.deliveries[0].lane,'blue');assert.equal(s.cargo.length,0);
  s.cargo=cargo(1);s.player=.8;A.switchLane(s,'brown');
  assert.equal(s.deliveries[0].boxes.length,4);assert.equal(s.deliveries[0].x,(.3-.5)*A.fieldWidth);
  A.pause(s);A.advance(s,2);assert.equal(s.elapsed,batch.at);assert.equal(s.deliveries.length,1);
  A.resume(s);A.advance(s,1.7);assert.equal(s.deliveries.length,0);assert.equal(s.materials,amount);
});
test('Bundles fill one, two or three cells and cannot overflow the twelve-cell bed',()=>{
  const s=running();drop(s,{shape:'corner'});assert.equal(A.cargoCount(s),3);
  drop(s,{shape:'wide'});assert.equal(A.cargoCount(s),5);assert.equal(A.multiplier(s),2);
  drop(s,{shape:'corner'});assert.equal(A.cargoCount(s),8);assert.equal(A.multiplier(s),3);
  drop(s,{shape:'corner'});assert.equal(A.cargoCount(s),11);
  drop(s,{shape:'single'});assert.equal(A.cargoCount(s),12);
  assert.equal(s.caught,12);const before=JSON.stringify(s.cargo);
  drop(s,{shape:'single'});assert.equal(JSON.stringify(s.cargo),before);assert.equal(s.caught,12);
  A.submit(s);assert.equal(A.cargoCount(s),0);drop(s,{shape:'wide'});assert.equal(A.cargoCount(s),2);
});
test('At 10/12, two cells detach from a triple bundle and the remaining cell falls',()=>{
  const s=running();s.cargo=cargo(10);drop(s,{shape:'corner'});
  assert.equal(A.cargoCount(s),12);assert.equal(s.caught,2);assert.equal(A.multiplier(s),3);
  assert.equal(s.loading.length,2);assert.deepEqual(s.loading.map(p=>p.slot),[10,11]);
  assert.equal(s.falling.length,1);assert.deepEqual(s.falling[0].cells,[[0,0]]);
  A.advance(s,.4);assert.equal(s.loading.length,0);assert.equal(A.cargoCount(s),12);
  A.advance(s,1);assert.equal(s.missed,1);assert.equal(s.falling.length,0);
  const batch=A.submit(s);assert.equal(batch.count,12);assert.equal(batch.raw,1133);assert.equal(batch.amount,3399);
});
test('One free cell accepts one box from either two- or three-box bundles',()=>{
  for(const shape of ['wide','corner']){
    const s=running();s.cargo=cargo(11);drop(s,{shape});
    assert.equal(A.cargoCount(s),12);assert.equal(s.caught,1);
    assert.equal(s.falling[0].cells.length,A.shapes[shape].cells.length-1);
    assert.equal(s.loading.length,1);
    const caught=s.caught;A.submit(s);assert.equal(s.loading.length,0);
    A.advance(s,1);assert.equal(s.caught,caught,'remaining cells cannot be caught twice');assert.equal(A.cargoCount(s),0);
  }
});
test('A hazard cancels partial-loading animation together with the cargo',()=>{
  const s=running();s.cargo=cargo(10);drop(s,{shape:'corner'});drop(s,{type:'hazard'});
  assert.equal(A.cargoCount(s),0);assert.equal(s.loading.length,0);
});

test('Both colours and all forms have the same airtime at every difficulty and round time',()=>{
  const flight=(A.dropHeight-A.bedHeight)/A.fallSpeed;
  for(const level of ['easy','normal','hard'])for(const elapsed of [0,55])for(const lane of ['blue','brown'])for(const shape of Object.keys(A.shapes)){
    const s=running(level);s.elapsed=elapsed;s.lane=lane;s.cargo=cargo(3);
    s.falling.push({id:1,type:'material',lane,shape,x:s.player,progress:0});
    A.advance(s,flight-.001);assert.equal(s.cargo.length,3,`${level}/${lane}/${shape} caught early`);
    A.advance(s,.002);assert.equal(s.cargo.length,4,`${level}/${lane}/${shape} arrived late`);
  }
});

test('Fall velocity is constant for hazards and materials, without acceleration over the round',()=>{
  const progress=[];
  for(const elapsed of [0,60])for(const lane of ['blue','brown'])for(const type of ['material','hazard']){
    const s=running('hard');s.elapsed=elapsed;
    s.falling.push({id:1,type,lane,shape:'wide',x:.13,progress:0});
    A.advance(s,.6);progress.push(s.falling[0].progress);
  }
  assert.ok(Math.max(...progress)-Math.min(...progress)<1e-9);
});
test('Hazards remove the unsent stack and stop the pickup, while lit windows remain',()=>{
  const s=running('normal');s.elapsed=20;s.materials=5000;s.lit=5;s.litAt=Array(5).fill(1);s.cargo=cargo(7);
  drop(s,{type:'hazard'});assert.equal(s.cargo.length,0);assert.equal(s.crashes,1);assert.equal(s.lit,5);assert.equal(s.materials,5000);
  assert.equal(s.impact.x,s.player);assert.equal(s.impact.lane,'brown');
  const impact=s.impact;
  assert.equal(A.switchLane(s,'blue'),false);const x=s.player;A.advance(s,.1,{direction:1});assert.equal(s.player,x);
  A.advance(s,1);assert.equal(A.switchLane(s,'blue'),true);
  s.cargo=cargo(1);A.submit(s);assert.equal(s.impact,impact,'smoke stays at the impact position after a new delivery');
});
test('Hazards on the other plane can be avoided and never destroy cargo',()=>{
  const s=running('normal');s.elapsed=20;s.cargo=cargo(3);
  drop(s,{type:'hazard',lane:'blue'});A.advance(s,4);
  assert.equal(s.crashes,0);assert.equal(s.dodged,1);assert.equal(s.cargo.length,3);
});
test('Higher difficulties introduce hazards after 12 seconds; easy has none',()=>{
  for(const level of ['normal','hard']){
    const s=A.create(level,rng());A.start(s);A.advance(s,11.9);assert.equal(s.hazardIntroduced,false);
    A.advance(s,2);assert.equal(s.hazardIntroduced,true);
  }
  const s=A.create('easy',rng());A.start(s);A.advance(s,90);assert.equal(s.hazardIntroduced,false);
});
test('Difficulty increases traffic, while the result stays capped at 48 windows',()=>{
  const counts=[];
  for(const level of ['easy','normal','hard']){const s=A.create(level,rng());A.start(s);A.advance(s,30);counts.push(s.sequence);}
  assert.ok(counts[0]<counts[1]&&counts[1]<counts[2]);
  const s=running();s.materials=47900;s.lit=47;s.litAt=Array(47).fill(1);s.cargo=cargo(7);A.submit(s);assert.equal(s.lit,48);assert.equal(s.litAt.length,48);
});
test('Finished or paused rounds cannot submit or switch lanes; leftovers never auto-submit',()=>{
  const s=running();s.cargo=cargo(7);A.pause(s);assert.equal(A.submit(s),null);assert.equal(A.switchLane(s,'blue'),false);
  A.resume(s);A.advance(s,90);assert.equal(s.materials,0);assert.equal(s.lit,0);assert.equal(s.cargo.length,7);assert.equal(A.submit(s),null);
});
for(const level of ['easy','normal','hard'])test(`A full simulated two-plane round can build apartments: ${level}`,()=>{
  const s=A.create(level,rng());A.start(s);
  while(s.phase==='running'){
    if(A.cargoCount(s)>=7||(s.elapsed>89&&s.cargo.length))A.submit(s);
    const material=s.falling.find(box=>box.type==='material'&&box.progress<1);
    const danger=s.falling.find(box=>box.type==='hazard'&&box.lane===s.lane&&Math.abs(box.x-s.player)<.1&&box.progress<1&&1-box.progress<.2);
    if(danger)A.switchLane(s,s.lane==='blue'?'brown':'blue');else if(material)A.switchLane(s,material.lane);
    A.advance(s,1/60,{target:material?.x});assert.ok(A.cargoCount(s)<=A.capacity);
  }
  assert.equal(s.elapsed,90);assert.ok(s.lit>=2,`only ${s.lit} windows`);assert.equal(s.lit,Math.min(48,Math.floor(s.materials/1000)));
});
