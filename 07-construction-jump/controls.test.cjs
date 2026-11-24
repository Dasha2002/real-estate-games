const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const Jump=require('./engine.js');
const handlers={root:{},window:{},document:{}};
const node={textContent:'',disabled:false,classList:{add(){},remove(){}},focus(){},setPointerCapture(){},setAttribute(){}};
const overlayClasses=new Set();
const overlay={innerHTML:'',hidden:false,classList:{add(...names){names.forEach(name=>overlayClasses.add(name))},remove(...names){names.forEach(name=>overlayClasses.delete(name))}}};
const canvas={...node,width:400,height:640,getContext(){return {setTransform(){}}}};
const root={innerHTML:'',querySelector(selector){return selector==='canvas'?canvas:selector==='#jump-overlay'?overlay:node},addEventListener(name,callback){handlers.root[name]=callback}};
const environment={ConstructionJump:Jump,ConstructionScene:{draw(){}},
  Game:{root,action(){return ''},init(options){options.restart()}},
  localStorage:{getItem(){return null},setItem(){}},performance:{now(){return 0}},
  requestAnimationFrame(){return 1},cancelAnimationFrame(){},
  window:{devicePixelRatio:1,addEventListener(name,callback){handlers.window[name]=callback}},
  document:{hidden:false,addEventListener(name,callback){handlers.document[name]=callback}}
};
vm.createContext(environment);vm.runInContext(fs.readFileSync(__dirname+'/script.js','utf8'),environment);
vm.runInContext('start()',environment);
const state=vm.runInContext('state',environment);
const key={code:'Space',preventDefault(){this.prevented=true}};
handlers.window.keydown(key);assert.equal(key.prevented,true);assert.equal(state.shots.length,1);
handlers.window.keyup(key);assert.equal(vm.runInContext("heldKeys.has('Space')",environment),false);
const fire={...node};
const pointer={pointerId:11,target:{closest(selector){return selector==='[data-shoot]'?fire:null}},preventDefault(){}};
handlers.root.pointerdown(pointer);assert.equal(vm.runInContext('shootPointers.size',environment),1);
state.time+=.3;vm.runInContext('tick(16)',environment);assert.equal(state.shots.length,2,'Holding touch fire shoots again');
handlers.root.pointerup(pointer);assert.equal(vm.runInContext('shootPointers.size',environment),0);
handlers.root.pointerdown(pointer);vm.runInContext('pause()',environment);
assert.equal(state.phase,'paused');assert.equal(vm.runInContext('shootPointers.size',environment),0);
const count=state.shots.length;handlers.window.keydown(key);assert.equal(state.shots.length,count);
vm.runInContext('resume()',environment);handlers.root.pointerdown(pointer);
handlers.root.pointercancel(pointer);assert.equal(vm.runInContext('shootPointers.size',environment),0);
state.camera=1000;state.player.y=900;
vm.runInContext('tick(100)',environment);assert.equal(state.phase,'failed');
assert.equal(overlay.hidden,true,'Result is not shown at the instant of failure');
const frozenTime=state.time;
vm.runInContext('finishTransition(250)',environment);assert.equal(overlay.hidden,true,'Short delay before dimming');
vm.runInContext('finishTransition(310)',environment);
assert.equal(overlay.hidden,false);assert.ok(overlayClasses.has('is-ending'));
assert.equal(overlay.innerHTML,'','Dimming precedes the result card');
vm.runInContext('finishTransition(850)',environment);
assert.ok(overlayClasses.has('is-result'));assert.ok(overlay.innerHTML.includes('jump-dialog result'));
assert.equal(state.time,frozenTime,'Gameplay is frozen during the transition');
vm.runInContext('restart();finishTransition(2000)',environment);
assert.equal(overlayClasses.has('is-result'),false,'A restart cancels the old transition');
console.log('PASS: keyboard/touch fire, pause, delayed dimming, result reveal and transition cancellation.');
