'use strict';

const ConstructionScene=(()=>{
  const W=ConstructionJump.width,H=ConstructionJump.height;
  const C={cream:'#e9f2ed',wine:'#23445a',red:'#c57641',ink:'#172d40',line:'#749298',muted:'#8fa9ad',pale:'#b8cccb',white:'#f1f5ec'};
  const font=(size=12,weight=700,italic=false)=>`${weight} ${size}px Segoe UI, sans-serif`;
  const sprite=(ctx,key,x,y,w,h,frame=0)=>typeof JumpArt!=='undefined' && JumpArt.draw(ctx,key,x,y,w,h,frame);
  const sy=(s,y)=>H-y+s.camera;
  function box(ctx,x,y,w,h,fill,stroke=C.wine,r=3){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.4;ctx.stroke();}}
  function line(ctx,x,y,xx,yy,color=C.line,width=1.2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function ellipse(ctx,x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}

  function background(ctx,s){
    ctx.fillStyle='#416477';ctx.fillRect(0,0,W,H);
    const drift=Math.min(40,s.camera*.008);
    sprite(ctx,'background',-12,-40+drift,W+24,H+80);
    ctx.fillStyle='#193e5352';ctx.fillRect(0,0,W,H);
    for(let i=0;i<4;i++){
      const x=((i*149+s.time*3)%600)-110,y=((i*183+s.camera*.035)%850)-90;
      const mist=ctx.createRadialGradient(x,y,0,x,y,80);mist.addColorStop(0,'#d8eced18');mist.addColorStop(1,'#d8eced00');ctx.fillStyle=mist;ctx.fillRect(x-80,y-80,160,160);
    }
  }

  function tower(ctx,s){
    const first=Math.max(0,Math.floor((s.camera-ConstructionJump.base)/180)-1);
    const last=Math.ceil((s.camera+H-ConstructionJump.base)/180);
    ctx.save();ctx.globalAlpha=.17;
    for(let floor=first;floor<=last;floor++){
      const top=sy(s,ConstructionJump.base+(floor+1)*180);
      const concrete=ctx.createLinearGradient(132,0,268,0);concrete.addColorStop(0,'#8da9ad');concrete.addColorStop(.15,'#e0dfd0');concrete.addColorStop(1,'#a2baba');box(ctx,132,top,136,174,concrete,C.line,2);
      for(let row=0;row<4;row++)for(let col=0;col<4;col++)box(ctx,143+col*30,top+15+row*40,17,20,floor<ConstructionJump.floors(s)&&col===floor%4?'#ffc36a':C.muted,null,2);
    }
    ctx.restore();
  }

  function platform(ctx,s,p){
    if(p.broken)return;const y=sy(s,p.y),x=p.x-p.w/2;
    if(y<-45||y>H+40)return;
    const key=p.type==='moving'?'metal':p.type==='fragile'?'fragile':'wood';
    const shape=JumpArt.definitions[key].frames[0];
    if(!sprite(ctx,key,x,y-2,p.w,p.w*shape[3]/shape[2]))box(ctx,x,y,p.w,17,C.pale,C.wine,2);
    if(p.type==='fragile'){
      line(ctx,p.x-4,y,p.x+3,y+6,C.wine,1.8);line(ctx,p.x+3,y+6,p.x-2,y+10,C.wine,1.8);line(ctx,p.x-2,y+10,p.x+4,y+17,C.wine,1.8);
    }
    if(p.type==='spring'){
      const age=s.time-(p.bounceAt??-1),stretch=age>=0&&age<.3?Math.sin(age/.3*Math.PI)*8:0;
      sprite(ctx,'spring',p.x-17,y-28-stretch,34,29+stretch);
    }
    if(p.wrap){ctx.font=font(17);ctx.fillStyle=C.red;ctx.textAlign='center';ctx.fillText(p.x<200?'←':'→',p.x,y-9);}
  }

  function gear(ctx,kind,x,y,scale=1,time=0){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    const sizes={propeller:[34,40],jetpack:[34,39],crane:[19,50]},[w,h]=sizes[kind];
    if(sprite(ctx,kind,-w/2,-h/2,w,h)){
      if(kind==='crane')line(ctx,0,-h/2,0,-60,'#b9c9c5',2);
      if(kind==='propeller'){ctx.save();ctx.translate(0,-14);ctx.scale(Math.cos(time*22),1);box(ctx,-18,-1,36,2,'#dcfff1',null,1);ctx.restore();}
      ctx.restore();return;
    }
    if(kind==='propeller'){
      box(ctx,-13,-3,26,12,C.red,C.wine,8);line(ctx,0,-3,0,-13,C.wine,2);
      ctx.save();ctx.scale(Math.cos(time*22),1);box(ctx,-19,-15,38,4,C.white,C.wine,2);ctx.restore();
    }else if(kind==='jetpack'){
      box(ctx,-12,-17,10,27,C.pale,C.wine,3);box(ctx,2,-17,10,27,C.red,C.wine,3);
      box(ctx,-5,-8,10,15,C.white,C.wine,2);
      for(const side of [-1,1]){ctx.fillStyle=C.red;ctx.beginPath();ctx.moveTo(side*7-4,11);ctx.lineTo(side*7,21+Math.sin(time*25)*3);ctx.lineTo(side*7+4,11);ctx.fill();}
    }else{
      line(ctx,0,-60,0,-18,C.line,1.5);box(ctx,-9,-20,18,19,C.pale,C.wine,2);
      ctx.beginPath();ctx.arc(0,7,9,-Math.PI/2,Math.PI*.85);ctx.strokeStyle=C.wine;ctx.lineWidth=3;ctx.stroke();
    }
    ctx.restore();
  }
  function powerup(ctx,s,p){if(p.collected)return;const y=sy(s,p.y);if(y<-80||y>H+80)return;ellipse(ctx,p.x,y,23,23,'#b9f3d932');gear(ctx,p.kind,p.x,y+Math.sin(s.time*4+p.id)*3,1,s.time);}
  function obstacle(ctx,s,p){
    if(p.destroyed||p.pending)return;const y=sy(s,p.y);if(y<-85||y>H+50)return;
    ctx.save();ctx.translate(p.x,y);ctx.rotate(Math.sin(s.time*3+p.phase)*.07);
    line(ctx,0,-85,0,-36,C.wine);line(ctx,0,-36,-25,10,C.wine);line(ctx,0,-36,25,10,C.wine);
    if(sprite(ctx,'cargo',-28,-19,56,38)){ctx.restore();return;}
    box(ctx,-28,-19,56,38,C.wine,C.ink,3);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++)box(ctx,-23+col*16,-14+row*9,12,6,'#71332b',null,1);
    line(ctx,-25,15,25,15,C.red,3);
    ctx.fillStyle=C.cream;ctx.font=font(20,900);ctx.textAlign='center';ctx.fillText('!',0,9);ctx.restore();
  }
  function material(ctx,s,p){if(p.collected)return;const y=sy(s,p.y)+Math.sin(s.time*5+p.id)*2;if(y<-20||y>H+20)return;if(sprite(ctx,'brick',p.x-12,y-6,24,12))return;box(ctx,p.x-10,y-6,20,12,C.pale,C.wine,2);box(ctx,p.x-6,y-3,4,5,C.muted,null,1);box(ctx,p.x+2,y-3,4,5,C.muted,null,1);}
  function gusts(ctx,s){
    const wind=ConstructionJump.wind(s);if(!wind)return;const sign=Math.sign(wind);
    for(let i=0;i<10;i++){const x=((i*79+s.time*wind*3)%570+570)%570-80,y=70+i*54;line(ctx,x,y,x+sign*65,y-4,'#e6f7efad',2);line(ctx,x+sign*65,y-4,x+sign*56,y-9,'#a7584a80',2);}
    ctx.font=font(10,800,true);ctx.fillStyle=C.wine;ctx.textAlign='center';ctx.fillText(wind>0?'ВЕТЕР →':'← ВЕТЕР',W/2,25);
  }
  function combat(ctx,s){
    for(const shot of s.shots)if(!shot.done){const y=sy(s,shot.y);ellipse(ctx,shot.x,y,4,7,C.red);ellipse(ctx,shot.x,y+4,2,3,'#ffbd80');}
    for(const e of s.effects){const age=(s.time-e.at)/.45;ctx.save();ctx.globalAlpha=Math.max(0,1-age);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;box(ctx,e.x+Math.cos(a)*age*42,sy(s,e.y)+Math.sin(a)*age*35,4,4,i%2?C.red:C.wine,null,1);}ctx.restore();}
  }
  function worker(ctx,s){
    const y=sy(s,s.player.y),firing=s.time<s.shootAt-.12;
    const pose=firing?3:s.phase==='ready'||s.phase==='failed'?0:s.player.vy>0?1:2;
    ctx.save();ctx.translate(s.player.x,y);
    ctx.scale(s.player.facing===-1?-1:1,1);
    if(s.boost){ctx.strokeStyle=C.red;ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.beginPath();ctx.ellipse(0,-30,29,43,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);if(s.boost.kind==='jetpack')gear(ctx,'jetpack',-20,-27,.7,s.time);if(s.boost.kind==='crane')gear(ctx,'crane',0,-65,.8,s.time);}
    if(typeof JumpArt!=='undefined'&&JumpArt.has('worker')){
      const b=JumpArt.definitions.worker.frames[pose],scale=62/JumpArt.definitions.worker.frames[0][3];
      JumpArt.draw(ctx,'worker',-b[2]*scale/2,-b[3]*scale,b[2]*scale,b[3]*scale,pose);
    }else {ellipse(ctx,0,-42,17,16,C.red);box(ctx,-9,-25,18,24,C.red,C.wine,6);ellipse(ctx,0,-14,6,9,C.white);}
    if(s.boost?.kind==='propeller')gear(ctx,'propeller',0,-64,.8,s.time);
    ctx.restore();
  }
  function draw(canvas,state){
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,W,H);background(ctx,state);tower(ctx,state);gusts(ctx,state);
    for(const p of state.platforms)platform(ctx,state,p);
    for(const p of state.materials)material(ctx,state,p);
    for(const p of state.powerups)powerup(ctx,state,p);
    for(const p of state.obstacles)obstacle(ctx,state,p);
    combat(ctx,state);worker(ctx,state);
  }
  return {draw};
})();
