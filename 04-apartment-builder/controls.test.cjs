const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(fits=()=>true){
  const listeners={},rootListeners={},actions={},classes=new Set(),bodyClasses=new Set();
  const frames=new Map();let nextFrame=0;
  const classList=set=>({contains:key=>set.has(key),add:key=>set.add(key),remove:key=>set.delete(key)});
  const root={classList:classList(classes),addEventListener(name,fn){rootListeners[name]=fn;},querySelector(){return null;},querySelectorAll(){return [];}};
  const document={fullscreenElement:null,body:{classList:classList(bodyClasses)},addEventListener(name,fn){listeners[name]=fn;}};
  const navigation={spawn(s){s.walker={position:[1,2],phase:0};return s.walker;},move(s,side,forward){s.movement=[side,forward];return true;}};
  const context=vm.createContext({document,requestAnimationFrame(fn){frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame(id){frames.delete(id);},ApartmentNavigation:navigation,Game:{root,dialog:{open:false},init(config){actions.perform=config.onAction;}},ApartmentRoom:{pieces:{desk:{title:'Стол'},bed:{title:'Кровать'},sofa:{title:'Диван'}},fits},ApartmentPlans:{plans:[]},ApartmentScenarios:{suggestion:()=>[0,0]}});
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'script.js'),'utf8'),context);
  vm.runInContext('state={rotations:{},placed:{},ghost:null};selected="desk";selectionMode="place";scene={schedule(){},hit(){return null},pixelToFloor(){return [1,2]}};refresh=()=>{};',context);
  const run=code=>vm.runInContext(code,context);
  return {run,root,document,listeners,rootListeners,actions,frames};
}

test('R and the physical R key in Russian layout rotate in 90-degree steps',()=>{
  const {run,listeners}=setup();
  const press=(key,code,extra={})=>listeners.keydown({key,code,target:{closest:()=>null},preventDefault(){},...extra});
  press('к','KeyR');assert.equal(run('state.rotations.desk'),1);
  press('R','KeyR');assert.equal(run('state.rotations.desk'),2);
  press('r','KeyR',{repeat:true});assert.equal(run('state.rotations.desk'),2);
  press('r','KeyR',{ctrlKey:true});assert.equal(run('state.rotations.desk'),2);
  press('r','KeyR',{target:{closest:()=>({})}});assert.equal(run('state.rotations.desk'),2);
  press('r','KeyR');press('r','KeyR');assert.equal(run('state.rotations.desk'),0);
});

test('Placed furniture cannot be rotated into an obstacle',()=>{
  const {run}=setup(()=>false);
  run('state.placed.desk=[0,0];rotateSelected()');
  assert.equal(run('state.rotations.desk'),undefined);
  assert.match(run('status'),/Сначала подвиньте/);
});

test('Fullscreen enters and exits through the native API',async()=>{
  const {run,root,document}=setup();
  root.requestFullscreen=async()=>{document.fullscreenElement=root;};
  document.exitFullscreen=async()=>{document.fullscreenElement=null;};
  await run('toggleFullscreen()');assert.equal(document.fullscreenElement,root);
  await run('toggleFullscreen()');assert.equal(document.fullscreenElement,null);
});

test('Unsupported or denied fullscreen falls back to viewport mode and exits on Escape',async()=>{
  const {run,root,listeners}=setup();
  root.requestFullscreen=async()=>{throw new Error('unsupported');};
  run('selected=null;selectionMode=null');
  await run('toggleFullscreen()');assert.equal(run('isFullscreen()'),true);
  listeners.keydown({key:'Escape'});assert.equal(run('isFullscreen()'),false);
});

function canvasSetup(){
  const result=setup();
  const canvas={matches:selector=>selector==='.room-canvas',setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};
  canvas.closest=selector=>selector==='canvas'?canvas:null;
  result.root.querySelector=selector=>selector==='.furniture-context'?null:canvas;
  result.run('scene.rotate=(dx,dy)=>{state.cameraDelta=[dx,dy]};drop=()=>{state.dropped=true};movePreview=()=>[1,2];');
  return {...result,canvas};
}

test('Left-button orbit works with selected furniture and never drops it, even after returning to start',()=>{
  const {run,rootListeners,canvas}=canvasSetup();
  rootListeners.pointerdown({button:0,pointerId:7,clientX:100,clientY:100,target:canvas});
  rootListeners.pointermove({pointerId:7,clientX:150,clientY:125});
  assert.equal(run('state.cameraDelta[0]'),-.4);
  assert.equal(run('state.cameraDelta[1]'),.15);
  rootListeners.pointermove({pointerId:7,clientX:100,clientY:100});
  rootListeners.pointerup({pointerId:7,clientX:100,clientY:100});
  assert.equal(run('gesture'),null);
  assert.equal(run('state.dropped'),undefined);
});

