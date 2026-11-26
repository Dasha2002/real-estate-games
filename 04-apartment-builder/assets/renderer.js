'use strict';

// Hardware depth testing, perspective-correct materials and a directional shadow map.
const ApartmentRenderer=(()=>{
  function triangulate(points){
    if(points.length===3)return [[0,1,2]];
    // Ear clipping also handles the concave apartment outline (floor/ceiling).
    let normal=[0,0,0];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      normal[0]+=(a[1]-b[1])*(a[2]+b[2]);normal[1]+=(a[2]-b[2])*(a[0]+b[0]);normal[2]+=(a[0]-b[0])*(a[1]+b[1]);
    }
    const drop=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),axes=[0,1,2].filter(a=>a!==drop),p=points.map(v=>axes.map(a=>v[a]));
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const area=p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0),sign=area>=0?1:-1;
    if(p.every((a,i)=>cross(a,p[(i+1)%p.length],p[(i+2)%p.length])*sign>=-1e-12))return p.slice(1,-1).map((_,i)=>[0,i+1,i+2]);
    const ids=p.map((_,i)=>i),triangles=[];
    while(ids.length>3){
      let found=false;
      for(let j=0;j<ids.length;j++){
        const a=ids[(j+ids.length-1)%ids.length],b=ids[j],c=ids[(j+1)%ids.length];
        if(cross(p[a],p[b],p[c])*sign<=1e-12)continue;
        if(ids.some(k=>k!==a&&k!==b&&k!==c&&cross(p[a],p[b],p[k])*sign>=-1e-10&&cross(p[b],p[c],p[k])*sign>=-1e-10&&cross(p[c],p[a],p[k])*sign>=-1e-10))continue;
        triangles.push([a,b,c]);ids.splice(j,1);found=true;break;
      }
      if(!found){ // Degenerate, collinear seam vertices do not enclose area.
        for(let j=1;j<ids.length-1;j++)triangles.push([ids[0],ids[j],ids[j+1]]);
        return triangles;
      }
    }
    if(ids.length===3)triangles.push(ids);
    return triangles;
  }
  function clipPosition(projected,width,height,perspective){
    const [x,y,z]=projected,w=perspective?Math.max(.04,-z):1;
    const depth=perspective?(100+.04)/(100-.04)-2*100*.04/((100-.04)*w):-z/40;
    return [(x/width*2-1)*w,(1-y/height*2)*w,depth*w,w];
  }
  function depthAt(points,x,y,perspective){
    for(const ids of triangulate(points)){
      const [a,b,c]=ids.map(i=>points[i]);
      const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
      if(Math.abs(det)<1e-12)continue;
      const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det,t=1-u-v;
      if(u>=-1e-7&&v>=-1e-7&&t>=-1e-7)return perspective?-1/(u/-a[2]+v/-b[2]+t/-c[2]):u*a[2]+v*b[2]+t*c[2];
    }
    return -Infinity;
  }
  function cameraMatrix({width,height,angle,lift,walking=false,position=[0,0],scale=1,ox=width/2,oy=height*.6}){
    const ax=Math.cos(angle),az=Math.sin(angle),sy=Math.sin(lift),cy=Math.cos(lift);
    let rows;
    if(walking){
      const [x,z]=position,kx=Math.min(width,height)*2.2/width,ky=Math.min(width,height)*2.2/height,A=100.04/99.96,B=8/99.96;
      const u=[ax,0,-az,-x*ax+z*az],v=[-az*sy,cy,-ax*sy,x*az*sy+z*ax*sy-1.75*cy],d=[-az*cy,-sy,-ax*cy,x*az*cy+z*ax*cy+1.75*sy];
      rows=[u.map(q=>q*kx),v.map((q,i)=>q*ky+d[i]*.04),d.map((q,i)=>q*A-(i===3?B:0)),d];
    }else rows=[
      [ax*scale*2/width,0,-az*scale*2/width,ox*2/width-1],
      [-az*sy*scale*2/height,cy*scale*2/height,-ax*sy*scale*2/height,1-oy*2/height],
      [-az*cy/40,-sy/40,-ax*cy/40,0],[0,0,0,1]
    ];
    return new Float32Array([0,1,2,3].flatMap(c=>rows.map(r=>r[c])));
  }
  function create(){
    if(typeof document==='undefined'||!document.createElement)return null;
    const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{antialias:true,alpha:true,premultipliedAlpha:false});
    if(!gl)return null;
    function shader(type,source){
      const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;
    }
    function program(vertex,fragment){
      const p=gl.createProgram(),v=shader(gl.VERTEX_SHADER,vertex),f=shader(gl.FRAGMENT_SHADER,fragment);
      gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
    }
    const light=`vec3 lightPoint(vec3 p){return vec3((p.x+p.z)*.0707,(.58*p.x+.574*p.y-.58*p.z)*.10,(.4*p.x-.82*p.y-.4*p.z)*.06);}`;
    const shadowProgram=program(`attribute vec3 aWorld;${light}void main(){gl_Position=vec4(lightPoint(aWorld),1.);}`,`
      precision highp float;void main(){vec4 e=fract(gl_FragCoord.z*vec4(1.,255.,65025.,16581375.));e-=e.yzww*vec4(1./255.,1./255.,1./255.,0.);gl_FragColor=e;}`);
    const main=program(`
      attribute vec4 aClip;attribute vec3 aWorld;attribute vec4 aColor;attribute vec2 aUv;attribute float aMaterial;attribute vec3 aNormal;
      uniform mat4 uViewProjection;uniform float uWorldProjection;
      varying vec3 vWorld;varying vec4 vColor;varying vec2 vUv;varying float vMaterial;varying vec3 vNormal;
      void main(){gl_Position=uWorldProjection>.5?uViewProjection*vec4(aWorld,1.):aClip;vWorld=aWorld;vColor=aColor;vUv=aUv;vMaterial=aMaterial;vNormal=aNormal;}`,`
      precision highp float;varying vec3 vWorld;varying vec4 vColor;varying vec2 vUv;varying float vMaterial;varying vec3 vNormal;
      uniform sampler2D uShadow;uniform sampler2D uWood;uniform sampler2D uLinen;${light}
      float readDepth(vec2 uv){return dot(texture2D(uShadow,uv),vec4(1.,1./255.,1./65025.,1./16581375.));}
      void main(){
        vec3 lp=lightPoint(vWorld)*.5+.5;float shade=0.;
        for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
          shade+=lp.z-.0018>readDepth(lp.xy+vec2(float(x),float(y))/1536.)?1.:0.;
        }
        if(lp.x<0.||lp.y<0.||lp.x>1.||lp.y>1.)shade=0.;
        vec3 color=vColor.rgb;
        float diffuse=length(vNormal)>.1?max(0.,dot(normalize(vNormal),normalize(vec3(-.4,.82,.4)))):1.;
        if(length(vNormal)>.1)color*=.76+.24*diffuse;
        if(vMaterial>.5&&vMaterial<1.5)color*=mix(vec3(1.),texture2D(uWood,vUv).rgb*1.5,.28);
        if(vMaterial>1.5&&vMaterial<2.5)color*=mix(vec3(1.),texture2D(uLinen,vUv).rgb*1.4,.24);
        if(vMaterial>2.5){
          float weave=dot(texture2D(uLinen,vUv).rgb,vec3(.2126,.7152,.0722));
          color=vec3((.94+.06*diffuse)*(.97+.03*weave));
        }
        gl_FragColor=vec4(color*(1.-shade*(vMaterial>2.5?.006:.028)),vColor.a);
      }`);
    const maskProgram=program('attribute vec4 aClip;uniform mat4 uViewProjection;uniform float uWorldProjection;void main(){gl_Position=uWorldProjection>.5?uViewProjection*vec4(aClip.xyz,1.):aClip;}','precision mediump float;void main(){gl_FragColor=vec4(1.);}');
    const compositeProgram=program(`attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`,`
      precision mediump float;varying vec2 vUv;uniform sampler2D uScene;uniform sampler2D uMask;uniform vec2 uPixel;
      void main(){
        vec4 base=texture2D(uScene,vUv);float center=texture2D(uMask,vUv).r,outer=center;
        for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)outer=max(outer,texture2D(uMask,vUv+vec2(float(x),float(y))*uPixel).r);
        float edge=clamp(outer-center,0.,1.);
        gl_FragColor=mix(base,vec4(1.,.79,.12,1.),edge);
      }`);
    const buffers=[gl.createBuffer(),gl.createBuffer(),gl.createBuffer()],textures=[];
    function texture(unit){
      const t=gl.createTexture();textures.push(t);gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([220,214,199,255]));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      return t;
    }
    const shadow=texture(0),wood=texture(1),linen=texture(2),size=1536;
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadow);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    const framebuffer=gl.createFramebuffer(),depth=gl.createRenderbuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadow,0);
    gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,size,size);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Shadow framebuffer incomplete');
    const sceneTexture=texture(3),maskTexture=texture(4),sceneFramebuffer=gl.createFramebuffer(),maskFramebuffer=gl.createFramebuffer(),sceneDepth=gl.createRenderbuffer();
    let targetWidth=0,targetHeight=0;
    function resizeTargets(width,height){
      if(targetWidth===width&&targetHeight===height)return;
      targetWidth=width;targetHeight=height;
      gl.bindRenderbuffer(gl.RENDERBUFFER,sceneDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_STENCIL,width,height);
      for(const [unit,t,f] of [[3,sceneTexture,sceneFramebuffer],[4,maskTexture,maskFramebuffer]]){
        gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,sceneDepth);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Scene framebuffer incomplete');
      }
    }
    const uploaded=new WeakSet();
    let previousShadowKey=null;
    function upload(image,t,unit){
      if(!image?.complete||!image.naturalWidth||uploaded.has(image))return;
      gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.generateMipmap(gl.TEXTURE_2D);uploaded.add(image);
    }
    const colorCache=new Map(),gpuBatches=new Map(),uniformCache=new Map();
    const attributes=[['aClip',4],['aWorld',3],['aColor',4],['aUv',2],['aMaterial',1],['aNormal',3]].map(([name,size])=>({name,size,loc:gl.getAttribLocation(main,name)}));
    const maskLocation=gl.getAttribLocation(maskProgram,'aClip'),quadLocation=gl.getAttribLocation(compositeProgram,'aPosition');
    const quad=new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]);let quadUploaded=false;
    const kinds=['opaque','interior','radiator','curtains','transparentBack','transparent'];
    let cachedGeometry=null,cachedBatches=null,cachedTransparent=null,selectionCacheKey=null,selectionData=null,selectionCurtain=false;
    function uniform(p,name){let map=uniformCache.get(p);if(!map){map=new Map();uniformCache.set(p,map);}if(!map.has(name))map.set(name,gl.getUniformLocation(p,name));return map.get(name);}
    function color(hex){
      if(colorCache.has(hex))return colorCache.get(hex);
      if(!hex?.startsWith('#'))return [1,1,1,1];
      const c=[0,2,4,6].map((i)=>parseInt(hex.slice(i+1,i+3)||'ff',16)/255);colorCache.set(hex,c);return c;
    }
    function draw(items,width,height,perspective,images,selected,shadowCasters=[]){
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      resizeTargets(width,height);
      upload(images.wood,wood,1);upload(images.linen,linen,2);
      const worldProjection=Boolean(images.cameraMatrix),staticCount=images.staticCount??items.length;
      const dirty=!images.geometryKey||cachedGeometry!==images.geometryKey;
      const casters=[];
      const updateShadows=!images.shadowKey||previousShadowKey!==images.shadowKey;
      if(updateShadows)for(const caster of shadowCasters){const p=caster.points||caster;for(const tri of caster.triangles||triangulate(p))for(const i of tri)casters.push(...p[i]);}
      function kind(item){
        const c=color(item.fill),alpha=c[3]*(item.owner?.endsWith('-ghost')?.69:1);
        const layer=item.layerName||(item.owner?'interior':'background');
        return layer==='curtain'?'curtains':alpha<.98?(layer==='background'?'transparentBack':'transparent'):layer==='interior'?'interior':layer==='radiator'?'radiator':'opaque';
      }
      function append(item,target){
        const world=item.world;if(!world||world.length<3)return;
        const c=color(item.fill),alpha=c[3]*(item.owner?.endsWith('-ghost')?.69:1);
        const triangles=item.triangles||triangulate(world);
        for(const tri of triangles)for(const index of tri){
          const p=world[index],clip=worldProjection?[0,0,0,1]:clipPosition(item.points[index],images.width,images.height,perspective);
          const uv=item.uv?.[index]||[p[0]*1.8,p[2]*1.8];
          target.push(...clip,...p,c[0],c[1],c[2],alpha,...uv,item.material==='wood'?1:item.material==='linen'?2:item.material==='tulle'?3:0,...(item.normals?.[index]||[0,0,0]));
        }
      }
      if(dirty){
        const arrays=Object.fromEntries(kinds.map(k=>[k,[]]));cachedTransparent={curtains:[],transparentBack:[],transparent:[]};
        for(let i=0;i<staticCount;i++){const item=items[i],k=kind(item);if(k in cachedTransparent)cachedTransparent[k].push(item);else append(item,arrays[k]);}
        cachedBatches=Object.fromEntries(kinds.map(k=>[k,new Float32Array(arrays[k])]));cachedGeometry=images.geometryKey;
      }
      const dynamic=Object.fromEntries(kinds.map(k=>[k,[]]));
      function transparentDepth(item){const dir=images.depthVector;return item.world.reduce((s,p,i)=>s+(dir?p[0]*dir[0]+p[1]*dir[1]+p[2]*dir[2]:item.points[i][2]),0)/item.world.length;}
      for(const k of ['curtains','transparentBack','transparent']){
        const sorted=cachedTransparent[k].map(item=>({item,depth:transparentDepth(item)})).sort((a,b)=>a.depth-b.depth);
        for(const {item} of sorted)append(item,dynamic[k]);
      }
      for(let i=staticCount;i<items.length;i++)append(items[i],dynamic[kind(items[i])]);
      const transient=Object.fromEntries(kinds.map(k=>[k,new Float32Array(dynamic[k])]));
      const selectionKey=String(images.geometryKey)+'|'+selected;
      const selectionDirty=dirty||selectionCacheKey!==selectionKey||items.length>staticCount;
      if(selectionDirty){
        const selection=[];selectionCurtain=false;
        if(selected)for(const item of items){
          if(item.owner!==selected&&item.owner!==selected+'-ghost')continue;
          selectionCurtain=item.layerName==='curtain';
          for(const tri of item.triangles||triangulate(item.world))for(const i of tri)selection.push(...(worldProjection?[...item.world[i],1]:clipPosition(item.points[i],images.width,images.height,perspective)));
        }
        selectionData=new Float32Array(selection);selectionCacheKey=selectionKey;
      }
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.disable(gl.STENCIL_TEST);
      if(updateShadows){
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,size,size);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(shadowProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER,buffers[1]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(casters),gl.DYNAMIC_DRAW);
        const loc=gl.getAttribLocation(shadowProgram,'aWorld');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,12,0);gl.drawArrays(gl.TRIANGLES,0,casters.length/3);gl.disableVertexAttribArray(loc);
        previousShadowKey=images.shadowKey;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,sceneFramebuffer);gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clearStencil(0);gl.stencilMask(255);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);gl.useProgram(main);
      for(const [i,name] of ['uShadow','uWood','uLinen'].entries()){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,textures[i]);gl.uniform1i(uniform(main,name),i);}
      gl.uniform1f(uniform(main,'uWorldProjection'),worldProjection?1:0);
      if(worldProjection)gl.uniformMatrix4fv(uniform(main,'uViewProjection'),false,images.cameraMatrix);
      for(const a of attributes)gl.enableVertexAttribArray(a.loc);
      function submitBatch(data,key){
        if(!data.length)return;let batch=gpuBatches.get(key);
        if(!batch){batch={buffer:gl.createBuffer(),data:null};gpuBatches.set(key,batch);}
        gl.bindBuffer(gl.ARRAY_BUFFER,batch.buffer);
        if(batch.data!==data){gl.bufferData(gl.ARRAY_BUFFER,data,key.startsWith('static:')?gl.STATIC_DRAW:gl.DYNAMIC_DRAW);batch.data=data;}
        let offset=0;for(const a of attributes){gl.vertexAttribPointer(a.loc,a.size,gl.FLOAT,false,68,offset*4);offset+=a.size;}
        gl.drawArrays(gl.TRIANGLES,0,data.length/17);
      }
      function submit(k){submitBatch(cachedBatches[k],'static:'+k);submitBatch(transient[k],'dynamic:'+k);}
      submit('opaque');
      // Stencil records the visible surface class: furniture=1, fixed radiator=2.
      gl.enable(gl.STENCIL_TEST);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);
      gl.stencilFunc(gl.ALWAYS,2,255);submit('radiator');
      gl.stencilFunc(gl.ALWAYS,1,255);submit('interior');
      gl.stencilMask(0);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);gl.disable(gl.STENCIL_TEST);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      submit('transparentBack');
      if(cachedBatches.curtains.length||transient.curtains.length){
        gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0,255);submit('curtains');
        // Fabric covers a radiator even if their meshes intersect, but never furniture.
        gl.stencilFunc(gl.EQUAL,2,255);gl.disable(gl.DEPTH_TEST);submit('curtains');
        gl.enable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);
      }
      submit('transparent');gl.depthMask(true);
      for(const a of attributes)gl.disableVertexAttribArray(a.loc);
      // Reuse the scene depth, clearing only mask colour: hidden parts never enter the outline.
      gl.bindFramebuffer(gl.FRAMEBUFFER,maskFramebuffer);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.BLEND);gl.depthMask(false);
      if(selectionData.length){
        gl.useProgram(maskProgram);gl.bindBuffer(gl.ARRAY_BUFFER,buffers[0]);if(selectionDirty)gl.bufferData(gl.ARRAY_BUFFER,selectionData,gl.DYNAMIC_DRAW);
        gl.uniform1f(uniform(maskProgram,'uWorldProjection'),worldProjection?1:0);if(worldProjection)gl.uniformMatrix4fv(uniform(maskProgram,'uViewProjection'),false,images.cameraMatrix);
        const loc=maskLocation;gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,16,0);
        if(selectionCurtain){
          gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0,255);gl.drawArrays(gl.TRIANGLES,0,selectionData.length/4);
          gl.stencilFunc(gl.EQUAL,2,255);gl.disable(gl.DEPTH_TEST);gl.drawArrays(gl.TRIANGLES,0,selectionData.length/4);
          gl.enable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);
        }else gl.drawArrays(gl.TRIANGLES,0,selectionData.length/4);
        gl.disableVertexAttribArray(loc);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(compositeProgram);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      for(const [unit,t,name] of [[3,sceneTexture,'uScene'],[4,maskTexture,'uMask']]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(uniform(compositeProgram,name),unit);}
      const outlineWidth=Math.max(1.5,width/images.width*2.5);
      gl.uniform2f(uniform(compositeProgram,'uPixel'),outlineWidth/width,outlineWidth/height);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffers[2]);if(!quadUploaded){gl.bufferData(gl.ARRAY_BUFFER,quad,gl.STATIC_DRAW);quadUploaded=true;}
      const loc=quadLocation;gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,8,0);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(loc);
      return canvas;
    }
    return {draw,destroy(){buffers.forEach(b=>gl.deleteBuffer(b));gpuBatches.forEach(b=>gl.deleteBuffer(b.buffer));textures.forEach(t=>gl.deleteTexture(t));[framebuffer,sceneFramebuffer,maskFramebuffer].forEach(f=>gl.deleteFramebuffer(f));[depth,sceneDepth].forEach(d=>gl.deleteRenderbuffer(d));[main,shadowProgram,maskProgram,compositeProgram].forEach(p=>gl.deleteProgram(p));gl.getExtension('WEBGL_lose_context')?.loseContext();}};
  }
  return {create,triangulate,clipPosition,depthAt,cameraMatrix};
})();
