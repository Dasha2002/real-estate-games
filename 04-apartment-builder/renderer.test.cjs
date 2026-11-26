const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(__dirname+'/assets/renderer.js','utf8'),context);
const R=vm.runInContext('ApartmentRenderer',context);
test('Concave floor triangulation preserves the outline and area',()=>{
  const p=[[0,0,0],[4,0,0],[4,0,2],[2,0,2],[2,0,4],[0,0,4]];
  for(const points of [p,[...p].reverse()]){
    const tris=R.triangulate(points);assert.equal(tris.length,4);
    const area=tris.reduce((sum,ids)=>{
      const [a,b,c]=ids.map(i=>points[i]);return sum+Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
    },0);
    assert.equal(area,12);
  }
});
test('Depth is evaluated at the pixel, including perspective, rather than averaged per face',()=>{
  const a=[[0,0,-1],[100,0,-10],[0,100,-10]],b=[[0,0,-5],[100,0,-5],[0,100,-5]];
  assert.ok(R.depthAt(a,5,5,true)>R.depthAt(b,5,5,true),'near pillow corner covers the surface behind it');
  assert.ok(R.depthAt(a,85,5,true)<R.depthAt(b,85,5,true),'distant part is hidden at the same camera angle');
  assert.ok(R.depthAt(a,5,5,false)>R.depthAt(b,5,5,false));
  assert.equal(R.depthAt(a,150,150,true),-Infinity);
});
test('Clip-space depth orders near/far surfaces consistently for both cameras',()=>{
  const project=(z,perspective)=>{const c=R.clipPosition([200,150,z],800,600,perspective);return c[2]/c[3];};
  assert.ok(project(-1,true)<project(-5,true));
  assert.ok(project(5,false)<project(1,false));
  const c=R.clipPosition([200,150,-3],800,600,true);
  assert.equal(c[0]/c[3],-.5);assert.equal(c[1]/c[3],.5);
});

test('GPU camera matrices match the existing perspective and plan projections',()=>{
  const width=1200,height=800;
  function multiply(m,p){return [0,1,2,3].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]);}
  function near(a,b){for(let i=0;i<4;i++)assert.ok(Math.abs(a[i]-b[i])<2e-5,`${a} != ${b}`);}
  for(const angle of [-1.2,0,1.8])for(const lift of [-.3,0,.7]){
    const ax=Math.cos(angle),az=Math.sin(angle),sy=Math.sin(lift),cy=Math.cos(lift),position=[1.2,-.7];
    const p=[position[0]-az*4,.8,position[1]-ax*4];
    const x=p[0]-position[0],y=p[1]-1.75,z=p[2]-position[1],u=x*ax-z*az,v=y*cy-(x*az+z*ax)*sy,d=-(x*az+z*ax)*cy-y*sy;
    const projected=[width/2+u*880/d,height*.48-v*880/d,-d];
    near(multiply(R.cameraMatrix({width,height,angle,lift,walking:true,position}),p),R.clipPosition(projected,width,height,true));
    const scale=57,ox=630,oy=470,depth=p[0]*az+p[2]*ax;
    const ortho=[ox+(p[0]*ax-p[2]*az)*scale,oy+(depth*sy-p[1]*cy)*scale,depth*cy+p[1]*sy];
    near(multiply(R.cameraMatrix({width,height,angle,lift,scale,ox,oy}),p),R.clipPosition(ortho,width,height,false));
  }
});
test('GPU submits opaque geometry with depth writes, then glass without depth writes, and renders shadows separately',()=>{
  const calls=[],attachments=[],clears=[],enabled=new Set();let writes=true,framebuffer=null,program=null;
  const gl=new Proxy({}, {get(_target,key){
    if(key==='getShaderParameter'||key==='getProgramParameter')return ()=>true;
    if(key==='checkFramebufferStatus')return ()=>'FRAMEBUFFER_COMPLETE';
    if(key==='getAttribLocation')return ()=>0;
    if(key==='getUniformLocation')return (_p,name)=>name;
    if(key==='getExtension')return ()=>null;
    if(key==='enable')return name=>enabled.add(name);
    if(key==='disable')return name=>enabled.delete(name);
    if(key==='depthMask')return value=>{writes=value;};
    if(key==='bindFramebuffer')return (_target,value)=>{framebuffer=value;};
    if(key==='useProgram')return value=>{program=value;};
    if(key==='framebufferRenderbuffer')return (_t,_a,_rt,depth)=>attachments.push({framebuffer,depth});
    if(key==='clear')return mask=>clears.push({framebuffer,mask});
    if(key==='drawArrays')return (_mode,_first,count)=>{calls.push({count,writes,framebuffer,program,depth:enabled.has('DEPTH_TEST')});};
    if(key.startsWith('create'))return ()=>({});
    if(key.toUpperCase()===key)return key;
    return ()=>{};
  }});
  const ctx=vm.createContext({document:{createElement(){return {getContext:()=>gl};}}});
  vm.runInContext(fs.readFileSync(__dirname+'/assets/renderer.js','utf8'),ctx);
  const renderer=vm.runInContext('ApartmentRenderer.create()',ctx);
  const world=[[0,.5,0],[1,.5,0],[0,1,0]],points=[[100,100,-2],[200,100,-2],[100,200,-2]];
  renderer.draw([{world,points,fill:'#abcdef',owner:'desk'},{world,points,fill:'#abcdef77'}],800,600,true,{width:800,height:600},'desk',[world]);
  assert.equal(calls.length,5);assert.ok(calls.slice(0,4).every(c=>c.depth));
  assert.ok(calls[0].framebuffer,'shadow map gets its own framebuffer');assert.equal(calls[0].count,3);
  assert.notEqual(calls[1].framebuffer,calls[0].framebuffer);assert.equal(calls[1].writes,true);assert.equal(calls[1].count,3);
  assert.equal(calls[2].writes,false);assert.equal(calls[2].count,3);
  assert.equal(calls[3].writes,false);assert.equal(calls[3].count,3,'only selected item enters the visible silhouette mask');
  assert.equal(attachments[1].depth,attachments[2].depth,'scene and selection share the same occlusion depth');
  assert.notEqual(attachments[0].depth,attachments[1].depth);
  assert.equal(clears.find(c=>c.framebuffer===calls[3].framebuffer).mask,'COLOR_BUFFER_BIT','mask keeps existing depth');
  assert.equal(calls[4].framebuffer,null);assert.equal(calls[4].depth,false);assert.equal(calls[4].count,6,'outline composites in screen space');
  renderer.destroy();
});

