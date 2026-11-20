'use strict';

const MoveInScene=(()=>{
  function createView(width,height){
    const mobile=width<600,focal=width*1.1,centerY=height*(mobile?.5:.53);
    const sy=Math.sin(.4),cy=Math.cos(.4),distance=14,targetY=2.2;
    function project(x,y,z){
      const depth=distance-(y-targetY)*sy-z*cy;
      return [width/2+x*focal/depth,centerY-((y-targetY)*cy-z*sy)*focal/depth,depth];
    }
    function targetAt(x,lane){
      const z=MoveInArcade.lanes[lane].z+.43;
      const depth=distance-(MoveInArcade.bedHeight-targetY)*sy-z*cy;
      return Math.max(MoveInArcade.minX,Math.min(MoveInArcade.maxX,.5+(x-width/2)*depth/focal/MoveInArcade.fieldWidth));
    }
    return {project,targetAt,mobile};
  }
  function mount(canvas,getState){
    const ctx=canvas.getContext('2d');let alive=true;
    const resize=new ResizeObserver(()=>draw(getState()));resize.observe(canvas);
    function targetAt(x,y,chooseLane=false){
      const view=createView(canvas.clientWidth,canvas.clientHeight),s=getState();
      const back=view.project(0,0,MoveInArcade.lanes.blue.z)[1],front=view.project(0,0,MoveInArcade.lanes.brown.z)[1];
      let lane=s.lane;
      if(chooseLane&&y>back-canvas.clientHeight*.1)lane=y<(back+front)/2?'blue':'brown';
      return {target:view.targetAt(x,lane),lane};
    }
    function draw(s){
      if(!alive)return;
      const W=canvas.clientWidth,H=canvas.clientHeight;if(!W||!H)return;
      const ratio=Math.min(devicePixelRatio||1,1,Math.sqrt(1200000/(W*H)));
      const px=Math.round(W*ratio),py=Math.round(H*ratio);
      if(canvas.width!==px||canvas.height!==py){canvas.width=px;canvas.height=py;}
      ctx.setTransform(px/W,0,0,py/H,0,0);
      const {project,mobile}=createView(W,H),scale=W/(mobile?640:1000),faces=[],floorFaces=[];
      const text=(label,x,y,size,color='#284c49',align='center')=>{
        ctx.font=`750 ${size*scale}px "Segoe UI",sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(label,x,y);
      };
      const face=(points,fill,edge=null,layer=faces)=>{
        const p=points.map(a=>project(...a));
        if(p.every(a=>a[0]<0)||p.every(a=>a[0]>W)||p.every(a=>a[1]<0)||p.every(a=>a[1]>H))return;
        const item={p,fill,edge,depth:p.reduce((sum,a)=>sum+a[2],0)/p.length};
        layer.push(item);return item;
      };
      const front=(x,y,z,w,h,color,edge=null)=>face([[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]],color,edge);
      const cube=(x,y,z,w,h,d,colors)=>{
        const [top,side,near]=colors;
        front(x,y,z+d,w,h,near);
        face([[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]],top);
        const sx=x+w/2<0?x+w:x;
        face([[sx,y,z],[sx,y,z+d],[sx,y+h,z+d],[sx,y+h,z]],side);
      };
      const disk=(x,y,z,r,color)=>{
        const points=[];for(let i=0;i<16;i++){const a=i*Math.PI/8;points.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z]);}face(points,color);
      };
      ctx.fillStyle='#c6d8d7';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#f2e6bf';ctx.beginPath();ctx.arc(W*.87,H*.08,22*scale,0,Math.PI*2);ctx.fill();
      face([[-16,0,-13],[16,0,-13],[16,0,8],[-16,0,8]],'#d2d5c3',null,floorFaces);
      // The house and gantry share the same world projection as the truck.
      cube(-5.2,0,-6.5,10.4,4.8,.5,['#e8deca','#bdc8b8','#f2e7d2']);
      front(-5.2,4.65,-5.98,10.4,.35,'#31534f');
      const facadeDepth=project(0,2.4,-6)[2];
      for(let i=0;i<48;i++){
        const row=Math.floor(i/8),col=i%8,x=-4.75+col*1.2,y=.38+row*.67,lit=i<s.lit;
        const window=front(x,y,-5.97,.82,.45,lit?'#ffe3a0':'#35525b',lit?'#e5c17c':null);
        const frame=front(x+.39,y,-5.95,.025,.45,lit?'#c8a365':'#6b8787');
        // Coplanar facade details belong above their wall, irrespective of the
        // average depth of a low window versus the full-height wall polygon.
        if(window)window.depth=facadeDepth-.05;
        if(frame)frame.depth=facadeDepth-.06;
      }
      const door=front(-.45,0,-5.94,.9,.55,'#456963');if(door)door.depth=facadeDepth-.06;
      for(const lane of ['blue','brown']){
        const z=MoveInArcade.lanes[lane].z,blue=lane==='blue',active=s.lane===lane;
        face([[-6,.015,z-.8],[6,.015,z-.8],[6,.015,z+.8],[-6,.015,z+.8]],blue?'#bed5df':'#dfc9a7',active?(blue?'#548eb0':'#b07c42'):null,floorFaces);
        face([[-6,.02,z-.74],[6,.02,z-.74],[6,.02,z-.65],[-6,.02,z-.65]],blue?'#6ca0b8':'#bf955d',null,floorFaces);
        // Both beams are physically at the same height. Each colour has its own drop plane.
        for(const x of [-5.6,5.6])cube(x-.06,0,z-.08,.12,MoveInArcade.dropHeight+.15,.16,['#e0bb70','#9c7b45','#b99356']);
        cube(-5.7,MoveInArcade.dropHeight,z-.13,11.4,.13,.26,blue?['#9fc5d8','#5484a0','#6e9db5']:['#e8c99c','#a47c48','#c49b62']);
      }
      for(const x of [-5.6,5.6])cube(x-.065,MoveInArcade.dropHeight,-1.8,.13,.13,3.3,['#e3c381','#947a50','#bea16b']);
      function parcel(x,bottom,z,item,unit=MoveInArcade.crateSize,thickness=.38){
        const shape=MoveInArcade.shapes[item.shape],blue=item.lane==='blue';
        for(const [cx,cy] of shape.cells){
          const xx=x+(cx-shape.width/2)*unit,yy=bottom+(shape.height-1-cy)*unit;
          cube(xx,yy,z-thickness/2,unit*.97,unit*.97,thickness,blue?['#8bb9d4','#3b6f91','#548fb8']:['#dfb883','#976b3e','#bf8d55']);
          front(xx+unit*.42,yy+.025,z+thickness/2+.005,unit*.15,unit*.90,blue?'#bdddea':'#edcda2');
        }
      }
      function hazard(x,bottom,z,lane){
        cube(x-.24,bottom,z-.22,.48,.9,.44,['#db9073','#8c4034','#bb5945']);
        front(x-.24,bottom+.33,z+.225,.48,.25,'#f1ca6d');
        front(x-.26,bottom+.01,z+.23,.52,.09,lane==='blue'?'#4d91bf':'#bd874f');
        cube(x-.08,bottom+.9,z-.08,.16,.13,.16,['#747b6c','#414f4b','#58645a']);
      }
      for(const box of s.falling){
        const x=(box.x-.5)*MoveInArcade.fieldWidth,z=MoveInArcade.lanes[box.lane].z+.43;
        const bottom=MoveInArcade.dropHeight-box.progress*(MoveInArcade.dropHeight-MoveInArcade.bedHeight);
        if(box.type==='hazard')hazard(x,bottom,z,box.lane);else parcel(x,bottom,z,box);
      }
      const x=(s.player-.5)*MoveInArcade.fieldWidth,z=MoveInArcade.lanes[s.lane].z;
      const bob=s.moving?Math.sin(s.elapsed*16)*.018:0;
      const body=['#6c9d8f','#365d55','#487b6d'],dark=['#476861','#29463f','#365b51'];
      // Pickup: open loading bed on the left, cabin and hood on the right.
      cube(x-1.05,.52+bob,z-.62,3.2,.37,1.24,body);
      cube(x-.98,.88+bob,z-.53,1.78,.17,1.06,['#c1cdb5','#64796a','#8fa18a']);
      cube(x-1.1,.88+bob,z-.62,.14,.47,1.24,dark);
      cube(x-1.03,.9+bob,z-.64,1.87,.35,.13,body);
      cube(x-1.03,.9+bob,z+.51,1.87,.35,.13,body);
      cube(x+.81,.87+bob,z-.53,.96,1.18,1.06,body);
      cube(x+.75,2.05+bob,z-.57,1.08,.12,1.14,dark);
      front(x+.94,1.38+bob,z+.536,.65,.52,'#b4d6d8');
      front(x+1.22,1.38+bob,z+.54,.045,.52,'#456c60');
      front(x+1.41,1.18+bob,z+.54,.17,.045,'#d5dfc5');
      cube(x+1.77,.88+bob,z-.51,.50,.53,1.02,['#88ab91','#365e50','#5a8971']);
      cube(x+2.26,.57+bob,z-.57,.10,.22,1.14,['#9eae9e','#5a7167','#799083']);
      front(x+1.98,1.09+bob,z+.518,.22,.16,'#f4e7b0');
      for(const wheelX of [x-.64,x+1.47]){
        disk(wheelX,.35,z+.69,.33,'#2a3f42');disk(wheelX,.35,z+.70,.15,'#b0bfb6');disk(wheelX,.35,z-.65,.29,'#334b49');
      }
      // Eight individual boxes are packed in two columns, four levels. The front
      // loading strip stays clear, so every incoming box reaches the same bed height.
      const cargoHeights=[0,0];
      for(let i=0;i<s.cargo.length;i++){
        const column=i%2;
        parcel(x+(column?1:-1)*.36,MoveInArcade.bedHeight+cargoHeights[column],z-.24,s.cargo[i],.30,.25);
        cargoHeights[column]+=MoveInArcade.shapes[s.cargo[i].shape].height*.30+.025;
      }
      faces.sort((a,b)=>b.depth-a.depth);
      for(const item of [...floorFaces,...faces]){
        ctx.beginPath();item.p.forEach(([xx,yy],i)=>i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy));ctx.closePath();
        ctx.fillStyle=item.fill;ctx.fill();if(item.edge){ctx.strokeStyle=item.edge;ctx.lineWidth=1.6*scale;ctx.stroke();}
      }
      const age=s.impact?s.elapsed-s.impact.at:-1;
      if(age>=0&&age<1.15){
        const ix=(s.impact.x-.5)*MoveInArcade.fieldWidth,iz=MoveInArcade.lanes[s.impact.lane].z+.65,iy=MoveInArcade.bedHeight+.28;
        const puff=(xx,yy,r,color,alpha)=>{
          const p=project(xx,yy,iz),edge=project(xx+r,yy,iz);
          ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.arc(p[0],p[1],Math.abs(edge[0]-p[0]),0,Math.PI*2);ctx.fill();
        };
        ctx.save();
        if(age<.24){
          const t=age/.24,r=.22+Math.sin(t*Math.PI)*.55;
          ctx.globalAlpha=1-t;ctx.fillStyle='#ed9347';ctx.beginPath();
          for(let i=0;i<16;i++){
            const a=i*Math.PI/8,rr=r*(i%2?.58:1),p=project(ix+Math.cos(a)*rr,iy+Math.sin(a)*rr,iz);
            if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);
          }
          ctx.closePath();ctx.fill();puff(ix,iy,r*.46,'#fff0b2',1-t);
        }
        if(age<.45)for(let i=0;i<6;i++){
          const a=i*Math.PI/3+.3;
          puff(ix+Math.cos(a)*age*1.7,iy+Math.sin(a)*age*1.2,.035,'#e0a04b',(1-age/.45)*.85);
        }
        if(age>.07)for(let i=0;i<6;i++){
          const t=(age-.07)/1.08,a=i*2.4;
          puff(ix+Math.cos(a)*(.08+t*.45),iy+.2+t*.95+Math.sin(a)*.12,.12+t*.23,i%2?'#7b8580':'#9ba29b',(1-t)*.46);
        }
        ctx.restore();
      }
      const brand=project(0,4.83,-5.9);text('Г О Р И З О Н Т',brand[0],brand[1],mobile?19:17,'#f4ead1');
      for(const lane of ['blue','brown']){
        const blue=lane==='blue',point=project(-5.35,0,MoveInArcade.lanes[lane].z+.8);
        text(blue?'I · ДАЛЬНИЙ':'II · БЛИЖНИЙ',point[0]+6*scale,point[1]+16*scale,mobile?19:14,blue?'#356e8a':'#8e6335','left');
      }
      const load=project(x,1.1+Math.max(...cargoHeights),z+.35);
      if(s.cargo.length)text(`${s.cargo.length}/8 · ×${MoveInArcade.multiplier(s)}`,load[0],load[1]-14*scale,mobile?24:20,'#2b5846');
      if(s.cargo.length===8){const full=project(x,2.1,z+.4);text('КУЗОВ ПОЛОН',full[0],full[1]-20*scale,mobile?22:16,'#ad7030');}
      if(s.elapsed<s.stunnedUntil){const hit=project(x+1.3,2.55,z);text('!',hit[0],hit[1],32,'#ad4c37');}
      if(s.lastBatch&&s.elapsed-s.lastBatch.at<1.2)text('+'+s.lastBatch.amount+' материалов · ×'+s.lastBatch.factor,W*.5,H*.34-(s.elapsed-s.lastBatch.at)*12*scale,mobile?23:21,'#356b51');
    }
    return {draw,targetAt,destroy(){alive=false;resize.disconnect();}};
  }
  return {mount,createView};
})();