test('Short left click places furniture; large release displacement does not',()=>{
  const {run,rootListeners,canvas}=canvasSetup();
  rootListeners.pointerdown({button:0,pointerId:7,clientX:100,clientY:100,target:canvas});
  rootListeners.pointerup({pointerId:7,clientX:103,clientY:100});
  assert.equal(run('state.dropped'),true);
  run('state.dropped=false');
  rootListeners.pointerdown({button:0,pointerId:8,clientX:100,clientY:100,target:canvas});
  rootListeners.pointerup({pointerId:8,clientX:150,clientY:100});
  assert.equal(run('state.dropped'),false);
});

test('Wheel zoom needs no modifier and does not intercept sidebar scrolling',()=>{
  const {run,root,rootListeners}=setup();
  root.querySelector=()=>({getBoundingClientRect:()=>({left:40,top:80,width:800,height:600})});
  run('scene.scaleBy=(amount,x,y)=>{state.zoomDelta=amount;state.zoomAnchor=[x,y]};');
  let prevented=false;
  rootListeners.wheel({target:{matches:()=>true},clientX:240,clientY:230,deltaY:-100,deltaMode:0,preventDefault(){prevented=true;}});
  assert.ok(prevented);
  assert.equal(run('state.zoomDelta'),.2);
  assert.equal(run('state.zoomAnchor[0]'),200);
  assert.equal(run('state.zoomAnchor[1]'),150);
  rootListeners.wheel({target:{matches:()=>false},deltaY:100,preventDefault(){throw Error('sidebar scroll intercepted');}});
  assert.equal(run('state.zoomDelta'),.2);
});

test('Middle-button drag pans without rotating or moving furniture',()=>{
  const {run,rootListeners}=setup();
  run('scene.pan=(dx,dy)=>{state.panDelta=[dx,dy]};scene.rotate=()=>{throw Error("unexpected rotation")};');
  const canvas={matches:()=>true,closest:()=>null,setPointerCapture(){}};
  rootListeners.pointerdown({button:1,pointerId:9,clientX:100,clientY:100,target:canvas,preventDefault(){}});
  rootListeners.pointermove({pointerId:9,clientX:150,clientY:70});
  assert.equal(run('state.panDelta[0]'),50);
  assert.equal(run('state.panDelta[1]'),-30);
  rootListeners.pointerup({pointerId:9,clientX:150,clientY:70});
  assert.equal(run('gesture'),null);
  assert.equal(run('Object.keys(state.placed).length'),0);
});

test('Right mouse button does not start camera gestures',()=>{
  const {run,rootListeners,canvas}=canvasSetup();
  rootListeners.pointerdown({button:2,pointerId:7,clientX:100,clientY:100,target:canvas});
  assert.equal(run('gesture'),undefined);
  assert.equal(typeof rootListeners.contextmenu,'function');
});

test('Cancel placement clears the ghost and leaves existing furniture intact',()=>{
  const {run,actions}=setup();
  run('state.placed.bed=[4,5];selectPiece("desk")');
  assert.equal(run('selectionMode'),'place');
  assert.ok(run('state.ghost'));
  actions.perform('cancel-piece');
  assert.equal(run('selected'),null);
  assert.equal(run('state.ghost'),null);
  assert.equal(run('state.suggestion'),null);
  assert.equal(run('state.placed.bed[0]'),4);
});

test('Placement returns to free cursor and selecting an existing item creates no ghost',()=>{
  const {run}=setup();
  run('selectPiece("desk");drop([1,2])');
  assert.equal(run('selected'),null);
  assert.equal(run('state.ghost'),null);
  run('choose("desk")');
  assert.equal(run('selectionMode'),'edit');
  assert.equal(run('state.active'),'desk');
  assert.equal(run('state.ghost'),null);
});

test('Replacement keeps position and rotation, and never overwrites existing furniture',()=>{
  const {run}=setup();
  run('state.placed.desk=[1,2];state.rotations.desk=1;contextTarget="desk";replacePiece("sofa")');
  assert.equal(run('state.placed.desk'),undefined);
  assert.equal(run('state.placed.sofa[0]'),1);
  assert.equal(run('state.rotations.sofa'),1);
  assert.equal(run('selected'),'sofa');
  run('state.placed.bed=[9,9];contextTarget="sofa";replacePiece("bed")');
  assert.equal(run('state.placed.sofa[0]'),1);
  assert.equal(run('state.placed.bed[0]'),9);
});