test('Complete furnished room produces finite GPU triangles; camera motion reuses its shadow map',()=>{
  let frame,draws=0,shadowDraws=0,framebuffer=null,largest=0,firstFramebuffer=null,currentProgram=null,programId=0,maskDraws=0,uploadedBytes=0;
  const gl=new Proxy({}, {get(_target,key){
    if(key==='getShaderParameter'||key==='getProgramParameter')return ()=>true;
    if(key==='checkFramebufferStatus')return ()=>'FRAMEBUFFER_COMPLETE';
    if(key==='getAttribLocation')return ()=>0;
    if(key==='getUniformLocation')return (_p,name)=>name;
    if(key==='getExtension')return ()=>null;
    if(key==='createProgram')return ()=>({id:++programId});
    if(key==='useProgram')return p=>{currentProgram=p;};
    if(key==='bindFramebuffer')return (_t,f)=>{framebuffer=f;if(f&&!firstFramebuffer)firstFramebuffer=f;};
    if(key==='bufferData')return (_t,data)=>{assert.ok(data.every(Number.isFinite),'all submitted attributes are finite');largest=Math.max(largest,data.length);uploadedBytes+=data.byteLength;};
    if(key==='drawArrays')return (_mode,_start,n)=>{assert.equal(n%3,0);draws++;if(framebuffer===firstFramebuffer)shadowDraws++;if(currentProgram.id===3)maskDraws++;};
    if(key.startsWith('create'))return ()=>({});
    if(key.toUpperCase()===key)return key;
    return ()=>{};
  }});
  const gradient={addColorStop(){}},ctx2d=new Proxy({}, {get(t,key){return key in t?t[key]:key==='createRadialGradient'?()=>gradient:()=>{};}});
  const ctx=vm.createContext({document:{createElement:()=>({getContext:()=>gl})},Image:class{},ResizeObserver:class{observe(){} disconnect(){}},devicePixelRatio:1,requestAnimationFrame(fn){frame=fn;}});
  for(const name of ['plans','furniture','renderer','room','navigation'])vm.runInContext(fs.readFileSync(__dirname+'/assets/'+name+'.js','utf8'),ctx);
  const {Room,Nav}=vm.runInContext('({Room:ApartmentRoom,Nav:ApartmentNavigation})',ctx);
  const state={plan:'family',palette:0,placed:{},rotations:{},walking:false,active:'desk#2',hovered:null};
  for(const key of ['bed','sofa','desk','desk#2','plant','wardrobe','tvStand','rug']){const p=Room.suggest(key,state);if(p)state.placed[key]=p;}
  assert.ok(state.placed.tvStand&&state.placed.rug,'new assets can be furnished into the room');
  assert.ok(state.placed.desk&&state.placed['desk#2'],'same furniture type renders as two independent instances');
  let marker;state.suggestion=state.placed['desk#2'];
  const scene=Room.mount({clientWidth:900,clientHeight:650,getContext:()=>ctx2d},()=>state,p=>{marker=p;});
  scene.setView(true);frame();assert.equal(shadowDraws,1);assert.ok(largest>10000);assert.equal(maskDraws,1,'active selection gets a silhouette');
  assert.equal(scene.hit(marker[0],marker[1]),'desk#2','picking uses the same world geometry as GPU rendering');
  const initialBytes=uploadedBytes;uploadedBytes=0;
  state.active=null;state.hovered='desk#2';
  scene.rotate(.8,.1);frame();assert.equal(shadowDraws,1,'moving camera does not rebuild static shadows');
  assert.equal(scene.hit(marker[0],marker[1]),'desk#2','picking follows the changed camera while buffers are reused');
  assert.equal(maskDraws,1,'hovering the last selected object does not leave its outline behind');
  assert.ok(uploadedBytes<initialBytes*.05,'camera motion reuses static GPU buffers instead of uploading the scene');
  state.walking=true;Nav.spawn(state);scene.setWalk(true);frame();assert.equal(shadowDraws,2,'full-height walls rebuild their shadows');
  scene.rotate(.3,.2);frame();assert.equal(shadowDraws,2);assert.ok(draws>=10);
  state.active='plant';state.carrying='plant';state.ghost={key:'plant',point:[0,0]};scene.schedule();frame();
  const carryingShadowCount=shadowDraws;uploadedBytes=0;
  state.ghost.point=[.2,.1];scene.schedule();frame();
  assert.equal(shadowDraws,carryingShadowCount,'moving only the preview reuses static shadows');
  assert.ok(uploadedBytes<initialBytes*.10,'carrying one object does not reupload the rest of the furniture');
  scene.destroy();
});

