const {test}=require('node:test');
const assert=require('node:assert/strict');
const J=require('./engine.js');
function rng(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);}
// Check the bypass at finer resolution than the generator, including wrap and head height.
function checkBypass(hazard){
  const path=hazard.safeRoute;assert.ok(path?.length>=3);
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dy=b.y-a.y,disc=a.speed*a.speed-2*J.gravity*dy;
    assert.ok(disc>=0&&dy>0);
    const duration=(a.speed+Math.sqrt(disc))/J.gravity,period=J.width+30;
    let dx=b.x-a.x;
    if(a.y>=J.base+50*J.floorHeight&&Math.abs(dx)>period/2)dx-=Math.sign(dx)*period;
    assert.ok(Math.abs(dx)/duration<=J.moveSpeed-72+.001);
    for(let frame=0;frame<=200;frame++){
      const t=duration*frame/200,y=a.y+a.speed*t-J.gravity*t*t/2;
      let x=a.x+dx*frame/200;
      if(a.y>=J.base+50*J.floorHeight)x=((x+15)%period+period)%period-15;
      assert.ok(!(Math.abs(x-hazard.anchor)<52&&y<hazard.baseY+25&&y+58>hazard.baseY-25),
        'bypass clears cargo over its full oscillation envelope');
    }
  }
}
function stack(moving=false){
  const s=J.create(rng(3));J.start(s);s.camera=7800;s.maxHeight=8200;
  s.player={x:70,y:8200,vy:0};s.nextY=10000;s.nextX=200;
  s.platforms=[8000,8110,8230,8350].map((y,i)=>({id:i,route:i,x:200,anchor:200,y,w:88,
    type:moving?'moving':'normal',hard:moving,amplitude:20,speed:6,phase:0,broken:false}));
  s.obstacles=[{id:999,x:200,anchor:200,y:8170,baseY:8170,phase:0,pending:true,destroyed:false}];
  s.materials=[];s.powerups=[];return s;
}
test('Cargo threatens a vertical stack, while a safe route stays available',()=>{
  const s=stack();J.advance(s,.001);assert.equal(s.obstacles.length,1);
  const o=s.obstacles[0];assert.ok(Math.abs(o.anchor-200)<=52);
  assert.ok(o.safeRoute.some(p=>Math.abs(p.x-o.anchor)>=55));checkBypass(o);
});
test('A moving vertical stack gets an additional moving side platform when needed',()=>{
  const s=stack(true);J.advance(s,.001);assert.equal(s.obstacles.length,1);
  assert.ok(s.platforms.some(p=>p.detour&&p.type==='moving'));checkBypass(s.obstacles[0]);
});
test('Omit cargo if no reachable bypass can be constructed',()=>{
  const s=stack();s.platforms[2].y=8500;s.platforms[3].y=8650;
  J.advance(s,.001);assert.equal(s.obstacles.length,0);
});
test('A saved bypass is playable with live collision, wind and moving platforms, without shooting',()=>{
  for(const phase of [0,.8,1.6,2.4]){
    const s=stack(true);J.advance(s,.001);
    const obstacle=s.obstacles[0],path=obstacle.safeRoute;
    obstacle.phase=phase;
    for(const p of s.platforms)if(p.type==='moving')p.phase=phase;
    s.player.x=path[0].x;s.player.y=path[0].y;s.player.vy=path[0].speed;
    s.lastLandingY=path[0].y;
    for(let segment=1;segment<path.length;segment++){
      const a=path[segment-1],b=path[segment];
      const duration=(a.speed+Math.sqrt(a.speed*a.speed-2*J.gravity*(b.y-a.y)))/J.gravity;
      const bounces=s.bounces;
      for(let frame=0;frame<150&&s.bounces===bounces&&s.phase==='running';frame++){
        const dt=1/120,t=Math.min(duration,(frame+1)*dt);
        const goal=a.x+(b.x-a.x)*t/duration,error=goal-s.player.x-J.wind(s)*dt;
        const direction=error>J.moveSpeed*dt/2?1:error<-J.moveSpeed*dt/2?-1:0;
        J.advance(s,dt,direction);
      }
      assert.equal(s.phase,'running');assert.equal(s.lastLandingY,b.y);
    }
    assert.equal(s.destroyed,0,'the cargo was bypassed without shooting or stomping');
  }
});
test('Sixty seeds to floor 200 keep cargo near the route, distributed across the screen, with valid bypasses',()=>{
  let checked=0,near=0,detours=0;const bins=new Set();
  for(let seed=1;seed<=60;seed++){
    const s=J.create(rng(seed));J.start(s);
    for(let floor=35;floor<=200;floor+=2){
      s.player.y=J.base+floor*J.floorHeight;s.player.x=200;s.player.vy=0;
      s.boost={kind:'jetpack',until:s.time+1};J.advance(s,.001);
      for(const o of s.obstacles){
        if(o.pending)continue;checkBypass(o);checked++;bins.add(Math.floor(o.anchor/50));
        const p=s.platforms.find(p=>p.id===o.supportId);
        if(p&&Math.min(Math.abs(o.anchor-p.anchor),430-Math.abs(o.anchor-p.anchor))<=65)near++;
      }
      detours+=s.platforms.filter(p=>p.detour).length;
      for(const a of s.platforms)for(const b of s.platforms){
        if(a.id>=b.id||Math.abs(a.y-b.y)>=48)continue;
        const motion=(a.type==='moving'?a.amplitude:0)+(b.type==='moving'?b.amplitude:0);
        assert.ok(Math.abs(a.anchor-b.anchor)>=(a.w+b.w)/2+12+motion);
      }
    }
  }
  assert.ok(checked>500);assert.ok(detours>20);assert.ok(bins.size>=6);
  assert.ok(near/checked>.75,'cargo must challenge the route, not stay on the opposite edge');
});
