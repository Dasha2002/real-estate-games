const assert=require('node:assert/strict');
const Jump=require('./engine.js');

function arena(){
  const state=Jump.create(()=>.5);Jump.start(state);
  state.player={x:200,y:300,vy:0};state.maxHeight=300;
  state.platforms=[];state.materials=[];state.powerups=[];
  return state;
}
function load(state,x,y){
  const item={id:999,x,y,anchor:x,baseY:y,phase:0,destroyed:false};
  state.obstacles.push(item);return item;
}

for(const [name,x,y,vy] of [['side',230,328,0],['underside',200,370,500]]){
  const state=arena();state.player.vy=vy;load(state,x,y);
  Jump.advance(state,.02,0);
  assert.equal(state.phase,'failed',name+' contact must end the run');
}

const stomp=arena(),target=load(stomp,200,260);
stomp.player.y=280;stomp.player.vy=-300;
Jump.advance(stomp,.01,0);
assert.equal(stomp.phase,'running');assert.equal(target.destroyed,true);
assert.ok(stomp.player.vy>Jump.springSpeed-30,'Stomp rebounds with spring strength');
assert.equal(stomp.destroyed,1);assert.equal(stomp.bounces,1);
assert.equal(stomp.effects.length,1);
const stompScore=Jump.score(stomp);
Jump.advance(stomp,.05,0);assert.equal(stomp.destroyed,1,'A stomp cannot score twice');
assert.ok(Jump.score(stomp)>=stompScore);

for(const kind of Object.keys(Jump.boosts)){
  const protectedState=arena(),cargo=load(protectedState,200,328);
  protectedState.boost={kind,until:protectedState.time+1};
  Jump.advance(protectedState,.02,0);
  assert.equal(protectedState.phase,'running',kind+' protects from cargo contact');
  assert.equal(protectedState.boost.kind,kind,'Contact must not cancel the boost');
  assert.equal(cargo.destroyed,false,'Passing through does not destroy cargo');
  assert.equal(protectedState.destroyed,0);
  protectedState.player.y=300;protectedState.player.vy=0;
  protectedState.boost.until=protectedState.time;
  Jump.advance(protectedState,.01,0);
  assert.equal(protectedState.phase,'failed','Cargo becomes dangerous as soon as the boost expires');
}

const firing=arena(),shotTarget=load(firing,200,490);
assert.equal(Jump.shoot(firing),true);assert.equal(Jump.shoot(firing),false,'Rate limit');
assert.equal(firing.shots.length,1);
for(let i=0;i<10;i++)Jump.advance(firing,.02,0);
assert.equal(shotTarget.destroyed,true);assert.equal(firing.destroyed,1);
assert.equal(firing.phase,'running','Shooting destroys the load before contact');
assert.equal(firing.shots.length,0,'Hit projectile is consumed');
Jump.pause(firing);const frozenTime=firing.time;
assert.equal(Jump.shoot(firing),false);Jump.advance(firing,.1,0);
assert.equal(firing.time,frozenTime);
Jump.resume(firing);Jump.advance(firing,.1,0);assert.equal(Jump.shoot(firing),true);

const nearMiss=arena(),missed=load(nearMiss,330,440);
Jump.shoot(nearMiss);Jump.advance(nearMiss,.12,0);
assert.equal(missed.destroyed,false,'An unaligned shot does not destroy the load');
const initialX=missed.x,initialY=missed.y;Jump.advance(nearMiss,.1,0);
assert.ok(missed.x!==initialX&&missed.y!==initialY,'Load visibly hovers');

const scrolling=arena();scrolling.camera=2000;scrolling.player.y=2300;
load(scrolling,200,100);scrolling.shots.push({x:100,y:100,done:false});
Jump.advance(scrolling,.01,0);
assert.ok(scrolling.obstacles.every(item=>item.y>=scrolling.camera-170));
assert.ok(scrolling.shots.every(item=>item.y>=scrolling.camera-170));
assert.ok(scrolling.obstacles.length>0,'Loads are generated ahead during an endless run');
console.log('PASS: side/underside death, spring stomp, shot hit/miss, cooldown, pause, hovering and cleanup.');
