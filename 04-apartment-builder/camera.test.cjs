const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function camera(){
  const context=vm.createContext({
    Image:class {},ResizeObserver:class {observe(){} disconnect(){}},requestAnimationFrame(){}
  });
  for(const name of ['plans','furniture','room'])vm.runInContext(fs.readFileSync(path.join(__dirname,'assets',name+'.js'),'utf8'),context);
  const Room=vm.runInContext('ApartmentRoom',context);
  return Room.mount({clientWidth:800,clientHeight:600,getContext:()=>({})},()=>({}),()=>{});
}
function near(a,b){assert.ok(Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9,`${a} != ${b}`);}

test('Zoom keeps the floor point under the cursor stationary, including before redraw',()=>{
  const scene=camera();
  scene.pan(80,-45);scene.rotate(.8,.2);
  const before=scene.pixelToFloor(210,180);
  for(let i=0;i<20;i++)scene.scaleBy(.2,210,180);
  near(scene.pixelToFloor(210,180),before);
  for(let i=0;i<30;i++)scene.scaleBy(-.2,210,180);
  near(scene.pixelToFloor(210,180),before);
  scene.destroy();
});

test('Panning translates the scene by the mouse delta at any angle and zoom',()=>{
  const scene=camera();
  scene.rotate(3,.5);scene.scaleBy(1);
  const before=scene.pixelToFloor(300,200);
  scene.pan(90,-60);
  near(scene.pixelToFloor(390,140),before);
});

test('Standard views reset zoom and pan; projection remains finite at extreme angles',()=>{
  const scene=camera(),before=scene.pixelToFloor(300,200);
  scene.pan(500,-900);scene.scaleBy(2,250,50);scene.rotate(20,100);
  assert.ok(scene.pixelToFloor(300,200).every(Number.isFinite));
  scene.rotate(-30,-200);
  assert.ok(scene.pixelToFloor(300,200).every(Number.isFinite));
  scene.setView(false);
  near(scene.pixelToFloor(300,200),before);
});

test('Renderer draws highlighted furniture and placement previews without errors',()=>{
  let frame,transforms=0;
  const gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get(target,key){
    if(key in target)return target[key];
    if(key==='createRadialGradient'||key==='createLinearGradient')return ()=>gradient;
    if(key==='createPattern')return ()=>({});
    if(key==='transform')return (...matrix)=>{
      transforms++;assert.ok(matrix.every(Number.isFinite),'material projection stays finite');
      assert.ok(Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2])>1e-12,'material projection has two independent axes');
    };
    return ()=>{};
  }});
  const context=vm.createContext({
    Image:class {complete=true;naturalWidth=512;},ResizeObserver:class {observe(){} disconnect(){}},requestAnimationFrame(fn){frame=fn;},
    devicePixelRatio:1,Path2D:class {moveTo(){} lineTo(){} closePath(){}}
  });
  for(const name of ['plans','furniture','room'])vm.runInContext(fs.readFileSync(path.join(__dirname,'assets',name+'.js'),'utf8'),context);
  const Room=vm.runInContext('ApartmentRoom',context);
  const state={plan:'family',palette:0,wallColor:'#aabbcc',floorColor:'#bbaa99',rotations:{},placed:{},hovered:'desk',active:null};
  state.placed.desk=Room.suggest('desk',state);
  const scene=Room.mount({clientWidth:800,clientHeight:600,getContext:()=>ctx},()=>state,()=>{});
  scene.schedule();assert.doesNotThrow(()=>frame());
  assert.ok(transforms>0,'furniture uses textured materials');
  state.ghost={key:'desk',point:[0,0]};
  scene.schedule();assert.doesNotThrow(()=>frame());
  state.walking=true;state.walker={position:[0,0],phase:1,facing:0};
  scene.setWalk(true);assert.doesNotThrow(()=>frame());
  assert.equal(scene.pixelToFloor(400,0),null,'sky has no floor intersection at eye level');
  const floorPoint=scene.pixelToFloor(400,500);
  assert.ok(floorPoint.every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(floorPoint[0],floorPoint[1])-1.75*660/(500-288))<1e-8,'floor ray starts at the player eye, without a follow-camera offset');
  scene.scaleBy(1);
  assert.deepEqual(scene.pixelToFloor(400,500),floorPoint,'zoom cannot move the camera out of the player');
  state.walker.position=[1,2];
  const moved=scene.pixelToFloor(400,500);
  assert.ok(Math.abs(moved[0]-floorPoint[0]-1)<1e-8&&Math.abs(moved[1]-floorPoint[1]-2)<1e-8,'camera follows player position exactly');
  scene.rotate(0,-.2);
  assert.equal(scene.pixelToFloor(400,0),null,'sky has no floor intersection');
  assert.ok(scene.pixelToFloor(400,500).every(Number.isFinite));
  scene.rotate(0,.6);
  assert.ok(scene.pixelToFloor(400,288),'player can look down');
  scene.rotate(3,.4);scene.scaleBy(.3);scene.schedule();
  assert.doesNotThrow(()=>frame());
});

test('Fullscreen render budget preserves CSS-coordinate furniture picking and culls offscreen faces',()=>{
  let frame,marker,paths=0,hitTests=0;
  class Shape{
    constructor(){this.points=[];paths++;}
    moveTo(x,y){this.points.push([x,y]);}lineTo(x,y){this.points.push([x,y]);}closePath(){}
  }
  const gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get(target,key){
    if(key==='createLinearGradient')return ()=>{throw Error('surface gradient was reintroduced');};
    if(key==='createRadialGradient')return ()=>gradient;
    if(key==='isPointInPath')return (shape,x,y)=>{
      hitTests++;let inside=false;const p=shape.points;
      for(let i=0,j=p.length-1;i<p.length;j=i++){
        if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;
      }
      return inside;
    };
    return key in target?target[key]:()=>{};
  }});
  const context=vm.createContext({Image:class{},Path2D:Shape,ResizeObserver:class{observe(){} disconnect(){}},requestAnimationFrame(fn){frame=fn;},devicePixelRatio:2});
  for(const name of ['plans','furniture','room'])vm.runInContext(fs.readFileSync(path.join(__dirname,'assets',name+'.js'),'utf8'),context);
  const Room=vm.runInContext('ApartmentRoom',context);
  const state={plan:'family',palette:0,rotations:{},placed:{}};
  state.placed.desk=Room.suggest('desk',state);state.suggestion=state.placed.desk;
  const canvas={clientWidth:1920,clientHeight:1080,getContext:()=>ctx};
  const scene=Room.mount(canvas,()=>state,point=>{marker=point;});
  scene.setView(true);scene.rotate(0,100);frame();
  assert.ok(canvas.width<1920,'scene resolution is bounded on Retina fullscreen');
  assert.ok(canvas.width*canvas.height<=1280*900+2000);
  assert.equal(scene.hit(marker[0],marker[1]),'desk','picking uses CSS pixels after downscaling');
  paths=0;hitTests=0;scene.pan(100000,100000);frame();
  assert.equal(paths,0,'offscreen faces never construct drawing/hit-test paths');
  assert.equal(scene.hit(500,500),undefined);
  assert.equal(hitTests,0);
});
