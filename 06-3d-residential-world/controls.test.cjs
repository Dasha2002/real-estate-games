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
  return {state,pointer,tick,config};
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
