const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const A=require('./engine.js');
const context=vm.createContext({MoveInArcade:A});
vm.runInContext(fs.readFileSync(path.join(__dirname,'scene.js'),'utf8'),context);
const Scene=vm.runInContext('MoveInScene',context);

for(const [w,h] of [[1100,748],[375,363],[844,390]])test(`Perspective and mouse targeting agree on both planes: ${w}px`,()=>{
  const view=Scene.createView(w,h);
  const near=view.project(1,A.bedHeight,A.lanes.brown.z)[0]-view.project(0,A.bedHeight,A.lanes.brown.z)[0];
  const far=view.project(1,A.bedHeight,A.lanes.blue.z)[0]-view.project(0,A.bedHeight,A.lanes.blue.z)[0];
  assert.ok(near>far,'near objects look bigger');
  assert.ok(view.project(0,0,A.lanes.brown.z)[1]>view.project(0,0,A.lanes.blue.z)[1]);
  for(const lane of ['blue','brown'])for(const target of [.15,.5,.82]){
    const point=view.project((target-.5)*A.fieldWidth,A.bedHeight,A.lanes[lane].z+.43);
    assert.ok(Math.abs(view.targetAt(point[0],lane)-target)<1e-9,'pointer resolves to the same world position');
  }
});

test('Perspective renderer draws empty/full pickups on both planes with a bounded backing store',()=>{
  const gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get:(object,key)=>key in object?object[key]:()=>gradient});
  const c=vm.createContext({MoveInArcade:A,ResizeObserver:class{observe(){} disconnect(){}},devicePixelRatio:2});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'scene.js'),'utf8'),c);
  const sceneAPI=vm.runInContext('MoveInScene',c),state=A.create();
  const canvas={clientWidth:1920,clientHeight:1080,getContext:()=>ctx};
  const scene=sceneAPI.mount(canvas,()=>state);
  for(const lane of ['blue','brown'])for(const count of [0,A.capacity]){
    state.lane=lane;state.cargo=Array.from({length:count},(_,i)=>({lane:i%2?'blue':'brown',shape:'single'}));
    state.falling=[{type:'material',lane,shape:'wide',x:.2,progress:.5},{type:'hazard',lane,shape:'single',x:.8,progress:.9}];
    assert.doesNotThrow(()=>scene.draw(state));
  }
  assert.ok(canvas.width*canvas.height<=1200000+2000);
  scene.destroy();
});

test('Bomb impact draws a brief flash and rising smoke, then expires',()=>{
  let arcs=0;
  const ctx=new Proxy({}, {get:(o,k)=>k==='arc'?()=>{arcs++;}:['createLinearGradient','createRadialGradient'].includes(k)?()=>({addColorStop(){}}):k in o?o[k]:()=>{}});
  const c=vm.createContext({MoveInArcade:A,ResizeObserver:class{observe(){} disconnect(){}},devicePixelRatio:1});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'scene.js'),'utf8'),c);
  const state=A.create(),canvas={clientWidth:1000,clientHeight:680,getContext:()=>ctx};
  const scene=vm.runInContext('MoveInScene',c).mount(canvas,()=>state);
  scene.draw(state);const baseline=arcs;
  state.impact={at:0,x:.4,lane:'blue'};
  for(const age of [.1,.5]){arcs=0;state.elapsed=age;scene.draw(state);assert.ok(arcs>baseline);}
  arcs=0;state.elapsed=1.2;scene.draw(state);assert.equal(arcs,baseline);
});