test('Translucent curtains stay behind furniture but composite over fixed radiators',()=>{
  let currentProgram,programId=0,stencilRef=null,stencilFunction=null;
  const enabled=new Set(),draws=[];
  const gl=new Proxy({}, {get(_t,key){
    if(key==='getShaderParameter'||key==='getProgramParameter')return ()=>true;
    if(key==='checkFramebufferStatus')return ()=>'FRAMEBUFFER_COMPLETE';
    if(key==='getAttribLocation')return ()=>0;
    if(key==='getUniformLocation')return (_p,n)=>n;
    if(key==='getExtension')return ()=>null;
    if(key==='createProgram')return ()=>({id:++programId});
    if(key==='useProgram')return p=>{currentProgram=p;};
    if(key==='enable')return x=>enabled.add(x);
    if(key==='disable')return x=>enabled.delete(x);
    if(key==='stencilFunc')return (f,r)=>{stencilFunction=f;stencilRef=r;};
    if(key==='drawArrays')return ()=>{if(currentProgram.id===2)draws.push({stencil:enabled.has('STENCIL_TEST'),depth:enabled.has('DEPTH_TEST'),ref:stencilRef,func:stencilFunction});};
    if(key.startsWith('create'))return ()=>({});
    if(key.toUpperCase()===key)return key;return ()=>{};
  }});
  const ctx=vm.createContext({document:{createElement:()=>({getContext:()=>gl})}});
  vm.runInContext(fs.readFileSync(__dirname+'/assets/renderer.js','utf8'),ctx);
  const renderer=vm.runInContext('ApartmentRenderer.create()',ctx),world=[[0,.5,0],[1,.5,0],[0,1,0]],points=[[100,100,-2],[200,100,-2],[100,200,-2]];
  const items=[['background','#aaaaaa'],['radiator','#eeeeee'],['interior','#bb7755'],['curtain','#eeeeee60']].map(([layerName,fill])=>({world,points,layerName,fill}));
  renderer.draw(items,800,600,true,{width:800,height:600},null,[world]);
  assert.equal(draws.length,5);
  assert.equal(draws[1].func,'ALWAYS');assert.equal(draws[1].ref,2,'radiator visibility is tagged separately');
  assert.equal(draws[2].func,'ALWAYS');assert.equal(draws[2].ref,1,'furniture visibility has priority');
  assert.deepEqual(draws.slice(3).map(d=>[d.func,d.ref,d.depth]),[['EQUAL',0,true],['EQUAL',2,false]],'cloth can cover background and radiators, never furniture pixels');
  renderer.destroy();
});
