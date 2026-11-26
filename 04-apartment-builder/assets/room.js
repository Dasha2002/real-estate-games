'use strict';

// The apartment, its furniture, and its pickable faces are rendered from the same 3D geometry.
const ApartmentRoom = (() => {
  const pieces = {
    sofa:{title:'Диван',size:[2.5,1.1],height:.83,type:'sofa',group:'Отдых'},
    loveseat:{title:'Компактный диван',size:[1.7,.95],height:.83,type:'sofa',group:'Отдых'},
    armchair:{title:'Кресло',size:[.88,.86],height:.83,type:'sofa',group:'Отдых'},
    coffee:{title:'Журнальный стол',size:[.9,.55],height:.43,type:'coffee',group:'Отдых'},
    bed:{title:'Двуспальная кровать',size:[1.85,2.15],height:1.05,type:'bed',group:'Спальня'},
    singleBed:{title:'Односпальная кровать',size:[1,2.05],height:1.05,type:'bed',group:'Спальня'},
    nightstand:{title:'Прикроватная тумба',size:[.48,.43],height:.5,type:'storage',group:'Спальня'},
    wardrobe:{title:'Шкаф',size:[1.5,.58],height:2.1,type:'storage',group:'Хранение'},
    dresser:{title:'Комод',size:[1.05,.46],height:.85,type:'storage',group:'Хранение'},
    bookcase:{title:'Стеллаж',size:[.85,.36],height:1.75,type:'shelf',group:'Хранение'},
    desk:{title:'Рабочий стол',size:[1.3,.7],height:1.1,type:'desk',group:'Столовая'},
    table:{title:'Обеденный стол',size:[1.55,1.2],height:.83,type:'table',group:'Столовая'},
    smallTable:{title:'Компактный стол',size:[1.05,.85],height:.83,type:'table',group:'Столовая'},
    plant:{title:'Растение',size:[.55,.55],height:1.1,type:'plant',group:'Декор'},
    curtain:{title:'Гардина со шторами',size:[2.2,.18],height:2.6,type:'curtain',group:'Декор'},
    tvStand:{title:'Тумба с телевизором',size:[1.7,.42],height:1.45,type:'tv',group:'Отдых'},
    rug:{title:'Ковёр',size:[2.4,1.7],height:.04,type:'rug',group:'Декор'}
  };
  const colors = [
    {wood:'#d8b78b',wall:'#c5d3ba',wallSide:'#91a184',fabric:['#ecd7bc','#c49d83','#9d776b'],accent:['#8b9c77','#63724f','#586447']},
    {wood:'#d2a894',wall:'#f6dedc',wallSide:'#c68780',fabric:['#e1aaa7','#b77177','#955063'],accent:['#e0ae85','#b58264','#987054']},
    {wood:'#b7b39d',wall:'#ededdd',wallSide:'#9da38c',fabric:['#d7e3c1','#a3b487','#778468'],accent:['#d9b39b','#b78d70','#967259']}
  ];
  function pieceType(id){return typeof id==='string'?id.split('#')[0]:id;}
  function pieceFor(id){return pieces[pieceType(id)];}
  const clamp = (value,min,max)=>Math.min(max,Math.max(min,value));
  const renderPixelBudget=1280*900;
  function screenBounds(points){
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const [x,y] of points){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    return {left,top,right,bottom};
  }
  function offscreen(bounds,width,height){return bounds.right<0||bounds.bottom<0||bounds.left>width||bounds.top>height;}
  function shade(hex,factor){
    return '#'+hex.slice(1,7).match(/../g).map(part=>Math.round(clamp(parseInt(part,16)*factor,0,255)).toString(16).padStart(2,'0')).join('')+hex.slice(7);
  }
  const {plans,contains} = ApartmentPlans;
  const wallMeshes=new WeakMap();
  const radiatorCache=new WeakMap();
  const floorCache=new WeakMap();
  function floorBoards(plan){
    if(floorCache.has(plan))return floorCache.get(plan);
    const boards=[],corners=plan.outline.map(p=>p[1]);
    // Split each board at outline corners, then intersect its horizontal bands
    // with inside intervals. This also handles the concave apartment notches.
    for(let z=-plan.depth/2,row=0;z<plan.depth/2;z+=.19,row++){
      const cuts=[z,...corners.filter(v=>v>z&&v<z+.19),z+.19].sort((a,b)=>a-b);
      for(let k=0;k<cuts.length-1;k++){
        const low=cuts[k],high=cuts[k+1];if(high-low<1e-8)continue;
        const mid=(low+high)/2,xs=[];
        for(let i=0;i<plan.outline.length;i++){
          const a=plan.outline[i],b=plan.outline[(i+1)%plan.outline.length];
          if((a[1]>mid)!==(b[1]>mid))xs.push(a[0]+(b[0]-a[0])*(mid-a[1])/(b[1]-a[1]));
        }
        xs.sort((a,b)=>a-b);
        for(let x=-plan.width/2-1.2+(row%3)*.4,column=0;x<plan.width/2;x+=1.2,column++)for(let i=0;i<xs.length;i+=2){
          const left=Math.max(x,xs[i]),right=Math.min(x+1.2,xs[i+1]);
          if(right-left>1e-8)boards.push({points:[[left,.014,low],[right,.014,low],[right,.014,high],[left,.014,high]],tone:(row+column)%5});
        }
      }
    }
    floorCache.set(plan,boards);return boards;
  }
  function windowThickness(plan,opening){
    const rect=[...plan.perimeter,...plan.walls].find(([x,z,w,d])=>(w>d)===opening.horizontal&&Math.abs((opening.horizontal?z:x)-opening.at)<.01);
    return rect?rect[opening.horizontal?3:2]:.2;
  }
  function glazedDoor(plan,w){return plan.doors.some(d=>d.horizontal===w.horizontal&&Math.abs(d.at-w.at)<.01&&d.from<=w.from+.01&&d.to>=w.to-.01);}
  function windowWalls(plan){return plan.windows.filter(w=>!glazedDoor(plan,w)).map(w=>{
    const mid=(w.from+w.to)/2,t=windowThickness(plan,w);
    return w.horizontal?[mid,w.at,w.to-w.from,t]:[w.at,mid,t,w.to-w.from];
  });}
  function windowMount(plan,w){
    const inward={top:1,bottom:-1,left:1,right:-1}[w.side],at=w.at+inward*(windowThickness(plan,w)/2+.12),mid=(w.from+w.to)/2;
    return {window:w,point:w.horizontal?[mid,at]:[at,mid],rotation:{top:0,bottom:2,left:3,right:1}[w.side],width:w.to-w.from+.28};
  }
  function curtainMount(point,state){
    const plan=floorPlan(state);let best=null,distance=.65;
    for(const w of plan.windows){
      if(glazedDoor(plan,w))continue;
      const mount=windowMount(plan,w),along=point[w.horizontal?0:1],across=w.horizontal?1:0;
      const delta=Math.hypot(point[across]-mount.point[across],Math.max(w.from-along,0,along-w.to));
      if(delta<distance){distance=delta;best=mount;}
    }
    return best;
  }
  function radiators(plan){
    if(radiatorCache.has(plan))return radiatorCache.get(plan);
    const result=plan.windows.filter(w=>!glazedDoor(plan,w)).map(w=>{
      const mount=windowMount(plan,w),width=clamp((w.to-w.from)*.72,.4,1.4),depth=.10,inward={top:1,bottom:-1,left:1,right:-1}[w.side];
      const at=w.at+inward*(windowThickness(plan,w)/2+.07),mid=(w.from+w.to)/2;
      return {point:w.horizontal?[mid,at]:[at,mid],rotation:mount.rotation,width,depth,
        bounds:w.horizontal?[mid,at,width,depth]:[at,mid,depth,width]};
    });
    radiatorCache.set(plan,result);return result;
  }
  function wallGeometry(plan,overhead=false,fullHeight=false){
    let cache=wallMeshes.get(plan);if(!cache){cache={};wallMeshes.set(plan,cache);}
    const mode=fullHeight?'full':overhead?'top':'cut';
    if(cache[mode])return cache[mode];
    const height=fullHeight?2.7:overhead?.13:1.35,rects=[...plan.perimeter,...plan.walls];
    // Extend only connected ends. Union removes duplicate faces at L/T/X joints;
    // free ends at doors and windows retain the original opening width.
    const joined=rects.map(([x,z,w,d],index)=>{
      const horizontal=w>d,r=horizontal?d/2:w/2;
      const ends=horizontal?[[x-w/2,z],[x+w/2,z]]:[[x,z-d/2],[x,z+d/2]];
      const extend=ends.map(([px,pz])=>rects.some(([ox,oz,ow,od],i)=>i!==index&&Math.abs(px-ox)<=ow/2+1e-7&&Math.abs(pz-oz)<=od/2+1e-7)?r:0);
      return horizontal?[x+(extend[1]-extend[0])/2,z,w+extend[0]+extend[1],d]:[x,z+(extend[1]-extend[0])/2,w,d+extend[0]+extend[1]];
    });
    const volumes=joined.map(rect=>({rect,low:0,high:height}));
    for(const o of plan.windows){
      const mid=(o.from+o.to)/2,len=o.to-o.from;
      const doorway=glazedDoor(plan,o),thickness=windowThickness(plan,o);
      if(!doorway)volumes.push({rect:o.horizontal?[mid,o.at,len,thickness]:[o.at,mid,thickness,len],low:0,high:Math.min(height,.8)});
      if(height>2.3)volumes.push({rect:o.horizontal?[mid,o.at,len,thickness]:[o.at,mid,thickness,len],low:2.3,high:height});
    }
    if(height>2.1)for(const o of plan.doors){
      const mid=(o.from+o.to)/2,len=o.to-o.from;
      volumes.push({rect:o.horizontal?[mid,o.at,len,.16]:[o.at,mid,.16,len],low:2.1,high:height});
    }
    const unique=values=>[...new Set(values.map(v=>Math.round(v*1e6)/1e6))].sort((a,b)=>a-b);
    const xs=unique(volumes.flatMap(v=>[v.rect[0]-v.rect[2]/2,v.rect[0]+v.rect[2]/2]));
    const zs=unique(volumes.flatMap(v=>[v.rect[1]-v.rect[3]/2,v.rect[1]+v.rect[3]/2]));
    const ys=unique([0,height-.0225,...volumes.flatMap(v=>[v.low,v.high])]);
    const nx=xs.length-1,nz=zs.length-1,ny=ys.length-1;
    const occupied=new Set(),key=(i,j,k)=>(k*nz+j)*nx+i;
    for(let k=0;k<ny;k++)for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2,y=(ys[k]+ys[k+1])/2;
      if(volumes.some(v=>y>v.low&&y<v.high&&Math.abs(x-v.rect[0])<v.rect[2]/2&&Math.abs(z-v.rect[1])<v.rect[3]/2))occupied.add(key(i,j,k));
    }
    const has=(i,j,k)=>i>=0&&i<nx&&j>=0&&j<nz&&k>=0&&k<ny&&occupied.has(key(i,j,k));
    const faces=[];
    for(let k=0;k<ny;k++)for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)if(has(i,j,k)){
      const x=xs[i],xx=xs[i+1],z=zs[j],zz=zs[j+1],y=ys[k],yy=ys[k+1];
      const add=(points,tone)=>faces.push({points,tone,cap:y>=height-.023});
      if(!has(i,j,k+1))add([[x,yy,z],[xx,yy,z],[xx,yy,zz],[x,yy,zz]],0);
      if(!has(i-1,j,k))add([[x,y,zz],[x,y,z],[x,yy,z],[x,yy,zz]],2);
      if(!has(i+1,j,k))add([[xx,y,z],[xx,y,zz],[xx,yy,zz],[xx,yy,z]],2);
      if(!has(i,j-1,k))add([[x,y,z],[xx,y,z],[xx,yy,z],[x,yy,z]],1);
      if(!has(i,j+1,k))add([[xx,y,zz],[x,y,zz],[x,yy,zz],[xx,yy,zz]],1);
    }
    return cache[mode]={faces,height,volumes};
  }

  function floorPlan(state) {
    return plans.find(plan=>plan.id===state.plan) || plans[1];
  }

  function entranceGeometry(plan,overhead=false,walking=false){
    const e=plan.entry,mid=(e.from+e.to)/2,width=e.to-e.from-.10,height=walking?2.06:overhead?.13:1.35;
    const inward={top:1,bottom:-1,left:1,right:-1}[e.side],parts=[];
    function part(along,offset,w,h,depth,y,color){
      const at=e.at+offset*inward;
      parts.push({rect:e.horizontal?[mid+along,at,w,depth]:[at,mid+along,depth,w],height:h,y,color});
    }
    part(0,0,width,height,.075,0,'#63574d');
    for(const y of [.14,.85]){
      const h=Math.min(.58,height-y);
      if(h>0)part(0,.046,width-.14,h,.018,y,'#87735f');
    }
    if(height>1.04){
      part(width*.34,.062,.045,.20,.023,.91,'#b8b6ac');
      part(width*.29,.083,.16,.025,.038,1.02,'#cbc9be');
      part(width*.34,.078,.017,.028,.012,.94,'#333536');
    }
    if(height>1.55)part(0,.052,.027,.027,.014,1.53,'#b8b6ac');
    part(0,.012,width+.08,.025,.18,0,'#686860');
    return parts;
  }

  function footprint(key,rotation=0) {
    const [w,d]=pieceFor(key).size;
    return rotation%2?[d,w]:[w,d];
  }

  function doorClearance({horizontal,at,from,to}) {
    return horizontal ? [(from+to)/2,at,to-from,1.02] : [at,(from+to)/2,1.02,to-from];
  }

  function fits(key,point,state,rotation=state.rotations?.[key]||0) {
    if(pieceFor(key).type==='curtain'){
      const mount=curtainMount(point,state);
      return Boolean(mount&&!Object.entries(state.placed).some(([other,p])=>other!==key&&pieceFor(other).type==='curtain'&&curtainMount(p,state)?.window===mount.window));
    }
    const [x,z]=point, [w,d]=footprint(key,rotation);
    const plan=floorPlan(state);
    // Sample every footprint edge so concave floor outlines cannot be bridged by furniture.
    for(let dx=-w/2;dx<=w/2+.001;dx+=Math.min(.12,w)){
      if(!contains([x+dx,z-d/2],plan.outline)||!contains([x+dx,z+d/2],plan.outline))return false;
    }
    for(let dz=-d/2;dz<=d/2+.001;dz+=Math.min(.12,d)){
      if(!contains([x-w/2,z+dz],plan.outline)||!contains([x+w/2,z+dz],plan.outline))return false;
    }
    const rug=pieceFor(key).type==='rug';
    const occupied=[...plan.perimeter,...plan.walls,...windowWalls(plan),...plan.fixtures.map(item=>item.bounds),...(rug?[]:radiators(plan).map(r=>r.bounds)),...plan.doors.map(doorClearance)];
    for(const zone of plan.zones){
      if(zone.id.startsWith('bath')||(zone.id==='balcony'&&!['plant','armchair','coffee'].includes(pieceType(key)))){
        const [x1,z1,x2,z2]=zone.bounds;
        occupied.push([(x1+x2)/2,(z1+z2)/2,x2-x1,z2-z1]);
      }
    }
    for(const [other,[px,pz]] of Object.entries(state.placed)){
      if(!rug&&other!==key&&!['curtain','rug'].includes(pieceFor(other).type))occupied.push([px,pz,...footprint(other,state.rotations?.[other]||0)]);
    }
    if(!rug&&state.walking&&state.walker)occupied.push([...state.walker.position,.46,.46]);
    return occupied.every(([ox,oz,ow,od])=>Math.abs(x-ox)>=(w+ow)/2-1e-6||Math.abs(z-oz)>=(d+od)/2-1e-6);
  }

  function snapPoint(key,point,state){
    if(pieceFor(key).type==='curtain')return curtainMount(point,state)?.point||point;
    const [x,z]=point,[w,d]=footprint(key,state.rotations?.[key]||0),plan=floorPlan(state),xs=[x],zs=[z];
    const rug=pieceFor(key).type==='rug';
    const neighbors=[...plan.perimeter,...plan.walls,...windowWalls(plan),...plan.fixtures.map(f=>f.bounds),...(rug?[]:radiators(plan).map(r=>r.bounds)),...Object.entries(state.placed).filter(([other])=>!rug&&other!==key&&!['curtain','rug'].includes(pieceFor(other).type)).map(([other,p])=>[...p,...footprint(other,state.rotations?.[other]||0)])];
    for(const [ox,oz,ow,od] of neighbors){
      if(Math.abs(z-oz)<(d+od)/2)for(const side of [-1,1]){const edge=ox+side*(ow+w)/2;if(Math.abs(edge-x)<.10)xs.push(edge);}
      if(Math.abs(x-ox)<(w+ow)/2)for(const side of [-1,1]){const edge=oz+side*(od+d)/2;if(Math.abs(edge-z)<.10)zs.push(edge);}
    }
    let best=point,score=Infinity;
    for(const px of xs)for(const pz of zs){
      const snapped=Number(px!==x)+Number(pz!==z);if(!snapped)continue;
      const distance=Math.hypot(px-x,pz-z)-snapped;
      if(distance<score&&fits(key,[px,pz],state)){score=distance;best=[px,pz];}
    }
    return best;
  }

  function preferredZone(key,plan) {
    const type=pieceFor(key).type;
    const ids=type==='bed'||pieceType(key)==='nightstand'?['bedroom']:type==='table'?['kitchen']:type==='desk'?['bedroom-child','bedroom','kitchen']:['living','bedroom','hall'];
    return ids.map(id=>plan.zones.find(zone=>zone.id===id)).find(Boolean)||plan.zones[0];
  }

  function suggest(key,state) {
    if(pieceFor(key).type==='curtain'){
      const plan=floorPlan(state),w=plan.windows.find(w=>!glazedDoor(plan,w)&&fits(key,windowMount(plan,w).point,state));
      return w?windowMount(plan,w).point:null;
    }
    const plan=floorPlan(state),zone=preferredZone(key,plan);
    if(fits(key,zone.label,state))return [...zone.label];
    let closest=null,best=Infinity;
    for(let x=-plan.width/2+.2;x<plan.width/2;x+=.2)for(let z=-plan.depth/2+.2;z<plan.depth/2;z+=.2){
      const [x1,z1,x2,z2]=zone.bounds;
      const within=x>x1&&x<x2&&z>z1&&z<z2;
      const score=(x-zone.label[0])**2+(z-zone.label[1])**2+(within?0:100);
      if(score<best&&fits(key,[x,z],state)){best=score;closest=[x,z];}
    }
    return closest;
  }



  function mount(canvas,getState,onProjected) {
    const ctx = canvas.getContext('2d');
    const gpu=typeof ApartmentRenderer!=='undefined'?ApartmentRenderer.create():null;
    const oak = new Image();
    oak.onload = schedule;
    oak.src = 'assets/oak-floor.webp';
    const linen = new Image();
    linen.onload = schedule;
    linen.src = 'assets/linen-upholstery.webp';
    let angle=-.64,lift=.64, zoom=1, panX=0, panY=0, drawing=false, alive=true, hitFaces=[],gpuScene=null,lastShadowKey=null;
    const worldModels=new Map();
    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);

    function schedule() {
      if(!alive||drawing)return;
      drawing=true;
      requestAnimationFrame(draw);
    }

    // Read current camera values for input as well as rendering: multiple wheel
    // events can arrive before the next animation frame.
    function cameraView(){
      const width=canvas.clientWidth,height=canvas.clientHeight;
      const ax=Math.cos(angle),az=Math.sin(angle),sy=Math.sin(lift),cy=Math.cos(lift);
      const level=getState();
      if(level.walking&&level.walker){
        const [tx,tz]=level.walker.position,focal=Math.min(width,height)*1.1,cx=width/2,screenY=height*.48;
        const cameraSpace=([x,y,z])=>{
          x-=tx;y-=1.75;z-=tz;
          return [x*ax-z*az,y*cy-(x*az+z*ax)*sy,-(x*az+z*ax)*cy-y*sy];
        };
        const project=(x,y,z)=>{
          const [u,v,depth]=cameraSpace([x,y,z]),safe=Math.max(.04,depth);
          return [cx+u*focal/safe,screenY-v*focal/safe,-depth];
        };
        const clip=points=>{
          if(points.every(p=>cameraSpace(p)[2]>=.04))return points;
          const result=[];
          for(let i=0;i<points.length;i++){
            const a=points[i],b=points[(i+1)%points.length],da=cameraSpace(a)[2],db=cameraSpace(b)[2];
            if(da>=.04)result.push(a);
            if((da>=.04)!==(db>=.04)){
              const t=(.04-da)/(db-da);result.push(a.map((value,j)=>value+(b[j]-value)*t));
            }
          }
          return result;
        };
        const ground=(sx,sz)=>{
          const rx=(sx-cx)/focal,ry=-(sz-screenY)/focal;
          const eye=[tx,1.75,tz];
          const ray=[ax*rx-az*sy*ry-az*cy,cy*ry-sy,-az*rx-ax*sy*ry-ax*cy];
          if(ray[1]>=-.001)return null;
          const t=-eye[1]/ray[1];
          return t>0&&t<100?[eye[0]+ray[0]*t,eye[2]+ray[2]*t]:null;
        };
        return {ax,az,overhead:false,project,ground,clip,matrix:gpu?ApartmentRenderer.cameraMatrix({width,height,angle,lift,walking:true,position:[tx,tz]}):null};
      }
      const overhead=lift>1.42;
      const scale=Math.max(.001,Math.min(width/(overhead?12:14.1),height/(overhead?11.1:11.4))*zoom);
      const baseX=width/2,baseY=height*(overhead?.52:.60);
      const ox=baseX+panX,oy=baseY+panY;
      const project=(x,y,z)=>{
        const depth=x*az+z*ax;
        return [ox+(x*ax-z*az)*scale,oy+(depth*sy-y*cy)*scale,depth*cy+y*sy];
      };
      const ground=(sx,sz)=>{
        const across=(sx-ox)/scale,depth=(sz-oy)/(scale*sy);
        return [across*ax+depth*az,-across*az+depth*ax];
      };
      return {ax,az,overhead,ox,oy,baseX,baseY,project,ground,matrix:gpu?ApartmentRenderer.cameraMatrix({width,height,angle,lift,scale,ox,oy}):null};
    }

    function draw() {
      drawing=false;
      if(!alive)return;
      const width=canvas.clientWidth,height=canvas.clientHeight;
      if(!width||!height)return;
      // Keep the HTML UI crisp while bounding the cost of the rasterized scene,
      // including fullscreen and Retina displays. Input stays in CSS pixels.
      const dpi=Math.min(devicePixelRatio||1,1,Math.sqrt(renderPixelBudget/(width*height)));
      const px=Math.round(width*dpi),py=Math.round(height*dpi);
      if(canvas.width!==px||canvas.height!==py) {canvas.width=px;canvas.height=py;}
      ctx.setTransform(px/width,0,0,py/height,0,0);
      const level=getState();
      const palette=colors[level.palette];
      const plan=floorPlan(level);
      const {ax,az,overhead,project,clip,matrix}=cameraView();
      const geometryKey=JSON.stringify([plan.id,Boolean(level.walking),overhead,level.palette,level.wallColor,level.floorColor,level.placed,level.rotations,level.ghost?.key]);
      const shadowKey=JSON.stringify([plan.id,Boolean(level.walking),overhead,level.placed,level.rotations,level.ghost?.key]),shadowDirty=shadowKey!==lastShadowKey;
      const groundFaces=[], faces=[],drawItems=[],shadowCasters=[],ghostItems=[];
      let buildingInterior=false,collectingGhost=false;
      const patternFor = image => image.complete&&image.naturalWidth?ctx.createPattern(image,'repeat'):null;
      const textures=gpu?{}:{wood:patternFor(oak),linen:patternFor(linen)};
      const face=(points,fill,edge,owner,layer=faces,material=null,options={})=>{
        if(gpu){
          const item={world:points,triangles:options.triangles,uv:options.uv,normals:options.normals,material,fill,owner,layerName:options.layerName||(owner||buildingInterior?'interior':'background')};
          if(shadowDirty&&!collectingGhost&&options.castShadow!==false&&!owner?.endsWith('-ghost')&&fill.length===7&&points.some(p=>p[1]>.04))shadowCasters.push({points,triangles:options.triangles});
          (collectingGhost?ghostItems:layer).push(item);return;
        }
        let normals=options.normals,uv=options.uv;
        let triangles=options.triangles;
        if(clip&&clip(points)!==points){
          const packed=points.map((p,i)=>[...p,...(normals?.[i]||[0,1,0]),...(uv?.[i]||[p[0]*1.8,p[2]*1.8])]);
          const clipped=clip(packed);if(clipped.length<3)return;
          points=clipped.map(p=>p.slice(0,3));normals=clipped.map(p=>p.slice(3,6));uv=clipped.map(p=>p.slice(6,8));
          triangles=null;
        }
        const projected=points.map(([x,y,z])=>project(x,y,z));
        const bounds=screenBounds(projected);
        if(offscreen(bounds,width,height))return;
        let texture;
        const pattern = textures[material];
        const planar=[0,1,2].some(axis=>points.every(point=>Math.abs(point[axis]-points[0][axis])<1e-7));
        if(pattern&&planar){
          const [x,y,z]=points[0];
          const top=points.every(point=>point[1]===y);
          const other=points.find(p=>Math.hypot(p[0]-x,p[2]-z)>1e-6)||points[1];
          const [dx,dz]=[other[0]-x,other[2]-z];
          const length=Math.hypot(dx,dz)||1;
          const u=top?project(x+1,y,z):project(x+dx/length,y,z+dz/length);
          const v=top?project(x,y,z+1):project(x,y+1,z);
          const [sx,screenY]=projected[0];
          const factor=material==='linen'?1/192:2/oak.naturalWidth;
          texture={pattern,matrix:[(u[0]-sx)*factor,(u[1]-screenY)*factor,(v[0]-sx)*factor,(v[1]-screenY)*factor,sx,screenY],opacity:material==='linen'?.37:.27};
        }
        const layerName=options.layerName||(owner||buildingInterior?'interior':'background');
        layer.push({points:projected,world:points,triangles,uv,normals:options.normals?normals:null,material,layerName,castShadow:options.castShadow,bounds,depth:projected.reduce((sum,p)=>sum+p[2],0)/projected.length,fill,edge,owner,texture});
      };
      function box(x,z,w,d,h,tint,{y=0,owner,layer=faces,bevel=0,material=null}={}) {
        const x1=x-w/2,x2=x+w/2,z1=z-d/2,z2=z+d/2;
        const b=Math.min(bevel,w*.22,d*.22);
        const v=b?[[x1+b,z1],[x2-b,z1],[x2,z1+b],[x2,z2-b],[x2-b,z2],[x1+b,z2],[x1,z2-b],[x1,z1+b]]
          :[[x1,z1],[x2,z1],[x2,z2],[x1,z2]];
        for(let i=0;i<v.length;i++){
          const [lx,lz]=v[i], [rx,rz]=v[(i+1)%v.length];
          if(!gpu&&level.walking){
            const [ex,ez]=level.walker.position;
            if((rx-lx)*(ez-lz)-(rz-lz)*(ex-lx)>=0)continue;
          }else if(!gpu&&(rx-lx)*ax-(rz-lz)*az>=0)continue;
          face([[lx,y,lz],[rx,y,rz],[rx,y+h,rz],[lx,y+h,lz]],tint[(Math.abs(rx-lx)>Math.abs(rz-lz))?1:2],material?null:'#59443824',owner,layer,material);
        }
        face(v.map(([vx,vz])=>[vx,y+h,vz]),tint[0],material?null:'#59443824',owner,layer,material);
      }
      function paint(item, opacity=1) {
        if(gpu){drawItems.push(item);return;}
        const shape=new Path2D();
        item.points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
        shape.closePath();
        ctx.globalAlpha=opacity;
        ctx.fillStyle=item.fill;
        ctx.fill(shape);
        if(item.texture){
          ctx.save();ctx.clip(shape);ctx.transform(...item.texture.matrix);
          ctx.fillStyle=item.texture.pattern;
          ctx.globalAlpha=opacity*item.texture.opacity;
          ctx.fillRect(-2500,-2500,5000,5000);ctx.restore();
        }
        if(item.edge){ctx.strokeStyle=item.edge;ctx.lineWidth=.8;ctx.stroke(shape);}
        if(item.owner&&item.owner===level.active){
          ctx.fillStyle='#efcc6633';ctx.fill(shape);
          ctx.strokeStyle='#e7aa30';ctx.lineWidth=2;ctx.stroke(shape);
        }
        ctx.globalAlpha=1;
        hitFaces.push({shape,owner:item.owner,bounds:item.bounds,points:item.points,layerName:item.layerName});
      }
      function floor(x,z,w,d,fill,edge=null) {
        face([[x-w/2,.021,z-d/2],[x+w/2,.021,z-d/2],[x+w/2,.021,z+d/2],[x-w/2,.021,z+d/2]],fill,edge,null,groundFaces);
      }
      function line(points,stroke){
        ctx.beginPath();
        points.map(p=>project(...p)).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
        ctx.strokeStyle=stroke;
        ctx.lineWidth=.8;
        ctx.stroke();
      }
      const wallColor=level.wallColor||palette.wall;
      const wall=[wallColor,shade(wallColor,.90),shade(wallColor,.78)],trim=['#fff0e0','#d7a99e','#c4918b'];
      const {fabric,accent}=palette;
      const timber=['#bc9068','#986b50','#704a38'];
      const stone=['#f4e5d8','#d7b8a8','#ad8a7e'];
      const cabinetry=['#b6ac93','#887e69','#6d6154'];
      const bronze=['#bba078','#897153','#67543d'];
      ctx.fillStyle='#e9eef5';
      ctx.fillRect(0,0,width,height);
      hitFaces=[];
      if(!level.walking){
        const [sx,sh]=project(0,-.37,0);
        const shadow=ctx.createRadialGradient(sx,sh,0,sx,sh,width*.44);
        shadow.addColorStop(0,'#243c5b38');shadow.addColorStop(1,'#243c5b00');
        ctx.fillStyle=shadow;ctx.fillRect(0,0,width,height);
      }
      if(gpu&&gpuScene?.key===geometryKey){finishGPU();drawOverlays();return;}
      const groundTint=level.floorColor||palette.wood;
      face(plan.outline.map(([x,z])=>[x,.005,z]),groundTint,'#93756455',null,groundFaces);
      for(let i=0;i<plan.outline.length;i++){
        const [x1,z1]=plan.outline[i], [x2,z2]=plan.outline[(i+1)%plan.outline.length];
        if(!gpu&&(x2-x1)*ax-(z2-z1)*az>=0)continue;
        face([[x1,-.25,z1],[x2,-.25,z2],[x2,0,z2],[x1,0,z1]],'#a77e73','#79574745',null,groundFaces);
      }
      groundFaces.forEach(item=>paint(item));
      groundFaces.length=0;
      function laminateFloor() {
        const outline=plan.outline.map(([x,z])=>[x,.014,z]);
        const visible=clip?clip(outline):outline;
        if(visible.length<3)return;
        ctx.save();ctx.beginPath();
        visible.map(p=>project(...p)).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
        ctx.closePath();ctx.clip();
        const shades=[.976,.988,1,1.012,1.024].map(factor=>shade(groundTint,factor));
        ctx.strokeStyle=shade(groundTint,.81);ctx.lineWidth=.45;
        for(const board of floorBoards(plan)){
          if(gpu){face(board.points,shades[board.tone],null,null,groundFaces,null,{castShadow:false});continue;}
          const polygon=clip?clip(board.points):board.points;
          if(polygon.length<3)continue;
          const points=polygon.map(p=>project(...p));
          if(offscreen(screenBounds(points),width,height))continue;
          ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
          ctx.fillStyle=shades[board.tone];ctx.fill();ctx.stroke();
        }
        ctx.restore();
      }
      laminateFloor();
      if(gpu){groundFaces.forEach(item=>paint(item));groundFaces.length=0;}
      // The ceiling is present only in the full-height interior.
      if(level.walking)face(plan.outline.map(([x,z])=>[x,2.7,z]),'#f3f0e9',null,null,groundFaces,null,{castShadow:false});
      for(const {horizontal,at,from,to} of plan.doors){
        const center=(from+to)/2;
        floor(horizontal?center:at,horizontal?at:center,horizontal?to-from:.18,horizontal?.18:to-from,'#ad886c','#714d3662');
        const doorHeight=level.walking?2.1:overhead?.13:1.35;
        for(const coordinate of [from+.03,to-.03])box(horizontal?coordinate:at,horizontal?at:coordinate,horizontal?.06:.20,horizontal?.20:.06,doorHeight,bronze);
        if(level.walking)box(horizontal?center:at,horizontal?at:center,horizontal?to-from:.20,horizontal?.20:to-from,.055,bronze,{y:2.045});
        if(overhead&&!gpu){
          const hinge=horizontal?[from,at]:[at,from];
          const end=horizontal?[from,at-(to-from)]:[at+(to-from),from];
          line([[hinge[0],.03,hinge[1]],[end[0],.03,end[1]]],'#8c6b50');
        }
      }
      for(const part of entranceGeometry(plan,overhead,Boolean(level.walking))){
        const [x,z,w,d]=part.rect;
        box(x,z,w,d,part.height,[part.color,shade(part.color,.88),shade(part.color,.76)],{y:part.y,bevel:.006});
      }
      for(const surface of wallGeometry(plan,overhead,level.walking).faces){
        const [a,b]=surface.points;
        if(!gpu&&!level.walking&&surface.tone!==0&&(b[0]-a[0])*ax-(b[2]-a[2])*az>=0)continue;
        const tint=(surface.cap?trim:wall)[surface.tone];
        // Same-colour coverage closes subpixel antialias seams between mesh cells.
        face(surface.points,tint,tint,null,faces);
      }
      for(const opening of plan.windows){
        const {horizontal,at,from,to}=opening;
        const center=(from+to)/2,width=to-from;
        if(overhead)continue;
        const doorway=plan.doors.some(d=>d.horizontal===horizontal&&Math.abs(d.at-at)<.01&&d.from<=from+.01&&d.to>=to-.01);
        const sill=doorway?.025:.8,top=level.walking?2.3:1.35,height=top-sill-.0275;
        const pane=['#cee6e4','#b0d5d3a9','#8cb8bbad'];
        const inward={top:1,bottom:-1,left:1,right:-1}[opening.side],thickness=windowThickness(plan,opening);
        const glassAt=at+inward*(thickness/2-.018),px=horizontal?center:glassAt,pz=horizontal?glassAt:center;
        const sillAt=at+inward*.045;
        box(horizontal?center:sillAt,horizontal?sillAt:center,horizontal?width+.03:thickness+.09,horizontal?thickness+.09:width+.03,.03,trim,{y:sill-.015});
        box(px,pz,horizontal?width:.025,horizontal?.025:width,height,pane,{y:sill+.0275});
        for(const coordinate of [from,center,to]){
          box(horizontal?coordinate:glassAt,horizontal?glassAt:coordinate,horizontal?.04:.035,horizontal?.035:.04,top-sill,bronze,{y:sill});
        }
        if(level.walking)box(px,pz,horizontal?width:.035,horizontal?.035:width,.0275,bronze,{y:top-.0275});
      }
      for(const r of radiators(plan)){
        const key='radiator:'+r.width;
        renderModel(key+':'+r.point.join(','),ApartmentFurniture.model(key,{type:'radiator',size:[r.width,r.depth],height:.72},palette),r.point,r.rotation*Math.PI/2,null,'radiator');
      }
      buildingInterior=true;
      for(const item of plan.fixtures){
        const [x,z,w,d]=item.bounds;
        if(['shower','bath','toilet','vanity'].includes(item.type)){
          const type=item.type==='shower'&&Math.max(w,d)/Math.min(w,d)>1.65?'bath':item.type;
          const height=type==='shower'?(level.walking?2:overhead?.15:1.35):1;
          const size=item.modelSize||[w,d],assetKey=['fixture',type,...size,height].join(':');
          renderModel(assetKey+':'+[x,z].join(','),ApartmentFurniture.model(assetKey,{size,height,type},palette),[x,z],(item.rotation||0)*Math.PI/2,null);
          continue;
        }
        if(item.type==='kitchen'){
          box(x,z,w,d,.84,cabinetry,{material:'paint'});
          box(x,z,w+.05,d+.05,.09,stone,{y:.84,bevel:.025,material:'stone'});
          const horizontal=w>d;
          const count=Math.max(2,Math.round(Math.max(w,d)/.59));
          for(let i=0;i<count;i++){
            const offset=(i+.5)/count-.5;
            box(x+(horizontal?w*offset:0),z+(horizontal?d/2+.01:d*offset),horizontal?.19:.025,horizontal?.025:.19,.025,bronze,{y:.69});
          }
          box(x+(horizontal?w*.27:0),z+(horizontal?0:d*.27),.43,.35,.023,['#526367','#364951','#283940'],{y:.935,bevel:.03});
          box(x-(horizontal?w*.25:0),z-(horizontal?0:d*.25),.38,.34,.025,['#3e4543','#303936','#272f30'],{y:.935,bevel:.025});
          continue;
        }
        box(x,z,w,d,overhead?.55:1.55,cabinetry,{bevel:.035,material:'wood'});
      }
      buildingInterior=false;

      for(const [key,point] of Object.entries(level.placed)) {
        if(level.ghost?.key!==key) furnishing(key,point);
      }
      if(!gpu)drawGhost();
      groundFaces.forEach(item=>paint(item));
      (gpu?faces:faces.sort((a,b)=>a.depth-b.depth)).forEach(item=>{
        paint(item,item.owner?.endsWith('-ghost')?.69:1);
      });
      if(gpu){
        gpuScene={key:geometryKey,items:drawItems,groups:pickGroups(drawItems)};finishGPU();
      }
      drawOverlays();

      function drawGhost(){
        if(!level.ghost)return;
        const {key,point}=level.ghost,[w,d]=footprint(key,level.rotations?.[key]||0),valid=fits(key,point,level);
        if(pieceFor(key).type!=='curtain')floor(point[0],point[1],w,d,valid?'#78a68388':'#c65c6577',valid?'#497651':'#912d4f');
        furnishing(key,point,true);
      }
      function finishGPU(){
        collectingGhost=true;drawGhost();collectingGhost=false;
        const items=ghostItems.length?gpuScene.items.concat(ghostItems):gpuScene.items;
        const depthVector=[az*Math.cos(lift),Math.sin(lift),ax*Math.cos(lift)];
        const image=gpu.draw(items,px,py,Boolean(level.walking),{wood:oak,linen,width,height,shadowKey,geometryKey,staticCount:gpuScene.items.length,cameraMatrix:matrix,depthVector},level.active,shadowCasters);
        ctx.drawImage(image,0,0,width,height);
        lastShadowKey=shadowKey;
      }
      function drawOverlays(){
      if(overhead){
        if(gpu)for(const d of plan.doors){
          const hinge=d.horizontal?[d.from,d.at]:[d.at,d.from],end=d.horizontal?[d.from,d.at-(d.to-d.from)]:[d.at+(d.to-d.from),d.from];
          line([[hinge[0],.03,hinge[1]],[end[0],.03,end[1]]],'#8c6b50');
        }
        ctx.font='650 11px "Segoe UI", sans-serif';
        ctx.textAlign='center';
        ctx.strokeStyle='#fff8e7';ctx.fillStyle='#4c352e';ctx.lineWidth=3;
        for(const zone of plan.zones){
          const [x,y]=project(zone.label[0],.025,zone.label[1]);
          ctx.strokeText(zone.name,x,y);ctx.fillText(zone.name,x,y);
        }
      }
      if(onProjected){
        const target=level.suggestion;
        const point=target?project(target[0],.04,target[1]):null;
        onProjected(point&&(!level.walking||point[2]<-.15)&&point[0]>0&&point[0]<width&&point[1]>0&&point[1]<height?point:null);
      }
      }

      function furnishing(key,[x,z],ghost=false) {
        const owner=ghost?key+'-ghost':key;
        if(pieceFor(key).type==='curtain'){
          const mount=curtainMount([x,z],level),w=mount?.width||pieceFor(key).size[0],id='curtain:'+w;
          renderModel(key+':'+w,ApartmentFurniture.model(id,{...pieceFor(key),size:[w,.18]},palette),mount?.point||[x,z],(mount?.rotation||0)*Math.PI/2,owner,'curtain');return;
        }
        const rotation=(level.rotations?.[key]||0)*Math.PI/2;
        renderModel(key,ApartmentFurniture.model(pieceType(key),pieceFor(key),palette),[x,z],rotation,owner);
      }
      function renderModel(key,model,[x,z],rotation,owner,layerName='interior'){
        const c=Math.cos(rotation),s=Math.sin(rotation);
        const signature=[x,z,rotation,level.palette].join('|');
        let cached=worldModels.get(key);
        if(cached?.signature!==signature){
          cached={signature,meshes:model.map(mesh=>({...mesh,
            points:mesh.points.map(([px,y,pz])=>[x+px*c-pz*s,y,z+px*s+pz*c]),
            normals:mesh.normals?.map(([nx,ny,nz])=>[nx*c-nz*s,ny,nx*s+nz*c])
          }))};worldModels.set(key,cached);
        }
        for(const mesh of cached.meshes){
          const points=mesh.points;
          if(gpu){face(points,mesh.color,null,owner,faces,mesh.material,{normals:mesh.normals,uv:mesh.uv,triangles:mesh.triangles,layerName,castShadow:layerName!=='curtain'});continue;}
          const [a,b,d]=points,u=b.map((v,i)=>v-a[i]),v=d.map((q,i)=>q-a[i]);
          const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)||1;
          const eye=level.walking?[level.walker.position[0]-a[0],1.75-a[1],level.walker.position[1]-a[2]]:[az*Math.cos(lift),Math.sin(lift),ax*Math.cos(lift)];
          if(!gpu&&n.reduce((sum,q,i)=>sum+q*eye[i],0)<=0)continue;
          const light=.78+.22*Math.max(0,(-n[0]*.4+n[1]*.82+n[2]*.4)/length);
          face(points,gpu?mesh.color:shade(mesh.color,light),null,owner,faces,mesh.material,{normals:mesh.normals,uv:mesh.uv,triangles:mesh.triangles,layerName,castShadow:layerName!=='curtain'});
        }
      }
    }

    function pickGroups(items){
      const groups=new Map();
      for(const item of items){
        let group=groups.get(item.owner);
        if(!group){group={items:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};groups.set(item.owner,group);}
        group.items.push(item);
        for(const p of item.world)for(let i=0;i<3;i++){group.min[i]=Math.min(group.min[i],p[i]);group.max[i]=Math.max(group.max[i],p[i]);}
      }
      return [...groups.values()];
    }

    return {
      schedule, pixelToFloor(x,y){return cameraView().ground(x,y);},
      hit(x,y){
        // The path was constructed in CSS pixels; hit testing uses an identity transform.
        ctx.save();ctx.resetTransform();
        let result,nearest=-Infinity,nearestLayer=null,curtainDepth=-Infinity,curtainOwner=null;
        const view=cameraView();let candidates=hitFaces;
        if(gpu){
          candidates=[];
          for(const group of gpuScene?.groups||[]){
            const corners=[];
            for(const xx of [group.min[0],group.max[0]])for(const yy of [group.min[1],group.max[1]])for(const zz of [group.min[2],group.max[2]])corners.push(view.project(xx,yy,zz));
            if(getState().walking&&corners.every(p=>p[2]>-.04))continue;
            const b=screenBounds(corners);
            if((!getState().walking||corners.every(p=>p[2]<=-.04))&&(x<b.left||x>b.right||y<b.top||y>b.bottom))continue;
            candidates.push(...group.items);
          }
        }
        for(let i=candidates.length-1;i>=0;i--){
          let {shape,owner,bounds,points,layerName}=candidates[i];
          if(gpu){const world=view.clip?view.clip(candidates[i].world):candidates[i].world;if(world.length<3)continue;points=world.map(p=>view.project(...p));bounds=screenBounds(points);}
          if(owner?.endsWith('-ghost')||x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)continue;
          if(gpu||ctx.isPointInPath(shape,x,y)){
            if(typeof ApartmentRenderer==='undefined'){result=owner;break;}
            const distance=ApartmentRenderer.depthAt(points,x,y,Boolean(getState().walking));
            if(layerName==='curtain'){if(distance>curtainDepth){curtainDepth=distance;curtainOwner=owner;}}
            else if(distance>nearest){nearest=distance;result=owner;nearestLayer=layerName;}
          }
        }
        ctx.restore();
        if(curtainDepth>-Infinity&&nearestLayer!=='interior'&&(nearestLayer==='radiator'||curtainDepth>nearest))result=curtainOwner;
        return pieceFor(result)?result:undefined;
      },
      rotate(dx,dy){angle=(angle+dx)%(Math.PI*2);lift=clamp(lift+dy,getState().walking?-1.15:.08,getState().walking?1.15:Math.PI/2);schedule();},
      pan(dx,dy){if(!getState().walking){panX+=dx;panY+=dy;schedule();}},
      walkAngle(){return angle;},
      setWalk(enabled){if(enabled){angle=(getState().walker?.facing||0)+Math.PI;lift=0;}schedule();},
      setView(top){angle=top?0:-.64;lift=top?1.49:.64;zoom=1;panX=0;panY=0;schedule();},
      scaleBy(amount,x,y){
        if(getState().walking)return;
        const next=clamp(zoom+amount,.45,3.5);
        if(Number.isFinite(x)&&Number.isFinite(y)){
          const {ox,oy,baseX,baseY}=cameraView(),ratio=next/zoom;
          panX=x-(x-ox)*ratio-baseX;
          panY=y-(y-oy)*ratio-baseY;
        }
        zoom=next;schedule();
      },
      destroy(){alive=false;observer.disconnect();gpu?.destroy();}
    };
  }
  return {mount,pieces,pieceType,pieceFor,colors,fits,suggest,floorPlan,footprint,snapPoint,wallGeometry,floorBoards,entranceGeometry,curtainMount,radiators,windowThickness};
})();