test('Invalid replacement leaves the original untouched; deletion returns a free cursor',()=>{
  const {run,actions}=setup(()=>false);
  run('state.placed.desk=[1,2];contextTarget="desk";replacePiece("sofa")');
  assert.equal(run('state.placed.desk[0]'),1);
  assert.equal(run('state.placed.sofa'),undefined);
  actions.perform('delete-piece');
  assert.equal(run('state.placed.desk'),undefined);
  assert.equal(run('selected'),null);
});

test('Click outside the menu closes it and consumes the click without changing furniture',()=>{
  const {run,root,listeners}=setup();
  let removed=false,stopped=0;
  const menu={contains:()=>false,remove(){removed=true;}};
  root.querySelector=()=>menu;
  run('state.placed.desk=[1,2];contextTarget="desk"');
  listeners.pointerdown({target:{},preventDefault(){},stopPropagation(){stopped++;}});
  assert.ok(removed);
  assert.equal(run('contextTarget'),null);
  assert.equal(run('state.placed.desk[0]'),1);
  listeners.click({preventDefault(){},stopPropagation(){stopped++;}});
  assert.equal(stopped,2);
});

test('Dragging placed furniture commits its position and returns to edit mode',()=>{
  const {run,rootListeners,canvas}=canvasSetup();
  run('selectionMode=null;selected=null;state.placed.desk=[2,3];scene.hit=()=>"desk";scene.pixelToFloor=()=>[2,3];');
  rootListeners.pointerdown({button:0,pointerId:4,clientX:100,clientY:100,target:canvas});
  assert.equal(run('selectionMode'),'edit');
  assert.equal(run('state.ghost'),null);
  rootListeners.pointermove({pointerId:4,clientX:140,clientY:100});
  assert.equal(run('gesture.type'),'move-object');
  rootListeners.pointerup({pointerId:4,clientX:140,clientY:100});
  assert.equal(run('state.dropped'),true);
});

test('R can select and rotate hovered furniture with a free cursor',()=>{
  const {run,listeners}=setup();
  run('selectPiece(null);state.placed.desk=[1,2];state.hovered="desk"');
  listeners.keydown({key:'r',code:'KeyR',target:{closest:()=>null},preventDefault(){}});
  assert.equal(run('selected'),'desk');
  assert.equal(run('selectionMode'),'edit');
  assert.equal(run('state.rotations.desk'),1);
  assert.equal(run('state.ghost'),null);
});

test('Walking preserves furniture and buffered selection when toggled',()=>{
  const {run,actions}=setup();
  run('state.placed.bed=[4,5];selectPiece("desk");scene.setWalk=()=>{};scene.setView=()=>{};');
  actions.perform('walk-mode');
  assert.equal(run('state.walking'),true);
  assert.equal(run('selected'),'desk');
  assert.equal(run('selectionMode'),'place');
  actions.perform('walk-mode');
  assert.equal(run('state.walking'),false);
  assert.equal(run('state.placed.bed[0]'),4);
});

test('WASD moves the character while furniture is selected, key release and blur stop movement',()=>{
  const {run,listeners,frames}=setup();
  run('state.walking=true;state.walker={position:[0,0],phase:0};scene.walkAngle=()=>0;');
  const event={key:'ц',code:'KeyW',target:{closest:()=>null},preventDefault(){}};
  listeners.keydown(event);
  frames.get(run('walkFrame'))(16);
  assert.equal(run('state.movement[1]'),1);
  assert.equal(run('selected'),'desk');
  listeners.keyup(event);
  frames.get(run('walkFrame'))(32);
  assert.equal(run('walkFrame'),0);
  assert.equal(run('state.movement[1]'),0);
  listeners.keydown(event);listeners.visibilitychange();
  assert.equal(run('walkKeys.size'),0);
  assert.equal(run('walkFrame'),0);
});

test('Wall and floor colors are independent and validated',()=>{
  const {run,actions,rootListeners}=setup();
  actions.perform('surface','wallColor:#aabbcc');
  actions.perform('surface','floorColor:#112233');
  assert.equal(run('state.wallColor'),'#aabbcc');
  assert.equal(run('state.floorColor'),'#112233');
  rootListeners.input({target:{dataset:{surface:'floorColor'},value:'#445566'}});
  assert.equal(run('state.floorColor'),'#445566');
  assert.equal(run('state.wallColor'),'#aabbcc');
  actions.perform('surface','floorColor:invalid');
  assert.equal(run('state.floorColor'),'#445566');
});
