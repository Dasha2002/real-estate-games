const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const A=require('./engine.js');

function setup(){
  const handlers={},frames=[];
  const element=(dataset={})=>({dataset,classList:{toggle(){}},setAttribute(){},focus(){},scrollIntoView(){},setPointerCapture(){}});
  const drive=[element({drive:'-1'}),element({drive:'1'})],lanes=[element({value:'blue'}),element({value:'brown'})];
  const nodes=new Map();
  const root={addEventListener(name,fn){handlers[name]=fn;},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);},querySelectorAll(selector){return selector==='[data-drive]'?drive:selector==='[data-action="lane"]'?lanes:[];}};
  let config;
  const context=vm.createContext({MoveInArcade:A,MoveInScene:{mount(){return {draw(){},destroy(){}};}},Game:{root,dialog:{open:false},action(){return '';},init(c){config=c;c.restart();}},document:{addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem(){return null;}},performance:{now(){return 0;}},requestAnimationFrame(fn){frames.push(fn);return frames.length;},cancelAnimationFrame(){},matchMedia(){return {matches:true};}});
  vm.runInContext(fs.readFileSync(__dirname+'/script.js','utf8'),context);
  config.onAction('start');
  const state=vm.runInContext('state',context);state.spawnIn=1000;
  function pointer(type,id,kind,index=0){
    const button=kind==='drive'?drive[index]:lanes[index];
    handlers[type]({type,pointerId:id,button:0,preventDefault(){},target:{closest(selector){return selector===(kind==='drive'?'[data-drive]':'[data-action="lane"]')?button:null;},matches(){return false;}}});
  }
  function tick(time){frames.shift()(time);}
  return {state,pointer,tick,config,context,root,handlers};
}

test('Touch movement keeps working while another finger changes lanes',()=>{
  const {state,pointer,tick}=setup();
  pointer('pointerdown',1,'drive',1);tick(100);assert.ok(state.player>.5);
  pointer('pointerdown',2,'lane',0);assert.equal(state.lane,'blue');
  const x=state.player;tick(200);assert.ok(state.player>x);
  pointer('pointerup',2,'lane',0);pointer('pointerup',1,'drive',1);
  const stopped=state.player;tick(300);assert.equal(state.player,stopped);
});
for(const release of ['pointercancel','lostpointercapture'])test(`${release} releases a held direction`,()=>{
  const {state,pointer,tick}=setup();pointer('pointerdown',1,'drive');tick(100);
  assert.ok(state.player<.5);pointer(release,1,'drive');const x=state.player;tick(200);assert.equal(state.player,x);
});
test('Pausing clears held touch directions before resume',()=>{
  const {state,pointer,tick,config}=setup();pointer('pointerdown',1,'drive');tick(100);
  config.onAction('pause');assert.equal(state.phase,'paused');config.onAction('resume');
  const x=state.player;tick(200);assert.equal(state.player,x);
});
test('New sessions default to the easy level',()=>{assert.equal(setup().state.level,'easy');});
test('Tapping the playfield delivers cargo without moving or changing lanes',()=>{
  const {state,handlers}=setup();state.cargo=[{lane:'blue',shape:'corner'}];
  const x=state.player,lane=state.lane;
  handlers.click({target:{closest(){return null;}}});
  assert.equal(state.cargo.length,0);assert.equal(state.submitted,3);assert.equal(state.deliveries.length,1);
  assert.equal(state.player,x);assert.equal(state.lane,lane);
  handlers.click({target:{closest(){return null;}}});assert.equal(state.deliveries.length,1);
});
test('Tapping buttons or their icons never triggers background delivery',()=>{
  const {state,handlers,pointer}=setup();state.cargo=[{lane:'brown',shape:'wide'}];
  pointer('pointerdown',1,'drive');pointer('pointerdown',2,'lane',0);
  for(const control of ['drive','lane','pause','nested-arrow'])handlers.click({target:{closest(){return {control};}}});
  assert.equal(state.cargo.length,1);assert.equal(state.submitted,0);
});
test('A background tap cannot submit while paused',()=>{
  const {state,handlers,config}=setup();state.cargo=[{lane:'brown',shape:'single'}];config.onAction('pause');
  handlers.click({target:{closest(){return null;}}});assert.equal(state.cargo.length,1);
});
test('A second finger can deliver while movement is held, without a duplicate synthetic click',()=>{
  const {state,handlers,pointer,tick}=setup();state.cargo=[{lane:'brown',shape:'single'}];
  pointer('pointerdown',1,'drive',1);
  const target={closest(){return null;},matches(){return true;}};
  handlers.pointerdown({pointerId:2,button:0,pointerType:'touch',clientX:200,clientY:100,target});
  handlers.pointerup({type:'pointerup',pointerId:2,clientX:202,clientY:102,target});
  assert.equal(state.submitted,1);assert.equal(state.deliveries.length,1);
  state.cargo=[{lane:'brown',shape:'single'}];handlers.click({target});
  assert.equal(state.cargo.length,1,'synthetic click does not submit the next cargo');
  const x=state.player;tick(100);assert.ok(state.player>x);
});
test('Touch targeting maps correctly after a 90-degree portrait rotation',()=>{
  const {context,root}=setup();
  const canvas=root.querySelector('canvas');canvas.clientWidth=600;canvas.clientHeight=300;
  canvas.getBoundingClientRect=()=>({left:20,top:50,right:320,width:300,height:600});
  let point;
  context.pick=(x,y,lane)=>{point=[x,y,lane];return {target:.6,lane:'brown'};};
  vm.runInContext('scene.targetAt=pick; pointerTarget({clientX:220,clientY:140},true)',context);
  assert.deepEqual(point,[90,100,true]);
  canvas.getBoundingClientRect=()=>({left:20,top:50,right:620,width:600,height:300});
  vm.runInContext('rotated=false; pointerTarget({clientX:110,clientY:150},true)',context);
  assert.deepEqual(point,[90,100,true]);
});
