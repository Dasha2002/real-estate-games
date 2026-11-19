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
    plant:{title:'Растение',size:[.55,.55],height:1.1,type:'plant',group:'Декор'}
  };
  const colors = [
    {wood:'#d8b78b',wall:'#f6dfcc',wallSide:'#c69385',fabric:['#ecd7bc','#c49d83','#9d776b'],accent:['#8b9c77','#63724f','#586447']},
    {wood:'#d2a894',wall:'#f6dedc',wallSide:'#c68780',fabric:['#e1aaa7','#b77177','#955063'],accent:['#e0ae85','#b58264','#987054']},
    {wood:'#b7b39d',wall:'#ededdd',wallSide:'#9da38c',fabric:['#d7e3c1','#a3b487','#778468'],accent:['#d9b39b','#b78d70','#967259']}
  ];
  const clamp = (value,min,max)=>Math.min(max,Math.max(min,value));
  const {plans,contains} = ApartmentPlans;

  function floorPlan(state) {
    return plans.find(plan=>plan.id===state.plan) || plans[1];
  }

  function footprint(key,rotation=0) {
    const [w,d]=pieces[key].size;
    return rotation%2?[d,w]:[w,d];
  }

  function doorClearance({horizontal,at,from,to}) {
    return horizontal ? [(from+to)/2,at,to-from,1.02] : [at,(from+to)/2,1.02,to-from];
  }

  function windowClearance(window) {
    const inward={top:[0,.21],bottom:[0,-.21],left:[.21,0],right:[-.21,0]}[window.side];
    return window.horizontal?[(window.from+window.to)/2+inward[0],window.at+inward[1],window.to-window.from,.42]
      :[window.at+inward[0],(window.from+window.to)/2+inward[1],.42,window.to-window.from];
  }

  function fits(key,point,state,rotation=state.rotations?.[key]||0) {
    const [x,z]=point, [w,d]=footprint(key,rotation);
    const plan=floorPlan(state);
    // Sample every footprint edge so concave floor outlines cannot be bridged by furniture.
    for(let dx=-w/2;dx<=w/2+.001;dx+=Math.min(.12,w)){
      if(!contains([x+dx,z-d/2],plan.outline)||!contains([x+dx,z+d/2],plan.outline))return false;
    }
    for(let dz=-d/2;dz<=d/2+.001;dz+=Math.min(.12,d)){
      if(!contains([x-w/2,z+dz],plan.outline)||!contains([x+w/2,z+dz],plan.outline))return false;
    }
    const occupied=[...plan.perimeter,...plan.walls,...plan.fixtures.map(item=>item.bounds),...plan.doors.map(doorClearance)];
    for(const zone of plan.zones){
      if(zone.id.startsWith('bath')||(zone.id==='balcony'&&!['plant','armchair','coffee'].includes(key))){
        const [x1,z1,x2,z2]=zone.bounds;
        occupied.push([(x1+x2)/2,(z1+z2)/2,x2-x1,z2-z1]);
      }
    }
    if(pieces[key].height>.7)occupied.push(...plan.windows.map(windowClearance));
    for(const [other,[px,pz]] of Object.entries(state.placed)){
      if(other!==key)occupied.push([px,pz,...footprint(other,state.rotations?.[other]||0)]);
    }
    return occupied.every(([ox,oz,ow,od])=>Math.abs(x-ox)>=(w+ow)/2+.045||Math.abs(z-oz)>=(d+od)/2+.045);
  }

  function preferredZone(key,plan) {
    const type=pieces[key].type;
    const ids=type==='bed'||key==='nightstand'?['bedroom']:type==='table'?['kitchen']:type==='desk'?['bedroom-child','bedroom','kitchen']:['living','bedroom','hall'];
    return ids.map(id=>plan.zones.find(zone=>zone.id===id)).find(Boolean)||plan.zones[0];
  }

  function suggest(key,state) {
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
    const oak = new Image();
    oak.onload = schedule;
    oak.src = 'assets/oak-floor.webp';
    const linen = new Image();
    linen.onload = schedule;
    linen.src = 'assets/linen-upholstery.webp';
    let angle=-.64,lift=.64, zoom=1, drawing=false, alive=true, view, hitFaces=[];
    const observer = new ResizeObserver(schedule);
    observer.observe(canvas);

    function schedule() {
      if(!alive||drawing)return;
      drawing=true;
      requestAnimationFrame(draw);
    }

    function draw() {
      drawing=false;
      if(!alive)return;
      const width=canvas.clientWidth,height=canvas.clientHeight;
      if(!width||!height)return;
      const dpi=Math.min(devicePixelRatio||1,2);
      const px=Math.round(width*dpi),py=Math.round(height*dpi);
      if(canvas.width!==px||canvas.height!==py) {canvas.width=px;canvas.height=py;}
      ctx.setTransform(dpi,0,0,dpi,0,0);
      const level=getState();
      const palette=colors[level.palette];
      const plan=floorPlan(level);
      const ax=Math.cos(angle),az=Math.sin(angle),sy=Math.sin(lift),cy=Math.cos(lift);
      const overhead = lift>1.42;
      const scale=Math.min(width/(overhead?12:14.1),height/(overhead?11.1:11.4))*zoom;
      const ox=width/2,oy=height*(overhead?.52:.60);
      const project=(x,y,z)=> {
        const depth=x*az+z*ax;
        return [ox+(x*ax-z*az)*scale,oy+(depth*sy-y*cy)*scale,depth*cy+y*sy];
      };
      const ground=(sx,sz)=>{
        const across=(sx-ox)/scale,depth=(sz-oy)/(scale*sy);
        return [across*ax+depth*az,-across*az+depth*ax];
      };
      view={ground};
      const groundFaces=[], faces=[];
      const patternFor = image => image.complete&&image.naturalWidth?ctx.createPattern(image,'repeat'):null;
      const textures={wood:patternFor(oak),linen:patternFor(linen)};
      const face=(points,fill,edge,owner,layer=faces,material=null)=>{
        const projected=points.map(([x,y,z])=>project(x,y,z));
        let texture;
        const pattern = textures[material];
        if(pattern){
          const [x,y,z]=points[0];
          const top=points.every(point=>point[1]===y);
          const [dx,dz]=[points[1][0]-x,points[1][2]-z];
          const length=Math.hypot(dx,dz)||1;
          const u=top?project(x+1,y,z):project(x+dx/length,y,z+dz/length);
          const v=top?project(x,y,z+1):project(x,y+1,z);
          const [sx,screenY]=projected[0];
          const factor=material==='linen'?1/192:2/oak.naturalWidth;
          texture={pattern,matrix:[(u[0]-sx)*factor,(u[1]-screenY)*factor,(v[0]-sx)*factor,(v[1]-screenY)*factor,sx,screenY],opacity:material==='linen'?.37:.27};
        }
        layer.push({points:projected,depth:projected.reduce((sum,p)=>sum+p[2],0)/projected.length,fill,edge,owner,material,texture});
      };
      function box(x,z,w,d,h,tint,{y=0,owner,layer=faces,bevel=0,material=null}={}) {
        const x1=x-w/2,x2=x+w/2,z1=z-d/2,z2=z+d/2;
        const b=Math.min(bevel,w*.22,d*.22);
        const v=b?[[x1+b,z1],[x2-b,z1],[x2,z1+b],[x2,z2-b],[x2-b,z2],[x1+b,z2],[x1,z2-b],[x1,z1+b]]
          :[[x1,z1],[x2,z1],[x2,z2],[x1,z2]];
        for(let i=0;i<v.length;i++){
          const [lx,lz]=v[i], [rx,rz]=v[(i+1)%v.length];
          if((rx-lx)*ax-(rz-lz)*az>=0)continue;
          face([[lx,y,lz],[rx,y,rz],[rx,y+h,rz],[lx,y+h,lz]],tint[(Math.abs(rx-lx)>Math.abs(rz-lz))?1:2],material?null:'#59443824',owner,layer,material);
        }
        face(v.map(([vx,vz])=>[vx,y+h,vz]),tint[0],material?null:'#59443824',owner,layer,material);
      }
      function paint(item, opacity=1) {
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
        if(item.material) {
          const ys=item.points.map(point=>point[1]);
          const top=Math.min(...ys), bottom=Math.max(...ys);
          if(bottom-top>1){
            const shading=ctx.createLinearGradient(0,top,0,bottom);
            shading.addColorStop(0,'#fff5db42');
            shading.addColorStop(.34,'#fff5db00');
            shading.addColorStop(1,'#301b202d');
            ctx.fillStyle=shading;ctx.fill(shape);
          }
        }
        if(item.edge){ctx.strokeStyle=item.edge;ctx.lineWidth=.8;ctx.stroke(shape);}
        ctx.globalAlpha=1;
        if(item.owner) hitFaces.push({shape,owner:item.owner});
      }
      function floor(x,z,w,d,fill,edge=null) {
        face([[x-w/2,.013,z-d/2],[x+w/2,.013,z-d/2],[x+w/2,.013,z+d/2],[x-w/2,.013,z+d/2]],fill,edge,null,groundFaces);
      }
      function line(points,stroke){
        ctx.beginPath();
        points.map(p=>project(...p)).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
        ctx.strokeStyle=stroke;
        ctx.lineWidth=.8;
        ctx.stroke();
      }
      const wall=[palette.wall,'#c18d80',palette.wallSide],trim=['#fff0e0','#d7a99e','#c4918b'];
      const {fabric,accent}=palette;
      const timber=['#bc9068','#986b50','#704a38'];
      const stone=['#f4e5d8','#d7b8a8','#ad8a7e'];
      const cabinetry=['#b6ac93','#887e69','#6d6154'];
      const bronze=['#bba078','#897153','#67543d'];
      const background = ctx.createRadialGradient(width*.53,height*.28,0,width*.56,height*.46,width*.78);
      background.addColorStop(0,'#f9e6d2');background.addColorStop(.47,'#e7c1b6');background.addColorStop(1,'#bd8b94');
      ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
      hitFaces=[];
      const [sx,sh]=project(0,-.37,0);
      const shadow=ctx.createRadialGradient(sx,sh,0,sx,sh,width*.44);
      shadow.addColorStop(0,'#5e304f62');shadow.addColorStop(1,'#794b6800');
      ctx.fillStyle=shadow;ctx.fillRect(0,0,width,height);
      const groundTint=level.finish===2?'#bfacae':palette.wood;
      face(plan.outline.map(([x,z])=>[x,.005,z]),groundTint,'#93756455',null,groundFaces);
      for(let i=0;i<plan.outline.length;i++){
        const [x1,z1]=plan.outline[i], [x2,z2]=plan.outline[(i+1)%plan.outline.length];
        if((x2-x1)*ax-(z2-z1)*az>=0)continue;
        face([[x1,-.25,z1],[x2,-.25,z2],[x2,0,z2],[x1,0,z1]],'#a77e73','#79574745',null,groundFaces);
      }
      groundFaces.forEach(item=>paint(item));
      groundFaces.length=0;
      function floorTexture() {
        if(!textures.wood)return;
        const [u,v]=project(0,.014,0), [ux,uy]=project(1,.014,0), [vx,vy]=project(0,.014,1);
        ctx.save();
        ctx.transform(ux-u,uy-v,vx-u,vy-v,u,v);
        ctx.beginPath();plan.outline.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));ctx.closePath();ctx.clip();
        if(level.finish===1)ctx.rotate(Math.PI/2);
        const tile=3.55/oak.naturalWidth;
        ctx.scale(tile,tile);
        ctx.fillStyle=textures.wood;
        ctx.globalAlpha=.71;
        ctx.fillRect(-7/tile,-7/tile,14/tile,14/tile);
        ctx.restore();
      }
      if(level.finish===2) {
        for(const zone of plan.zones)tiledFloor(zone.bounds,'#c1b0a5','#d4c3b7');
      } else floorTexture();
      function tiledFloor([x1,z1,x2,z2],colorA,colorB) {
        for(let x=x1,i=0;x<x2-.001;x+=.48,i++)for(let z=z1,j=0;z<z2-.001;z+=.48,j++){
          const w=Math.min(.48,x2-x),d=Math.min(.48,z2-z);
          floor(x+w/2,z+d/2,w,d,(i+j)%2?colorA:colorB,'#86756768');
        }
      }
      for(const zone of plan.zones.filter(zone=>zone.id.startsWith('bath')||zone.id==='balcony')){
        const inset=zone.bounds.map((value,i)=>value+(i<2?.06:-.06));
        tiledFloor(inset,zone.id==='balcony'?'#bdafa1':'#b9a99b','#d3c5b8');
      }
      for(const [key,[x,z]] of Object.entries(level.placed)){
        const [w,d]=footprint(key,level.rotations?.[key]||0);
        floor(x,z,w,d,'#35271927');
      }
      for(const {horizontal,at,from,to} of plan.doors){
        const center=(from+to)/2;
        floor(horizontal?center:at,horizontal?at:center,horizontal?to-from:.18,horizontal?.18:to-from,'#ad886c','#714d3662');
        for(const coordinate of [from+.03,to-.03])box(horizontal?coordinate:at,horizontal?at:coordinate,horizontal?.06:.20,horizontal?.20:.06,overhead?.10:.95,bronze);
        if(overhead){
          const hinge=horizontal?[from,at]:[at,from];
          const end=horizontal?[from,at-(to-from)]:[at+(to-from),from];
          line([[hinge[0],.03,hinge[1]],[end[0],.03,end[1]]],'#8c6b50');
        }
      }
      for(const [x,z,w,d] of plan.perimeter){
        const rear=z<-plan.depth*.25;
        const height=overhead?.13:rear?1.35:.42;
        box(x,z,w,d,height,wall,{material:'paint'});
        box(x,z,w+.028,d+.028,.045,trim,{y:height});
      }
      for(const opening of plan.windows){
        const {horizontal,at,from,to}=opening;
        const center=(from+to)/2,width=to-from;
        const sill=overhead?.11:.73,height=overhead?.06:1.43;
        const pane=['#cee6e4','#b0d5d3a9','#8cb8bbad'];
        const px=horizontal?center:at,pz=horizontal?at:center;
        box(px,pz,horizontal?width:.085,horizontal?.085:width,sill,wall);
        box(px,pz,horizontal?width+.05:.18,horizontal?.18:width+.05,.055,trim,{y:sill});
        box(px,pz,horizontal?width:.06,horizontal?.06:width,height,pane,{y:sill+.055});
        for(const coordinate of [from,center,to]){
          box(horizontal?coordinate:at,horizontal?at:coordinate,.055,.055,height+.06,bronze,{y:sill+.04});
        }
        box(px,pz,horizontal?width+.05:.09,horizontal?.09:width+.05,.055,bronze,{y:sill+height+.04});
      }
      for(const [x,z,w,d] of plan.walls){
        const height=overhead?.13:.96;
        box(x,z,w,d,height,wall,{material:'paint'});
        box(x,z,w+.025,d+.025,.05,trim);
        box(x,z,w+.025,d+.025,.035,trim,{y:height});
      }
      for(const item of plan.fixtures){
        const [x,z,w,d]=item.bounds;
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
        if(item.type==='shower'){
          box(x,z,w,d,.14,stone,{bevel:.055,material:'stone'});
          box(x,z,w-.12,d-.12,.03,['#bbd2cc','#7caaa4','#71918e'],{y:.14,bevel:.05});
          if(!overhead){
            box(x+w/2,z,.035,d,1.15,['#ddf2e885','#cff2ee50','#9eb8b54c'],{y:.17});
            box(x,z+d/2,w,.035,1.15,['#ddf2e885','#cff2ee50','#9eb8b54c'],{y:.17});
          }
        }else if(item.type==='vanity'){
          box(x,z,w,d,.70,timber,{bevel:.035,material:'wood'});
          box(x,z,w+.03,d+.03,.09,stone,{y:.69,bevel:.04,material:'stone'});
          box(x,z,w*.62,d*.63,.015,['#a49186','#85736c','#755f54'],{y:.785,bevel:.05});
        }else if(item.type==='toilet'){
          box(x,z,w,d,.38,stone,{bevel:.13,material:'stone'});
          box(x,z-d*.3,w*.8,d*.29,.25,trim,{y:.36,bevel:.035,material:'stone'});
        }else box(x,z,w,d,overhead?.55:1.55,cabinetry,{bevel:.035,material:'wood'});
      }

      for(const [key,point] of Object.entries(level.placed)) {
        if(level.ghost?.key!==key) furnishing(key,point);
      }
      if(level.ghost) {
        const {key,point}=level.ghost;
        const [w,d]=footprint(key,level.rotations?.[key]||0);
        const valid=fits(key,point,level);
        floor(point[0],point[1],w+.18,d+.18,valid?'#78a68388':'#c65c6577',valid?'#497651':'#912d4f');
        furnishing(key,point,true);
      }
      groundFaces.forEach(item=>paint(item));
      faces.sort((a,b)=>a.depth-b.depth).forEach(item=>paint(item,item.owner?.endsWith('-ghost') ? .69 : 1));
      if(overhead){
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
        onProjected(target?project(target[0],.04,target[1]):null);
      }

      function furnishing(key,[x,z],ghost=false) {
        const owner=ghost?key+'-ghost':key;
        const item=pieces[key],type=item.type,rotation=(level.rotations?.[key]||0)*Math.PI/2;
        const base={sofa:[2.5,1.1],bed:[2.05,2.55],desk:[1.65,.8],table:[1.72,1.35],plant:[.65,.65],coffee:item.size,storage:item.size,shelf:item.size}[type];
        const sx=item.size[0]/base[0],sz=item.size[1]/base[1];
        const local=(dx,dz)=>[x+dx*Math.cos(rotation)-dz*Math.sin(rotation),z+dx*Math.sin(rotation)+dz*Math.cos(rotation)];
        const add=(dx,dz,w,d,h,tint,y=0,bevel=.035,material='wood')=>{
          const [px,pz]=local(dx*sx,dz*sz),turned=(level.rotations?.[key]||0)%2;
          box(px,pz,turned?d*sz:w*sx,turned?w*sx:d*sz,h,tint,{y,owner,bevel,material});
        };
        if(type==='sofa') {
          for(const dx of [-1.05,1.05])for(const dz of [-.37,.37])add(dx,dz,.10,.10,.15,bronze);
          add(0,0,2.5,1.05,.31,fabric,.14,.11,'linen');
          add(0,-.405,2.48,.25,.62,fabric,.15,.075,'linen');
          for(const offset of [-.75,0,.75]){
            add(offset,.06,.682,.68,.14,fabric,.43,.085,'linen');
            add(offset,-.29,.67,.24,.26,fabric,.51,.076,'linen');
          }
          for(const offset of [-1.12,1.12])add(offset,.02,.24,.92,.48,fabric,.18,.075,'linen');
          add(.69,-.12,.38,.31,.22,accent,.55,.082,'linen');
          add(-.60,-.11,.32,.28,.18,trim,.55,.065,'linen');
        }
        if(type==='bed') {
          for(const dx of [-.86,.86])for(const dz of [-1.04,1.04])add(dx,dz,.11,.12,.12,timber);
          add(0,0,2.05,2.55,.24,timber,.09,.07,'wood');
          add(0,0,1.95,2.42,.23,trim,.32,.10,'linen');
          add(0,.32,1.94,1.75,.085,fabric,.54,.102,'linen');
          add(.01,.67,1.93,.39,.049,accent,.622,.043,'linen');
          add(0,-1.16,2.04,.15,1.0,fabric,.16,.053,'linen');
          for(const offset of [-.47,.47])add(offset,-.77,.77,.43,.145,trim,.54,.093,'linen');
        }
        if(type==='table'||type==='desk') {
          const [w,d]=base;
          const topDepth=type==='desk'?d:.83;
          for(const dx of [-w*.44,w*.44]) for(const dz of [-topDepth*.38,topDepth*.38]) add(dx,dz,.12,.11,.71,timber);
          add(0,0,w,topDepth,.12,timber,.7);
          if(type==='desk') {add(-.17,-.19,.58,.09,.36,['#526564','#4c555e','#384648'],.81);add(.49,-.12,.15,.17,.22,accent,.81);}
          else {
            for(const dz of [-.55,.55]){
              for(const dx of [-.19,.19])add(dx,dz,.065,.065,.43,timber);
              add(0,dz,.47,.25,.10,accent,.40,.058,'linen');
              add(0,dz+Math.sign(dz)*.075,.45,.06,.37,timber,.45,.022,'wood');
            }
            add(.21,.03,.44,.35,.045,stone,.82,.085,'stone');
            add(.21,.03,.19,.18,.08,accent,.86,.05);
          }
        }
        if(type==='coffee'){
          for(const dx of [-item.size[0]*.4,item.size[0]*.4])for(const dz of [-item.size[1]*.35,item.size[1]*.35])add(dx,dz,.06,.06,.37,bronze);
          add(0,0,item.size[0],item.size[1],.075,timber,.37,.04,'wood');
        }
        if(type==='storage'||type==='shelf'){
          const [w,d]=item.size,h=item.height;
          add(0,0,w,d,.09,timber);
          if(type==='shelf'){
            add(-w/2+.035,0,.07,d,h,cabinetry);
            add(w/2-.035,0,.07,d,h,cabinetry);
            add(0,-d/2+.018,w,.035,h,cabinetry);
            const shelves=Math.max(2,Math.floor(h/.36));
            for(let i=1;i<=shelves;i++){
              const at=i*h/shelves;
              add(0,0,w,d,.045,timber,at-.045);
              if(i<shelves)for(let j=0;j<3;j++)add(-w*.30+j*.13,0,.09,d*.68,.2,[fabric,accent,trim][j],at,.015,'linen');
            }
          }else{
            add(0,0,w,d,h,cabinetry);
            const drawers=h<1.1?3:2;
            for(let i=0;i<drawers;i++){
              const vertical=h>=1.1;
              add(vertical?(-w/2+(i+.5)*w/drawers):0,d/2+.012,vertical?.02:w-.06,.022,vertical?h-.08:.022,bronze,vertical?.04:(i+1)*h/drawers);
              add(vertical?(-w/2+(i+.5)*w/drawers):0,d/2+.027,.12,.03,.025,bronze,vertical?h*.52:(i+.5)*h/drawers);
            }
          }
        }
        if(type==='plant') {
          add(0,0,.39,.39,.37,stone,0,.105,'stone');
          add(0,0,.44,.44,.066,timber,.34,.105);
          add(0,0,.055,.055,.62,timber,.39);
          for(let i=0;i<8;i++){
            const direction=i*2.4,dx=Math.cos(direction),dz=Math.sin(direction),start=.59+i*.055;
            const size=.26-(i%4)*.025,wide=.088;
            const points=[[0,start,0],[dx*size*.43-dz*wide,start+.11,dz*size*.43+dx*wide],[dx*size,start+.21,dz*size],
              [dx*size*.60+dz*wide,start+.13,dz*size*.60-dx*wide]].map(([px,y,pz])=>{
                const [wx,wz]=local(px*sx,pz*sz);return [wx,y,wz];
              });
            face(points,i%2?'#829968':'#536e50','#4b604765',owner,faces,'leaves');
          }
        }
      }
    }

    return {
      schedule, pixelToFloor(x,y){return view?.ground(x,y);},
      hit(x,y){
        // The path was constructed in CSS pixels; hit testing uses an identity transform.
        ctx.save();ctx.resetTransform();
        const result=[...hitFaces].reverse().find(item=>!item.owner.endsWith('-ghost')&&ctx.isPointInPath(item.shape,x,y))?.owner;
        ctx.restore();
        return result;
      },
      rotate(dx,dy){angle=clamp(angle+dx,-1.18,.72);lift=clamp(lift+dy,.32,1.49);schedule();},
      setView(top){angle=top?0:-.64;lift=top?1.49:.64;zoom=1;schedule();},
      scaleBy(amount){zoom=clamp(zoom+amount,.74,1.45);schedule();},
      destroy(){alive=false;observer.disconnect();}
    };
  }
  return {mount,pieces,colors,fits,suggest,floorPlan,footprint};
})();
