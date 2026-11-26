// CPU preparation benchmark, not browser FPS or GPU render time.
// node 04-apartment-builder/performance.bench.cjs [--out .tmp/result.json]
const fs=require('node:fs'),vm=require('node:vm'),{performance}=require('node:perf_hooks');
const results=[];
for(const count of [1,8,24]){
  let frame,programId=0,currentProgram=null,bytes=0,triangles=0;
  const gl=new Proxy({}, {get(_t,k){
    if(k==='getShaderParameter'||k==='getProgramParameter')return ()=>true;
    if(k==='checkFramebufferStatus')return ()=>'FRAMEBUFFER_COMPLETE';
    if(k==='getAttribLocation')return ()=>0;
    if(k==='getUniformLocation')return (_p,n)=>n;
    if(k==='getExtension')return ()=>null;
    if(k==='createProgram')return ()=>({id:++programId});
    if(k==='useProgram')return p=>{currentProgram=p;};
    if(k==='bufferData')return (_t,d)=>{bytes+=d.byteLength;};
    if(k==='drawArrays')return (_m,_s,n)=>{if(currentProgram.id===2)triangles+=n/3;};
    if(k.startsWith('create'))return ()=>({});
    if(k.toUpperCase()===k)return k;
    return ()=>{};
  }});
  const gradient={addColorStop(){}},ctx2d=new Proxy({}, {get(t,k){return k in t?t[k]:k==='createRadialGradient'?()=>gradient:()=>{};}});
  const context=vm.createContext({document:{createElement:()=>({getContext:()=>gl})},Image:class{},ResizeObserver:class{observe(){} disconnect(){}},devicePixelRatio:1,requestAnimationFrame(fn){frame=fn;}});
  for(const n of ['plans','furniture','renderer','room'])vm.runInContext(fs.readFileSync(__dirname+'/assets/'+n+'.js','utf8'),context);
  const Room=vm.runInContext('ApartmentRoom',context),state={plan:'family',palette:0,placed:{},rotations:{},walking:false};
  // Deliberately dense geometry stress scene; placement legality is not measured.
  for(let i=0;i<count;i++)state.placed[i?'sofa#'+(i+1):'sofa']=[(i%6-2.5)*1.1,(Math.floor(i/6)-1.5)*1.3];
  const scene=Room.mount({clientWidth:1280,clientHeight:800,getContext:()=>ctx2d},()=>state,()=>{});
  scene.schedule();frame();for(let i=0;i<3;i++){scene.rotate(.01,0);frame();}
  const times=[];let totalBytes=0,totalTriangles=0;
  for(let i=0;i<8;i++){
    bytes=0;triangles=0;const start=performance.now();scene.rotate(.01,0);frame();times.push(performance.now()-start);
    totalBytes+=bytes;totalTriangles+=triangles;
  }
  times.sort((a,b)=>a-b);
  results.push({sofas:count,cpuMedianMs:+((times[3]+times[4])/2).toFixed(2),trianglesPerFrame:Math.round(totalTriangles/8),uploadMiBPerFrame:+(totalBytes/8/1048576).toFixed(2)});
  scene.destroy();
}
console.log(JSON.stringify({measurement:'Node CPU preparation; WebGL calls mocked; not browser FPS',results},null,2));
const output=process.argv.indexOf('--out');if(output>=0)fs.writeFileSync(process.argv[output+1],JSON.stringify(results,null,2));
