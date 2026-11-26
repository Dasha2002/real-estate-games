'use strict';

// Locally authored furniture meshes, in metres. Shared by both apartment views.
// Geometry is cached; moving/rotating a piece never rebuilds its model.
const ApartmentFurniture=(()=>{
  const cache=new Map();
  function model(key,item,palette){
    const id=key+JSON.stringify(palette);
    if(cache.has(id))return cache.get(id);
    const faces=[],[w,d]=item.size,h=item.height;
    const cloth=palette.fabric[0],pillow=palette.accent[0];
    const oak='#b99a73',edge='#947554',dark='#313639',cream='#ece9df',metal='#716b5f';
    const poly=(points,color,material=null)=>{
      const [a,b,c]=points,u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n)||1;
      const normal=n.map(q=>q/length),top=Math.abs(normal[1])>.8,factor=material==='linen'?4:1.6;
      faces.push({points,color,material,triangles:points.slice(1,-1).map((_,i)=>[0,i+1,i+2]),normals:points.map(()=>normal),uv:points.map(([x,y,z])=>top?[x*factor,z*factor]:[Math.abs(normal[0])>Math.abs(normal[2])?z*factor:x*factor,y*factor])});
    };
    function smooth(start){
      const sums=new Map(),id=p=>p.map(q=>q.toFixed(7)).join(',');
      for(const f of faces.slice(start))for(const p of f.points){
        const key=id(p),n=sums.get(key)||[0,0,0];f.normals[0].forEach((q,i)=>n[i]+=q);sums.set(key,n);
      }
      for(const f of faces.slice(start))f.normals=f.points.map(p=>{const n=sums.get(id(p)),l=Math.hypot(...n)||1;return n.map(q=>q/l);});
    }
    function ring(x,z,w,d,r,steps=6){
      r=Math.max(.001,Math.min(r,w/2-.001,d/2-.001));
      const points=[];
      for(let c=0;c<4;c++){
        const a=-Math.PI+c*Math.PI/2,cx=x+(c===0||c===3?-1:1)*(w/2-r),cz=z+(c<2?-1:1)*(d/2-r);
        for(let j=0;j<=steps;j++){
          const angle=a+j*Math.PI/(2*steps);
          points.push([cx+Math.cos(angle)*r,cz+Math.sin(angle)*r]);
        }
      }
      return points;
    }
    function rounded(x,y,z,w,h,d,r,color,material=null){
      const start=faces.length,b=Math.min(r,h*.35,w*.2,d*.2),profile=[],steps=r<.015||Math.min(w,h,d)<.025?1:3,corners=r<.015?2:6;
      for(let j=0;j<=steps;j++){const t=j*Math.PI/(2*steps);profile.push({at:y+b*(1-Math.cos(t)),inset:b*(1-Math.sin(t))});}
      for(let j=0;j<=steps;j++){const t=j*Math.PI/(2*steps);profile.push({at:y+h-b+b*Math.sin(t),inset:b*(1-Math.cos(t))});}
      const rings=profile.map(({at,inset})=>ring(x,z,w-inset*2,d-inset*2,Math.max(.001,r-inset),corners).map(([px,pz])=>[px,at,pz]));
      for(let k=0;k<rings.length-1;k++)for(let j=0;j<rings[k].length;j++){
        const next=(j+1)%rings[k].length;
        poly([rings[k][j],rings[k+1][j],rings[k+1][next],rings[k][next]],color,material);
      }
      poly([...rings[rings.length-1]].reverse(),color,material);
      poly(rings[0],color,material);
      smooth(start);
    }
    function cylinder(x,y,z,r,height,color,topRadius=r){
      const bottom=[],top=[];
      for(let i=0;i<32;i++){
        const a=i*Math.PI/16;
        bottom.push([x+Math.cos(a)*r,y,z+Math.sin(a)*r]);
        top.push([x+Math.cos(a)*topRadius,y+height,z+Math.sin(a)*topRadius]);
      }
      for(let i=0;i<32;i++){
        const n=(i+1)%32;poly([bottom[i],top[i],top[n],bottom[n]],color);
        faces[faces.length-1].normals=[bottom[i],top[i],top[n],bottom[n]].map(p=>{
          const nx=p[0]-x,nz=p[2]-z,l=Math.hypot(nx,nz)||1;return [nx/l,(r-topRadius)/height,nz/l];
        });
      }
      poly(top.reverse(),color);
    }
    function vessel(x,z,levels,color,rectangular=false,closed=true){
      const start=faces.length;
      const loops=levels.map(l=>(rectangular?ring(x,z,l.w,l.d,Math.min(l.w,l.d)*.32,8):Array.from({length:48},(_,i)=>{const a=i*Math.PI/24;return [x+Math.cos(a)*l.w/2,z+Math.sin(a)*l.d/2];})).map(([px,pz])=>[px,l.y,pz]));
      for(let k=0;k<loops.length-1;k++)for(let i=0;i<loops[k].length;i++){
        const j=(i+1)%loops[k].length;
        poly([loops[k][i],loops[k+1][i],loops[k+1][j],loops[k][j]],color);
      }
      if(closed)poly([...loops[loops.length-1]].reverse(),color);smooth(start);
    }
    function pipe(points,r,color){
      const start=faces.length,loops=points.map((p,i)=>{
        const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],v=b.map((q,j)=>q-a[j]),l=Math.hypot(...v)||1,n=v.map(q=>q/l);
        let u=Math.abs(n[1])>.9?[1,0,0]:[n[2],0,-n[0]];const ul=Math.hypot(...u);u=u.map(q=>q/ul);
        const t=[u[1]*n[2]-u[2]*n[1],u[2]*n[0]-u[0]*n[2],u[0]*n[1]-u[1]*n[0]];
        return Array.from({length:16},(_,j)=>{const a=j*Math.PI/8;return p.map((q,k)=>q+r*(u[k]*Math.cos(a)+t[k]*Math.sin(a)));});
      });
      for(let k=0;k<loops.length-1;k++)for(let i=0;i<16;i++){const j=(i+1)%16;poly([loops[k][i],loops[k+1][i],loops[k+1][j],loops[k][j]],color);}
      poly([...loops[loops.length-1]].reverse(),color);smooth(start);
    }
    const leg=(x,z,height=.16)=>cylinder(x,.015,z,.023,height,edge,.035);
    const seam=(x,y,z,w,d,color)=>rounded(x,y,z,w,.009,d,.025,color,'linen');
    if(item.type==='curtain'){
      pipe([[-w/2,2.54,-d*.28],[w/2,2.54,-d*.28]],.017,'#a8987e');
      for(const x of [-w*.43,w*.43])pipe([[x,2.49,-d/2],[x,2.54,-d/2],[x,2.54,-d*.28]],.012,'#a8987e');
      function panel(left,right,color,folds){
        const segments=Math.max(24,folds*10),top=2.48,bottom=.10;
        for(let i=0;i<segments;i++){
          const x1=left+(right-left)*i/segments,x2=left+(right-left)*(i+1)/segments;
          const z=x=>Math.sin((x-left)/(right-left)*folds*Math.PI*2)*d*.32;
          poly([[x1,bottom,z(x1)],[x1,top,z(x1)],[x2,top,z(x2)],[x2,bottom,z(x2)]],color,'tulle');
        }
      }
      panel(-w*.47,w*.47,'#ffffff99',12);
      panel(-w*.49,-w*.29,'#ffffffb0',5);panel(w*.29,w*.49,'#ffffffb0',5);
      for(let i=0;i<18;i++)rounded(-w*.44+i*w*.88/17,2.46,-d*.2,.012,.055,.018,.004,'#b2a489');
    }
    if(item.type==='radiator'){
      const count=Math.max(5,Math.round(w/.075)),step=w/count;
      for(let i=0;i<count;i++){
        const start=faces.length,outline=ring(-w/2+(i+.5)*step,0,step*.82,d,.018,3);
        const low=outline.map(([x,z])=>[x,.16,z]),high=outline.map(([x,z])=>[x,.66,z]);
        for(let j=0;j<outline.length;j++){const n=(j+1)%outline.length;poly([low[j],high[j],high[n],low[n]],'#eceee5');}
        poly([...high].reverse(),'#eceee5');poly(low,'#d6dbd1');smooth(start);
      }
      pipe([[-w*.47,.20,0],[w*.47,.20,0]],.018,'#d6dbd1');
      pipe([[-w*.47,.62,0],[w*.47,.62,0]],.018,'#e5e8df');
      pipe([[w*.43,.16,-d*.1],[w*.43,.09,-d*.1],[w*.43,.09,-d*.45]],.012,'#b9c2b8');
      cylinder(w*.43,.65,0,.025,.035,'#cbd1c6');
    }
    if(item.type==='sofa'){
      for(const x of [-w*.40,w*.40])for(const z of [-d*.33,d*.33])leg(x,z);
      rounded(0,.15,0,w-.03,.22,d-.03,.09,cloth,'linen');
      rounded(0,.30,-d*.37,w-.04,.51,d*.22,.08,cloth,'linen');
      const arm=Math.min(.17,w*.17),seats=key==='armchair'?1:key==='loveseat'?2:3,sw=(w-arm*2-.05)/seats;
      for(let i=0;i<seats;i++){
        const x=-(seats-1)*sw/2+i*sw;
        rounded(x,.36,d*.05,sw-.018,.16,d*.65,.065,cloth,'linen');
        seam(x,.493,d*.05,sw-.03,d*.64,'#c8bbaa');
        rounded(x,.50,-d*.25,sw-.025,.29,d*.20,.07,cloth,'linen');
      }
      for(const x of [-w/2+arm/2,w/2-arm/2])rounded(x,.29,0,arm,.34,d*.9,.06,cloth,'linen');
      rounded(w*.24,.52,-d*.12,Math.min(.35,w*.28),.24,.19,.075,pillow,'linen');
      if(seats>1)rounded(-w*.28,.52,-d*.10,.30,.20,.18,.07,cream,'linen');
    }
    if(item.type==='bed'){
      for(const x of [-w*.40,w*.40])for(const z of [-d*.39,d*.39])leg(x,z,.13);
      rounded(0,.12,0,w,.25,d,.055,oak,'wood');
      rounded(0,.36,.015,w-.07,.22,d-.12,.085,cream,'linen');
      rounded(0,.09,-d/2+.065,w,.96,.13,.045,cloth,'linen');
      // Upholstered headboard panels and stitching.
      const count=w>1.3?6:4;
      for(let i=0;i<count;i++)rounded(-w/2+(i+.5)*w/count,.17,-d/2+.137,w/count-.008,.82,.024,.012,cloth,'linen');
      rounded(0,.565,d*.18,w-.055,.085,d*.58,.055,cloth,'linen');
      rounded(0,.648,d*.30,w-.06,.035,d*.16,.023,pillow,'linen');
      for(let i=0;i<7;i++)rounded(-w*.42+i*w*.14,.65,d*.30,.008,.014,d*.15,.003,'#8b9980','linen');
      const pillows=w>1.3?2:1;
      for(let i=0;i<pillows;i++){
        const pw=(w-.17)/pillows,x=(i-(pillows-1)/2)*(pw+.025);
        rounded(x,.575,-d*.31,pw-.035,.14,.39,.065,cream,'linen');
        seam(x,.68,-d*.31,pw-.05,.36,'#dedacf');
      }
    }
    if(item.type==='storage'||item.type==='shelf'){
      const tall=h>1.2,base=.07;
      if(!tall)for(const x of [-w*.40,w*.40])for(const z of [-d*.33,d*.33])leg(x,z,.10);
      if(item.type==='shelf'){
        // Recessed backing, open shelves, individually sized books and ceramics.
        rounded(-w/2+.018,base,0,.036,h-base,d,.006,oak,'wood');
        rounded(w/2-.018,base,0,.036,h-base,d,.006,oak,'wood');
        rounded(0,base,-d/2+.012,w-.07,h-base,.024,.004,'#7e7461','wood');
        rounded(0,h-.03,0,w,.03,d,.006,oak,'wood');
        const n=5;
        for(let i=0;i<n;i++){
          const y=base+.07+i*(h-base-.07)/n;
          rounded(0,y,.015,w-.04,.027,d-.025,.006,oak,'wood');
          if(i%2===0){
            for(let j=0;j<5;j++){
              const bh=.16+(j%3)*.033,bx=-w*.34+j*.066;
              rounded(bx,y+.03,.04,.048,bh,d*.56,.004,['#aeb5a1','#c7ac92','#727d85','#ddd4be','#9d7c70'][j]);
              rounded(bx,y+.06,d*.33,.033,.006,.006,.002,cream);
            }
          }else{
            cylinder(w*.22,y+.03,.04,.055,.15,cream,.035);
            rounded(-w*.20,y+.03,.04,w*.26,.035,d*.5,.004,pillow);
          }
        }
      }else{
        rounded(0,base,0,w,h-base,d,.012,oak,'wood');
        const columns=tall?2:1,rows=tall?1:3;
        for(let c=0;c<columns;c++)for(let r=0;r<rows;r++){
          const fw=(w-.04)/columns-.012,fh=(h-base-.04)/rows-.012,x=(c-(columns-1)/2)*(fw+.012),y=base+.022+r*(fh+.012);
          rounded(x,y,d/2+.003,fw,fh,.022,.006,tall?'#d5ccba':'#c6b498','wood');
          if(tall){
            const handleX=x+(c===0?1:-1)*(fw/2-.045);
            rounded(handleX,h*.46,d/2+.027,.012,.19,.022,.005,metal);
          }else rounded(0,y+fh*.78,d/2+.020,.16,.012,.025,.005,metal);
        }
      }
    }
    if(item.type==='desk'){
      for(const x of [-w*.43,w*.43])for(const z of [-d*.35,d*.35])leg(x,z,.71);
      rounded(0,.71,0,w,.045,d,.022,oak,'wood');
      rounded(-w*.13,.755,-d*.18,.12,.015,.12,.009,metal);
      rounded(-w*.13,.76,-d*.21,.027,.12,.028,.006,metal);
      rounded(-w*.13,.87,-d*.24,.49,.23,.032,.012,dark);
      rounded(-w*.13,.885,-d*.22,.458,.197,.007,.004,'#526978');
      rounded(-w*.13,.895,-d*.215,.36,.013,.003,.002,'#b5c6cc');
      rounded(-w*.13,.755,d*.17,.34,.015,.115,.008,'#c7c5bc');
      for(let i=0;i<10;i++)for(let j=0;j<3;j++)rounded(-w*.13-.145+i*.032,.769,d*.17-.035+j*.028,.023,.002,.018,.002,'#e8e6de');
      rounded(w*.26,.755,d*.17,.055,.025,.085,.025,cream);
      cylinder(w*.35,.755,-d*.16,.039,.075,cream);
    }
    if(item.type==='table'){
      const td=d*.60,tw=w*.96;
      for(const x of [-tw*.38,tw*.38])for(const z of [-td*.35,td*.35])leg(x,z,.725);
      rounded(0,.725,0,tw,.045,td,.09,oak,'wood');
      for(const sign of [-1,1]){
        const z=sign*d*.36;
        for(const x of [-.16,.16])for(const dz of [-.11,.11])leg(x,z+dz,.43);
        rounded(0,.43,z,.42,.065,d*.24,.06,pillow,'linen');
        rounded(0,.48,z+sign*d*.09,.42,.33,.045,.04,oak,'wood');
      }
      cylinder(0,.772,0,.12,.017,cream);
      cylinder(0,.79,0,.042,.12,'#9aa28a',.024);
    }
    if(item.type==='coffee'){
      for(const x of [-w*.36,w*.36])for(const z of [-d*.30,d*.30])leg(x,z,.36);
      rounded(0,.19,0,w*.85,.025,d*.80,.035,edge,'wood');
      rounded(0,.375,0,w,.045,d,.08,oak,'wood');
      rounded(-w*.17,.421,0,w*.31,.025,d*.49,.004,'#e6e0d4');
      rounded(-w*.17,.447,0,w*.29,.019,d*.47,.004,pillow);
      cylinder(w*.24,.421,0,.065,.009,cream);
      cylinder(w*.24,.43,0,.03,.055,cream);
    }
    if(item.type==='tv'){
      for(const x of [-w*.43,w*.43])for(const z of [-d*.32,d*.32])leg(x,z,.11);
      rounded(0,.12,0,w,.035,d,.012,oak,'wood');
      for(const side of [-1,1]){
        rounded(side*(w/2-.018),.12,0,.036,.40,d,.008,oak,'wood');
        rounded(side*w*.185,.12,0,.028,.40,d,.006,oak,'wood');
      }
      rounded(0,.12,-d/2+.01,w,.40,.018,.004,oak,'wood');
      rounded(0,.52,0,w,.035,d,.012,oak,'wood');
      // Closed side compartments and a recessed central media shelf.
      for(const side of [-1,1]){
        rounded(side*w*.345,.14,d/2+.008,w*.29,.35,.022,.008,'#d7d1c4');
        rounded(side*w*.345,.435,d/2+.025,w*.12,.012,.018,.005,metal);
      }
      rounded(0,.16,-d/2+.022,w*.35,.30,.008,.004,'#716657');
      rounded(0,.165,d*.16,w*.34,.018,d*.63,.005,edge,'wood');
      rounded(0,.34,d*.16,w*.34,.018,d*.63,.005,oak,'wood');
      rounded(0,.185,d*.20,w*.25,.035,d*.38,.008,'#454a4a');
      rounded(w*.10,.195,d*.395,.008,.006,.002,.001,'#a4aea2');
      const screenW=Math.min(w*.73,1.28),screenH=screenW*.563;
      for(const side of [-1,1])pipe([[side*screenW*.30,.685,-.07],[side*screenW*.38,.558,.08],[side*screenW*.44,.558,.08]],.012,dark);
      rounded(0,.67,-.07,screenW,screenH,.035,.012,'#202829');
      rounded(0,.686,-.050,screenW-.032,screenH-.034,.004,.004,'#293c49');
      const left=-screenW/2+.027,right=screenW/2-.027,bottom=.695,top=.67+screenH-.023;
      poly([[left,bottom,-.047],[left,top,-.047],[right*.17,top,-.047],[right*.64,bottom,-.047]].reverse(),'#354b59');
      poly([[left*.85,top-.02,-.046],[right*.50,top-.02,-.046],[right*.64,top-.045,-.046],[left*.81,top-.045,-.046]].reverse(),'#4c606b');
      rounded(screenW*.42,.676,-.049,.009,.004,.002,.001,'#8b9c94');
    }
    if(item.type==='rug'){
      const yarn='#c6c1b6',pattern='#b8b3a8';
      rounded(0,.017,0,w,.014,d,.04,yarn);
      function stitch(x1,z1,x2,z2,thickness,color,y=.032){
        const dx=x2-x1,dz=z2-z1,l=Math.hypot(dx,dz)||1,nx=-dz/l*thickness/2,nz=dx/l*thickness/2;
        poly([[x1-nx,y,z1-nz],[x1+nx,y,z1+nz],[x2+nx,y,z2+nz],[x2-nx,y,z2-nz]],color);
      }
      for(const inset of [.07,.095]){
        const x=w/2-inset,z=d/2-inset;
        stitch(-x,-z,x,-z,.006,pattern);stitch(x,-z,x,z,.006,pattern);stitch(x,z,-x,z,.006,pattern);stitch(-x,z,-x,-z,.006,pattern);
      }
      for(const cx of [-w*.29,0,w*.29])for(const scale of [1,.78]){
        const rx=w*.12*scale,rz=d*.29*scale;
        for(const [a,b] of [[[cx-rx,0],[cx,-rz]],[[cx,-rz],[cx+rx,0]],[[cx+rx,0],[cx,rz]],[[cx,rz],[cx-rx,0]]])stitch(...a,...b,.008,pattern);
      }
      // Quiet woven flecks and short, matching fringe, without high-contrast graphics.
      for(let i=0;i<48;i++){
        const x=-w*.43+(i%12)*w*.078,z=-d*.36+Math.floor(i/12)*d*.24;
        stitch(x,z,x+.025,z,.003,'#cfcabf',.033);
      }
      for(const side of [-1,1])for(let i=0;i<24;i++)rounded(-w*.45+i*w*.9/23,.019,side*(d/2+.018),.009,.006,.048,.003,'#c3bdb0');
    }
    if(item.type==='plant'){
      cylinder(0,.025,0,.16,.30,'#c7b7a3',.19);
      cylinder(0,.32,0,.19,.025,'#a1907a');
      cylinder(0,.344,0,.162,.009,'#4f4231');
      cylinder(0,.35,0,.012,.61,'#6f7754',.006);
      for(let i=0;i<14;i++){
        const a=i*2.4,y=.43+i*.038,len=.18+(i%3)*.015,dx=Math.cos(a),dz=Math.sin(a),wide=.055;
        const start=[0,y,0],tip=[dx*len,y+.17,dz*len],mid=[dx*len*.55,y+.16,dz*len*.55];
        const left=[mid[0]-dz*wide,mid[1]-.025,mid[2]+dx*wide],right=[mid[0]+dz*wide,mid[1]-.025,mid[2]-dx*wide];
        poly([start,left,tip,mid],i%2?'#5f7950':'#769360');
        poly([start,mid,tip,right],i%2?'#839966':'#657d4f');
      }
    }
    if(item.type==='toilet'){
      const porcelain='#f0f0e7',chrome='#b8c0bc',bz=d*.10;
      rounded(0,.025,bz,w*.53,.28,d*.47,.09,porcelain);
      vessel(0,bz,[{y:.20,w:w*.52,d:d*.46},{y:.34,w:w*.90,d:d*.69},{y:.425,w:w*.98,d:d*.73},
        {y:.447,w:w*.98,d:d*.73},{y:.447,w:w*.76,d:d*.55},{y:.37,w:w*.61,d:d*.44},{y:.28,w:w*.30,d:d*.23}],porcelain);
      vessel(0,bz,[{y:.446,w:w*.99,d:d*.74},{y:.472,w:w*.99,d:d*.74},{y:.479,w:w*.77,d:d*.56},{y:.448,w:w*.77,d:d*.56}], '#e5e7df',false,false);
      rounded(0,.40,-d*.37,w*.87,.39,d*.25,.045,porcelain);
      rounded(0,.79,-d*.37,w*.90,.025,d*.27,.025,'#faf9f0');
      cylinder(w*.15,.816,-d*.37,.023,.006,chrome);
      cylinder(w*.15,.823,-d*.37,.012,.003,'#d7ded6');
      cylinder(0,.285,bz,.037,.003,'#a9c0bc');
    }
    if(item.type==='vanity'){
      const porcelain='#f2f1e8',chrome='#bac3bf';
      rounded(0,.16,0,w,.55,d,.018,oak,'wood');
      for(let i=0;i<2;i++){
        const y=.18+i*.255;
        rounded(0,y,d/2+.008,w-.025,.24,.022,.008,'#bfaa8c','wood');
        rounded(0,y+.185,d/2+.028,w*.28,.012,.024,.005,chrome);
      }
      rounded(0,.71,0,w+.02,.055,d+.02,.022,porcelain);
      vessel(0,d*.06,[{y:.756,w:w*.68,d:d*.48},{y:.82,w:w*.85,d:d*.65},{y:.875,w:w*.91,d:d*.71},
        {y:.88,w:w*.80,d:d*.59},{y:.84,w:w*.67,d:d*.46},{y:.782,w:w*.32,d:d*.20}],porcelain,true);
      cylinder(0,.786,d*.06,.022,.004,chrome);
      pipe([[0,.765,-d*.34],[0,.93,-d*.34],[0,.975,-d*.27],[0,.975,-d*.05],[0,.947,0]],.013,chrome);
      rounded(.048,.90,-d*.34,.065,.013,.022,.006,chrome);
    }
    if(item.type==='bath'){
      const bw=Math.min(w,d),bd=Math.max(w,d),start=faces.length,porcelain='#f1f1e8',chrome='#b9c2bd';
      vessel(0,0,[{y:.035,w:bw*.78,d:bd*.84},{y:.13,w:bw*.91,d:bd*.93},{y:.49,w:bw,d:bd},
        {y:.59,w:bw,d:bd},{y:.615,w:bw-.105,d:bd-.105},{y:.56,w:bw-.14,d:bd-.14},
        {y:.34,w:bw*.73,d:bd*.83},{y:.16,w:bw*.52,d:bd*.68}],porcelain,true);
      cylinder(0,.164,-bd*.25,.027,.004,chrome);
      pipe([[bw*.30,.615,-bd*.36],[bw*.30,.80,-bd*.36],[bw*.25,.84,-bd*.36],[bw*.09,.84,-bd*.36],[bw*.06,.80,-bd*.36]],.015,chrome);
      cylinder(bw*.30,.618,-bd*.29,.021,.07,chrome);
      if(w>d)for(const f of faces.slice(start)){
        f.points=f.points.map(([x,y,z])=>[z,y,-x]);f.normals=f.normals.map(([x,y,z])=>[z,y,-x]);
      }
    }
    if(item.type==='shower'){
      const porcelain='#e9ede5',chrome='#bcc6c0',glass='#c4e1d43d';
      rounded(0,.025,0,w,.10,d,.04,porcelain);
      rounded(0,.125,0,w-.10,.012,d-.10,.025,'#c5d3cb');
      cylinder(w*.25,.14,d*.25,.03,.003,chrome);
      const top=Math.max(.15,h);
      for(const x of [-w/2+.018,w/2-.018])rounded(x,.14,-d/2+.02,.025,top-.14,.025,.005,chrome);
      rounded(0,.14,-d/2+.02,w,top-.14,.012,.004,glass);
      rounded(w/2-.02,.14,0,.012,top-.14,d,.004,glass);
      if(h>1.6){
        pipe([[-w*.20,.95,-d*.43],[-w*.20,1.80,-d*.43],[-w*.20,1.90,-d*.30]],.012,chrome);
        cylinder(-w*.20,1.87,-d*.28,.075,.015,chrome);
      }
    }
    // Placement, navigation and highlighting all use these same visual extents.
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(const f of faces)for(const [x,,z] of f.points){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
    if(faces.length){
      const sx=w/(maxX-minX),sz=d/(maxZ-minZ),cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
      for(const f of faces){
        f.points=f.points.map(([x,y,z])=>[(x-cx)*sx,y,(z-cz)*sz]);
        f.normals=f.normals.map(([x,y,z])=>{const n=[x/sx,y,z/sz],l=Math.hypot(...n)||1;return n.map(q=>q/l);});
      }
    }
    cache.set(id,faces);
    return faces;
  }
  return {model};
})();
