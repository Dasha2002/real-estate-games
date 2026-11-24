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
    const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      const clock=reducedMotion?0:s.elapsed;
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
      const shade=(color,amount)=>'#'+color.slice(1).match(/../g).map(v=>Math.max(0,Math.min(255,parseInt(v,16)+amount)).toString(16).padStart(2,'0')).join('');
      // A single soft key light: warm upper-left highlights, cool contact shade.
      const finish=(color)=>({top:shade(color,27),middle:color,bottom:shade(color,-26),diagonal:true});
      const overlay=(item,parent)=>{if(item&&parent)item.depth=parent.depth-.015;return item;};
      const cube=(x,y,z,w,h,d,colors)=>{
        const [top,side,near]=colors;
        const panel=front(x,y,z+d,w,h,finish(near));
        if(panel)panel.radius=2.5*scale;
        face([[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]],{top:shade(top,15),bottom:shade(top,-10),diagonal:true});
        const sx=x+w/2<0?x+w:x;
        face([[sx,y,z],[sx,y,z+d],[sx,y+h,z+d],[sx,y+h,z]],finish(side));
        // A broad bevel catches the light without small texture or noisy outlines.
        const b=Math.min(w,h,d)*.12;
        overlay(face([[x,y+h,z+d],[x+w,y+h,z+d],[x+w-b,y+h-b,z+d],[x+b,y+h-b,z+d]],{top:shade(near,38),bottom:shade(near,16)}),panel);
        overlay(face([[x+b,y,z+d],[x+w-b,y,z+d],[x+w-b,y+b*.55,z+d],[x+b,y+b*.55,z+d]],shade(near,-32)),panel);
        return panel;
      };
      const disk=(x,y,z,r,color)=>{
        const points=[];for(let i=0;i<32;i++){const a=i*Math.PI/16;points.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z]);}return face(points,color);
      };
      const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#91bfd4');sky.addColorStop(.65,'#d6e2dc');sky.addColorStop(1,'#f1e3c3');
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      for(const [radius,alpha] of [[66,.035],[47,.06],[30,.85]]){
        ctx.fillStyle=`rgba(255,238,190,${alpha})`;ctx.beginPath();ctx.arc(W*.84,H*.13,radius*scale,0,Math.PI*2);ctx.fill();
      }
      // Broad softly lit clouds and staggered city blocks establish a distant plane.
      for(const [cx,cy,r] of [[.16,.17,28],[.21,.15,38],[.27,.18,26],[.58,.08,22],[.62,.065,29]]){
        const drift=Math.sin(clock*.035)*W*.035;
        ctx.fillStyle='#edf3eb90';ctx.beginPath();ctx.ellipse(W*cx+drift,H*cy,r*scale,r*.35*scale,0,0,Math.PI*2);ctx.fill();
      }
      for(const [bx,bh,bw,bz] of [[-12,3.2,2.5,-16],[-8.7,4.5,2.2,-18],[-5.3,3.8,2.6,-19],[3.8,4.2,2.4,-19],[7.6,4.6,2.5,-17],[11,3.2,2.8,-16]]){
        const wall=cube(bx,0,bz,bw,bh,2,['#cadbd5','#8baeb4','#b1c9c8']);
        cube(bx+.16,bh,bz+.18,bw-.32,.16,1.64,['#dce6dc','#8ba8aa','#b5cbc6']);
        for(let row=0;row<3;row++)for(let col=0;col<2;col++)overlay(front(bx+.35+col*(bw*.45),.5+row*.85,bz+2.01,.35,.48,'#8cafb6'),wall);
      }
      face([[-24,0,-22],[24,0,-22],[24,0,12],[-24,0,12]],{top:'#dddbc3',bottom:'#bfa57e'},null,floorFaces);
      // Large changes of elevation read as earthworks, without gravel noise.
      for(const sx of [-10,6.5]){
        face([[sx,0,-8],[sx+3.4,0,-8],[sx+3,.55,-3],[sx+.4,.55,-3]],'#d8c29a',null,floorFaces);
        face([[sx+.4,.55,-3],[sx+3,.55,-3],[sx+3.4,0,-1],[sx,0,-1]],{top:'#c8ad7f',bottom:'#b4966b'},null,floorFaces);
      }
      const groundShadow=(cx,cz,rx,rz,alpha)=>{
        const points=[];for(let i=0;i<32;i++){const a=i*Math.PI/16;points.push([cx+Math.cos(a)*rx,.025,cz+Math.sin(a)*rz]);}
        face(points,{softShadow:alpha},null,floorFaces);
      };
      const leaf=(x,y,z,rx,ry,fill)=>{
        const points=[];for(let i=0;i<20;i++){const a=i*Math.PI/10;points.push([x+Math.cos(a)*rx,y+Math.sin(a)*ry,z]);}
        const material=typeof fill==='object'?{...fill,sphere:true}:fill;
        return face(points,material);
      };
      function tree(x,z,size=1){
        const sway=Math.sin(clock*.75+x)*.035*size;
        groundShadow(x+.3,z+.2,.7*size,.28*size,.08);
        cube(x-.055*size,0,z-.055,.11*size,1.1*size,.11,['#c9ae78','#8e8866','#ad9e73']);
        leaf(x+sway,1.52*size,z,.62*size,.85*size,{top:'#9ebc8d',bottom:'#4e806c'});
        leaf(x-.25*size+sway,1.47*size,z+.03,.36*size,.55*size,{top:'#c0cd99',bottom:'#79a07d'});
        leaf(x+.24*size+sway,1.75*size,z+.04,.33*size,.50*size,{top:'#a4bd88',bottom:'#72997a'});
      }
      // A planted strip separates the site from the neighbourhood.
      for(const sx of [-7.1,6.0]){
        cube(sx-.25,0,-5.4,1.45,.16,1.1,['#a7b38a','#839877','#94a780']);
        tree(sx+.2,-5.15,1.05);tree(sx+.85,-6.0,.78);
      }
      groundShadow(0,-5.4,5.6,1.1,.10);
      // Foreground concrete slabs lead the eye into the scene; raised edge blocks
      // give a scale reference without occupying either drivable lane.
      for(let row=0;row<3;row++)for(let col=0;col<4;col++){
        const px=-4+col*2,pz=3.2+row*1.25;
        face([[px,.012,pz],[px+1.97,.012,pz],[px+1.97,.012,pz+1.22],[px,.012,pz+1.22]],(row+col)%2?'#c9bea2':'#cfc5ab',null,floorFaces);
      }
      for(const sx of [-6.3,4.8]){
        groundShadow(sx+.65,3.8,1,.5,.10);
        const barrier=cube(sx,0,3.4,1.5,.33,.48,['#e2d7b8','#87958a','#b4b6a1']);
        for(const stripe of [.12,.64,1.16])overlay(front(sx+stripe,.06,3.885,.20,.19,'#d5b16b'),barrier);
      }
      // Foreground site office: shaded recesses, ribbed walls, canopy and steps.
      const ox=-3.85,oz=4.5;
      groundShadow(ox+1.3,oz+.8,1.35,.55,.12);
      const office=cube(ox,.08,oz,2.05,1.14,1.15,['#e3dfc5','#688980','#a8bbab']);
      for(let rib=0;rib<9;rib++)overlay(front(ox+.10+rib*.21,.17,oz+1.155,.025,.95,'#8da999'),office);
      overlay(front(ox+.21,.57,oz+1.17,.68,.45,'#476d74'),office);
      overlay(front(ox+.25,.61,oz+1.18,.60,.36,{top:'#c6e2df',bottom:'#729caa'}),office);
      overlay(front(ox+.53,.61,oz+1.19,.035,.36,'#e7e8d3'),office);
      overlay(front(ox+1.25,.17,oz+1.17,.55,.92,'#547d70'),office);
      overlay(front(ox+1.31,.65,oz+1.18,.43,.34,'#b8d7d0'),office);
      overlay(front(ox+1.63,.51,oz+1.19,.07,.035,'#f1e8c7'),office);
      cube(ox-.11,1.22,oz-.11,2.27,.12,1.38,['#eee5c9','#738e80','#c4c9ac']);
      cube(ox+1.1,.02,oz+1.20,.86,.10,.43,['#d5cfb2','#919e8a','#b4bda4']);
      const officeSign=cube(ox+.25,1.36,oz+.71,1.34,.28,.10,['#d9bf86','#7d8d72','#b6ac7f']);
      overlay(front(ox+.37,1.46,oz+.82,1.10,.035,'#f6edcc'),officeSign);
      // Timber on bearers, a coiled hose and a wheelbarrow give the depot a purpose.
      for(const leg of [2.25,3.6])cube(leg,.03,4.0,.17,.15,1.0,['#bca275','#8f7957','#a48c65']);
      for(let row=0;row<3;row++)for(let beam=0;beam<3;beam++)cube(2.12,.18+row*.12,3.98+beam*.26,1.9,.10,.23,['#e1c08a','#aa885b','#c59f6b']);
      cube(2.42,.20,3.96,.07,.32,.78,['#8d9f91','#6f847b','#82988a']);
      cube(3.66,.20,3.96,.07,.32,.78,['#8d9f91','#6f847b','#82988a']);
      const hose=[];for(let i=0;i<64;i++){const a=i*Math.PI/12,r=.08+i*.004;hose.push([1.8+Math.cos(a)*r,.025,5.35+Math.sin(a)*r*.65]);}
      // A thin world-space ribbon, rather than texture, keeps the coil legible.
      for(let i=1;i<hose.length;i++){
        const a=hose[i-1],b=hose[i];face([a,b,[b[0]+.025,b[1],b[2]+.025],[a[0]+.025,a[1],a[2]+.025]],'#708c7a',null,floorFaces);
      }
      const barrow=cube(3.9,.28,5.3,.66,.27,.46,['#d2af74','#8c8260','#b1a072']);
      disk(4.43,.18,5.83,.14,'#4b665d');disk(4.43,.18,5.84,.06,'#b6c5ad');
      for(const bz of [5.32,5.69])cube(3.54,.43,bz,.43,.045,.045,['#a3b09b','#667e70','#839682']);
      // One small worker walks only in the foreground service area.
      function worker(wx,wz,moving=false){
        const stride=moving?Math.sin(clock*3.5)*.08:0;
        groundShadow(wx,wz,.19,.10,.11);
        for(const side of [-1,1]){
          cube(wx+side*.07-.035,.025,wz+stride*side,.065,.23,.08,['#6f8d85','#405f5d','#55756e']);
          cube(wx+side*.07-.04,.01,wz+.03+stride*side,.08,.055,.13,['#61756b','#3e5751','#4c655d']);
        }
        const vest=cube(wx-.12,.25,wz-.05,.24,.29,.16,['#edc177','#c18e52','#dca65e']);
        overlay(front(wx-.12,.34,wz+.115,.24,.035,'#f9e7b3'),vest);
        leaf(wx,.62,wz+.025,.09,.10,'#c79e79');
        leaf(wx,.70,wz+.04,.125,.07,{top:'#ffe0a0',bottom:'#d6aa62'});
        for(const side of [-1,1])cube(wx+side*.15-.025,.29+stride*side,wz+.015,.05,.20,.07,['#dfb47e','#ae8968','#d3a375']);
      }
      worker(-.4+Math.sin(clock*.17)*.65,4.9,true);worker(-1.6,5.9);
      face([[-5.3,.03,-5.9],[5.4,.03,-5.9],[7.1,.03,-3.2],[-3.7,.03,-3.2]],'#38565024',null,floorFaces);
      // The house and gantry share the same world projection as the truck.
      cube(-5.45,0,-8.8,10.9,.28,3.2,['#d3c4a7','#89958a','#b0ad96']);
      const houseWall=cube(-5.2,.28,-8.6,10.4,4.52,2.6,['#f5e8c9','#9aa99e','#e8d8b5']);
      cube(-5.32,4.8,-8.72,10.64,.18,2.84,['#fff0cd','#95a39a','#c8c2a6']);
      cube(-5.2,4.98,-8.6,10.4,.24,.12,['#e6dcc0','#8b9e94','#b6bba5']);
      for(const sx of [-5.2,5.08])cube(sx,4.98,-8.6,.12,.24,2.6,['#ece2c7','#899f94','#c1c4a9']);
      cube(-3.8,4.99,-8.0,1.7,.48,.9,['#d7ded1','#839b92','#aabcb0']);
      cube(2.8,4.99,-8.2,.5,.74,.55,['#e6d9bd','#97a398','#bfc1a8']);
      const sign=front(-5.2,4.65,-5.85,10.4,.35,'#31534f');
      if(sign)sign.depth=project(0,5.3,-5.8)[2]-.3;
      const facadeDepth=houseWall?houseWall.depth:project(0,2.54,-6)[2];
      for(let row=1;row<6;row++){
        const slab=cube(-5.22,.30+row*.67,-6.04,10.44,.065,.17,['#f8edcf','#a4ac99','#c8bea2']);
        if(slab)slab.depth=facadeDepth-.025;
      }
      for(let i=0;i<48;i++){
        const row=Math.floor(i/8),col=i%8,x=-4.75+col*1.2,y=.38+row*.67,lit=i<s.lit;
        const recess=front(x-.04,y-.025,-5.98,.90,.51,'#8c9382');if(recess)recess.depth=facadeDepth-.04;
        const window=front(x,y,-5.97,.82,.45,lit?{top:'#fff0b9',bottom:'#efbc66'}:{top:'#86b5bf',bottom:'#344f63'},lit?'#e5c17c':null);
        const frame=front(x+.39,y,-5.95,.025,.45,lit?'#c8a365':'#6b8787');
        // Coplanar facade details belong above their wall, irrespective of the
        // average depth of a low window versus the full-height wall polygon.
        if(window)window.depth=facadeDepth-.05;
        if(frame)frame.depth=facadeDepth-.06;
        const sill=front(x-.04,y-.055,-5.94,.9,.055,'#bfc5b6');if(sill)sill.depth=facadeDepth-.07;
        const shade=front(x-.04,y+.42,-5.93,.9,.055,'#d7ccb0');if(shade)shade.depth=facadeDepth-.075;
      }
      const door=front(-.45,0,-5.94,.9,.55,'#456963');if(door)door.depth=facadeDepth-.06;
      cube(-.7,.62,-6.0,1.4,.10,.58,['#e1d5b5','#658479','#9eac96']);
      // Large construction silhouettes stay behind both play lanes.
      for(const sx of [-5.45,5.45])for(const yy of [0,1.6,3.2]){
        for(const px of [sx-.16,sx+.45])cube(px,yy,-6,.11,1.6,.12,['#d3c6a1','#a6a38b','#c0b99b']);
        cube(sx-.2,yy+1.5,-6.08,.83,.10,.5,['#d0c4a2','#a8a58d','#c0b99c']);
      }
      for(const rx of [-4.7,-3.5,3.5,4.7])cube(rx,4.95,-6.3,.04,.42,.04,['#c5bca6','#8f9b92','#a7aea0']);
      // Fence, pallet of blocks and bundled pipes frame the worksite.
      for(const sx of [-5.8,3.9]){
        cube(sx,0,-4.3,1.9,.65,.10,['#a4b9ad','#78958b','#8fa89a']);
        for(const post of [sx,sx+1.85])cube(post-.025,0,-4.26,.06,.82,.08,['#c5c7ac','#7d9487','#9aab96']);
      }
      cube(-5.5,.03,-3.8,1.25,.10,.65,['#c2a375','#947749','#ac8b5f']);
      for(let row=0;row<2;row++)for(let col=0;col<3;col++)cube(-5.45+col*.4,.13+row*.24,-3.76,.36,.22,.48,['#e2dac4','#aaa995','#c9c4b0']);
      // Hollow concrete pipes: rounded lit bodies and recessed dark openings.
      for(const [tx,ty] of [[4.28,.18],[4.66,.18],[5.04,.18],[4.66,.51]]){
        const r=.18,back=-4.35,near=-3.35;
        for(let side=0;side<16;side++){
          const a=side*Math.PI/8,b=(side+1)*Math.PI/8;
          const light=Math.round(20*Math.sin((a+b)/2)-8*Math.cos((a+b)/2));
          face([[tx+Math.cos(a)*r,ty+Math.sin(a)*r,back],[tx+Math.cos(b)*r,ty+Math.sin(b)*r,back],[tx+Math.cos(b)*r,ty+Math.sin(b)*r,near],[tx+Math.cos(a)*r,ty+Math.sin(a)*r,near]],shade('#a4b6a9',light));
        }
        const rim=disk(tx,ty,near+.005,r,{top:'#d9dfca',bottom:'#92a798'});
        overlay(disk(tx,ty,near+.01,r*.67,{top:'#456b61',bottom:'#78988a'}),rim);
      }
      for(const lane of ['blue','brown']){
        const z=MoveInArcade.lanes[lane].z,blue=lane==='blue',active=s.lane===lane;
        face([[-6.1,.012,z-.91],[6.1,.012,z-.91],[6.1,.012,z+.91],[-6.1,.012,z+.91]],'#b8b5a0',null,floorFaces);
        face([[-6,.015,z-.8],[6,.015,z-.8],[6,.015,z+.8],[-6,.015,z+.8]],blue?{top:'#b2cbd1',bottom:'#91b5c2'}:{top:'#dac6a3',bottom:'#c4aa7e'},active?(blue?'#548eb0':'#b07c42'):null,floorFaces);
        for(const offset of [-.38,.38])face([[-5.9,.022,z+offset-.07],[5.9,.022,z+offset-.07],[5.9,.022,z+offset+.07],[-5.9,.022,z+offset+.07]],blue?'#9ebec8':'#cdb58e',null,floorFaces);
        for(let joint=-4;joint<6;joint+=2)face([[joint,.024,z-.8],[joint+.022,.024,z-.8],[joint+.022,.024,z+.8],[joint,.024,z+.8]],blue?'#89adb9':'#b99f78',null,floorFaces);
        face([[-6,.02,z-.74],[6,.02,z-.74],[6,.02,z-.65],[-6,.02,z-.65]],blue?'#6ca0b8':'#bf955d',null,floorFaces);
        for(let dash=-5;dash<6;dash+=1.2)face([[dash,.026,z+.62],[dash+.55,.026,z+.62],[dash+.55,.026,z+.67],[dash,.026,z+.67]],'#fff9e6',null,floorFaces);
        for(const edge of [-.86,.80])cube(-6,0,z+edge,12,.065,.06,['#e8dfc5','#9ba797',blue?'#8eaeb6':'#baa27c']);
        // Both beams are physically at the same height. Each colour has its own drop plane.
        for(const x of [-5.6,5.6])cube(x-.06,0,z-.08,.12,MoveInArcade.dropHeight+.15,.16,['#e0bb70','#9c7b45','#b99356']);
        cube(-5.7,MoveInArcade.dropHeight,z-.13,11.4,.13,.26,blue?['#9fc5d8','#5484a0','#6e9db5']:['#e8c99c','#a47c48','#c49b62']);
      }
      for(const x of [-5.6,5.6])cube(x-.065,MoveInArcade.dropHeight,-1.8,.13,.13,3.3,['#e3c381','#947a50','#bea16b']);
      for(const fx of [-5.6,5.6]){
        cube(fx-.025,5.72,-1.8,.05,.6,.05,['#c5c3a1','#8a9e8d','#b3b89b']);
        const wave=Math.sin(clock*1.8+fx)*.065;
        face([[fx,6.24,-1.76],[fx+.47,6.15+wave,-1.72],[fx+.40,5.94+wave,-1.70],[fx,6.02,-1.76]],{top:'#e6c78a',bottom:'#bd9c62'});
      }
      for(const cx of [-5.8,5.8]){
        cube(cx-.15,.02,-.3,.3,.04,.3,['#e6b66d','#a47b4c','#b98b52']);
        const cone=face([[cx-.1,.06,-.05],[cx+.1,.06,-.05],[cx+.035,.43,-.15],[cx-.035,.43,-.15]],{top:'#edbb77',bottom:'#ce8551'});
        overlay(front(cx-.063,.23,-.04,.126,.07,'#fff0cf'),cone);
      }
      function parcel(x,bottom,z,item,unit=MoveInArcade.crateSize,thickness=.38){
        const shape=MoveInArcade.shapes[item.shape],blue=item.lane==='blue';
        for(const [cx,cy] of (item.cells??shape.cells)){
          const xx=x+(cx-shape.width/2)*unit,yy=bottom+(shape.height-1-cy)*unit;
          const panel=cube(xx,yy,z-thickness/2,unit*.97,unit*.97,thickness,blue?['#a2d3ec','#346a8a','#5b9fc7']:['#efd09b','#946334','#c7965d']);
          overlay(front(xx+unit*.42,yy+unit*.04,z+thickness/2+.005,unit*.15,unit*.89,blue?'#d1e8ee':'#f4dcb5'),panel);
          overlay(front(xx+unit*.09,yy+unit*.24,z+thickness/2+.008,unit*.23,unit*.27,'#f4edda'),panel);
          overlay(front(xx+unit*.13,yy+unit*.30,z+thickness/2+.009,unit*.15,unit*.035,blue?'#527b92':'#9a7349'),panel);
          overlay(front(xx+unit*.13,yy+unit*.39,z+thickness/2+.009,unit*.10,unit*.035,blue?'#527b92':'#9a7349'),panel);
          for(const corner of [0,.84])overlay(front(xx+unit*corner,yy+unit*.04,z+thickness/2+.01,unit*.09,unit*.14,blue?'#397395':'#996f43'),panel);
          face([[xx+unit*.42,yy+unit*.97,z-thickness/2],[xx+unit*.57,yy+unit*.97,z-thickness/2],[xx+unit*.57,yy+unit*.97,z+thickness/2],[xx+unit*.42,yy+unit*.97,z+thickness/2]],blue?'#d1e8ee':'#f4dcb5');
        }
      }
      function hazard(x,bottom,z,lane){
        // Rounded pressure bottle: dark red body, broad warning band, visible valve.
        const points=[[-.16,0],[-.24,.09],[-.24,.71],[-.16,.86],[.16,.86],[.24,.71],[.24,.09],[.16,0]].map(([xx,yy])=>[x+xx,bottom+yy,z+.22]);
        const panel=face(points,{top:'#d26e4e',bottom:'#752f30'},'#663334');
        if(panel)panel.radius=3*scale;
        overlay(front(x-.24,bottom+.31,z+.23,.48,.25,'#f4ce68'),panel);
        overlay(face([[x,bottom+.53,z+.24],[x+.11,bottom+.35,z+.24],[x-.11,bottom+.35,z+.24]],'#443d32'),panel);
        overlay(front(x-.025,bottom+.39,z+.25,.05,.08,'#ffedba'),panel);
        overlay(front(x-.21,bottom+.08,z+.24,.06,.6,'#e79570'),panel);
        overlay(front(x-.21,bottom+.01,z+.24,.42,.07,lane==='blue'?'#4d91bf':'#bd874f'),panel);
        cube(x-.07,bottom+.86,z-.07,.14,.13,.14,['#a8b9af','#4f6860','#6c857c']);
        cube(x-.15,bottom+.98,z-.05,.3,.05,.1,['#e5c078','#8c6435','#c2944e']);
      }
      for(const box of s.falling){
        const x=(box.x-.5)*MoveInArcade.fieldWidth,z=MoveInArcade.lanes[box.lane].z+.43;
        const bottom=MoveInArcade.dropHeight-box.progress*(MoveInArcade.dropHeight-MoveInArcade.bedHeight);
        if(box.type==='hazard')hazard(x,bottom,z,box.lane);else parcel(x,bottom,z,box);
      }
      const x=(s.player-.5)*MoveInArcade.fieldWidth,z=MoveInArcade.lanes[s.lane].z;
      groundShadow(x+.5,z+.14,2,.68,.09);groundShadow(x+.5,z+.14,1.7,.48,.10);
      const bob=s.moving?Math.sin(s.elapsed*16)*.018:0;
      const body=['#6c9d8f','#365d55','#487b6d'],dark=['#476861','#29463f','#365b51'];
      // Pickup: open loading bed on the left, cabin and hood on the right.
      cube(x-1.05,.52+bob,z-.62,3.2,.37,1.24,body);
      cube(x-.98,.88+bob,z-.53,1.78,.17,1.06,['#c1cdb5','#64796a','#8fa18a']);
      for(let rib=0;rib<5;rib++)face([[x-.87+rib*.32,1.055+bob,z-.45],[x-.84+rib*.32,1.055+bob,z-.45],[x-.84+rib*.32,1.055+bob,z+.42],[x-.87+rib*.32,1.055+bob,z+.42]],'#708a78');
      cube(x-1.1,.88+bob,z-.62,.14,.47,1.24,dark);
      cube(x-1.03,.9+bob,z-.64,1.87,.35,.13,body);
      const bedSide=cube(x-1.03,.9+bob,z+.51,1.87,.35,.13,body);
      overlay(front(x-.93,.95+bob,z+.645,1.66,.035,'#335e52'),bedSide);
      overlay(front(x-.93,1.15+bob,z+.645,1.66,.03,'#85aa91'),bedSide);
      for(const latch of [-.86,.61])overlay(front(x+latch,1.03+bob,z+.65,.07,.10,'#b9c9af'),bedSide);
      const cabin=cube(x+.81,.87+bob,z-.53,.96,1.18,1.06,body);
      // Wraparound windscreen and a tapered bonnet give the cab a second lit plane.
      face([[x+1.775,1.43+bob,z-.43],[x+1.775,1.43+bob,z+.43],[x+1.775,1.94+bob,z+.37],[x+1.775,1.94+bob,z-.37]],{top:'#cbe8e6',bottom:'#668f9a'});
      cube(x+.75,2.05+bob,z-.57,1.08,.12,1.14,dark);
      overlay(face([[x+.94,1.38+bob,z+.536],[x+1.59,1.38+bob,z+.536],[x+1.53,1.9+bob,z+.536],[x+.94,1.9+bob,z+.536]],{top:'#d7f0ee',bottom:'#739eac'}),cabin);
      overlay(face([[x+1.01,1.43+bob,z+.54],[x+1.10,1.43+bob,z+.54],[x+1.45,1.86+bob,z+.54],[x+1.30,1.86+bob,z+.54]],'#e5f4ed'),cabin);
      overlay(front(x+1.41,1.18+bob,z+.54,.17,.045,'#e1dfbf'),cabin);
      overlay(front(x+.94,.98+bob,z+.54,.65,.045,'#a8bfa2'),cabin);
      overlay(front(x+.87,.94+bob,z+.54,.025,.96,'#315b50'),cabin);
      overlay(front(x+1.61,.94+bob,z+.54,.025,.96,'#315b50'),cabin);
      const hood=cube(x+1.77,.88+bob,z-.51,.50,.53,1.02,['#88ab91','#365e50','#5a8971']);
      face([[x+1.79,1.415+bob,z-.43],[x+2.21,1.415+bob,z-.43],[x+2.21,1.415+bob,z+.43],[x+1.79,1.415+bob,z+.43]],{top:'#a5c2a3',bottom:'#719c80'});
      face([[x+2.275,.91+bob,z-.33],[x+2.275,.91+bob,z+.33],[x+2.275,1.13+bob,z+.33],[x+2.275,1.13+bob,z-.33]],'#36564d');
      for(const lampZ of [z-.40,z+.25])face([[x+2.28,1.16+bob,lampZ],[x+2.28,1.16+bob,lampZ+.15],[x+2.28,1.32+bob,lampZ+.15],[x+2.28,1.32+bob,lampZ]],'#fff0b9');
      for(let vent=0;vent<3;vent++)overlay(front(x+1.83+vent*.065,1.14+bob,z+.515,.03,.13,'#375d51'),hood);
      cube(x+2.26,.57+bob,z-.57,.10,.22,1.14,['#9eae9e','#5a7167','#799083']);
      front(x+1.98,1.09+bob,z+.518,.22,.16,'#f4e7b0');
      const mirror=cube(x+1.69,1.46+bob,z+.53,.18,.16,.16,['#b1c3b1','#365b51','#597e70']);
      overlay(front(x+1.72,1.49+bob,z+.695,.12,.10,'#cce1dc'),mirror);
      front(x-1.04,.65+bob,z+.64,.07,.16,'#d98262');
      for(const wheelX of [x-.64,x+1.47]){
        disk(wheelX,.36,z-.65,.32,'#334b49');
        const tire=disk(wheelX,.36,z+.69,.36,{top:'#43565a',bottom:'#202f35'});
        overlay(disk(wheelX,.36,z+.70,.23,'#1f3439'),tire);
        overlay(disk(wheelX,.36,z+.71,.17,{top:'#dbe3d8',bottom:'#91a99d'}),tire);
        for(let spoke=0;spoke<4;spoke++){
          const a=spoke*Math.PI/2+(s.moving?s.elapsed*s.moving*5:0);
          overlay(disk(wheelX+Math.cos(a)*.115,.36+Math.sin(a)*.115,z+.72,.025,'#607d75'),tire);
        }
        overlay(disk(wheelX,.36,z+.72,.065,'#55756c'),tire);
      }
      // Twelve individual boxes are packed in three columns, four levels. The front
      // loading strip stays clear, so every incoming box reaches the same bed height.
      const cargoHeights=[0,0,0];
      const boxes=s.cargo.flatMap(item=>Array.from({length:item.count??MoveInArcade.shapes[item.shape].cells.length},()=>({lane:item.lane,shape:'single'})));
      for(let i=0;i<boxes.length;i++){
        const column=i%3;
        const targetX=x-.1+(column-1)*.52,targetY=MoveInArcade.bedHeight+cargoHeights[column];
        const loading=s.loading.find(part=>part.slot===i);
        if(loading){
          const t=Math.min(1,(s.elapsed-loading.at)/.32),ease=1-(1-t)*(1-t),fromZ=MoveInArcade.lanes[loading.lane].z+.43;
          parcel(loading.x+(targetX-loading.x)*ease,loading.y+(targetY-loading.y)*ease+Math.sin(t*Math.PI)*.35,fromZ+(z-.10-fromZ)*ease,boxes[i],.62+(.50-.62)*ease,.38);
        }else parcel(targetX,targetY,z-.10,boxes[i],.50,.38);
        cargoHeights[column]+=.52;
      }
      faces.sort((a,b)=>b.depth-a.depth);
      for(const item of [...floorFaces,...faces]){
        ctx.beginPath();
        if(item.radius){
          const p=item.p;
          for(let i=0;i<p.length;i++){
            const prev=p[(i+p.length-1)%p.length],at=p[i],next=p[(i+1)%p.length];
            const r=Math.min(item.radius,Math.hypot(prev[0]-at[0],prev[1]-at[1])*.2,Math.hypot(next[0]-at[0],next[1]-at[1])*.2);
            const toward=(q)=>{const d=Math.hypot(q[0]-at[0],q[1]-at[1]);return [at[0]+(q[0]-at[0])*r/d,at[1]+(q[1]-at[1])*r/d];};
            const a=toward(prev),b=toward(next);if(i)ctx.lineTo(...a);else ctx.moveTo(...a);ctx.quadraticCurveTo(at[0],at[1],...b);
          }
        }else item.p.forEach(([xx,yy],i)=>i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy));
        ctx.closePath();
        if(typeof item.fill==='object'){
          const xs=item.p.map(p=>p[0]),ys=item.p.map(p=>p[1]),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
          let gradient;
          if(item.fill.softShadow){
            const cx=(left+right)/2,cy=(top+bottom)/2;
            ctx.fillStyle=`rgba(34,55,49,${item.fill.softShadow*.35})`;
            for(let ring=0;ring<6;ring++){
              const size=1-ring*.115;ctx.beginPath();
              item.p.forEach(([px,py],i)=>{const x=cx+(px-cx)*size,y=cy+(py-cy)*size;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
              ctx.closePath();ctx.fill();
            }
            continue;
          }else if(item.fill.sphere){
            const radius=Math.max(right-left,bottom-top)*.72;
            gradient=ctx.createRadialGradient(left+(right-left)*.28,top+(bottom-top)*.22,0,(left+right)/2,(top+bottom)/2,radius);
            gradient.addColorStop(0,shade(item.fill.top,18));gradient.addColorStop(.38,item.fill.top);gradient.addColorStop(1,item.fill.bottom);
          }else{
            gradient=ctx.createLinearGradient(item.fill.diagonal?left:0,top,item.fill.diagonal?right:0,bottom+.01);
            gradient.addColorStop(0,item.fill.top);
            if(item.fill.middle)gradient.addColorStop(.42,item.fill.middle);
            gradient.addColorStop(1,item.fill.bottom);
          }
          ctx.fillStyle=gradient;
        }else ctx.fillStyle=item.fill;
        ctx.fill();if(item.edge){ctx.strokeStyle=item.edge;ctx.lineWidth=1.2*scale;ctx.lineJoin='round';ctx.stroke();}
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
      if(boxes.length)text(`${boxes.length}/${MoveInArcade.capacity} · ×${MoveInArcade.multiplier(s)}`,load[0],load[1]-14*scale,mobile?24:20,'#2b5846');
      if(boxes.length===MoveInArcade.capacity)text('КУЗОВ ПОЛОН',load[0],load[1]-36*scale,mobile?22:16,'#ad7030');
      if(s.elapsed<s.stunnedUntil){const hit=project(x+1.3,2.55,z);text('!',hit[0],hit[1],32,'#ad4c37');}
      if(s.lastBatch&&s.elapsed-s.lastBatch.at<1.2)text('+'+s.lastBatch.amount+' материалов · ×'+s.lastBatch.factor,W*.5,H*.34-(s.elapsed-s.lastBatch.at)*12*scale,mobile?23:21,'#356b51');
    }
    return {draw,targetAt,destroy(){alive=false;resize.disconnect();}};
  }
  return {mount,createView};
})();
