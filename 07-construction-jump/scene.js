'use strict';

const ConstructionScene=(()=>{
  const W=ConstructionJump.width,H=ConstructionJump.height;
  const C={cream:'#FFE5D9',wine:'#4D0000',red:'#DA0000',ink:'#2B0505',line:'#b17b70',muted:'#cda398',pale:'#f9d6c8',white:'#fff5ee'};
  const font=(size=12,weight=700,italic=false)=>`${italic?'italic ':''}${weight} ${size}px Montserrat, sans-serif`;
  const sy=(s,y)=>H-y+s.camera;
  function box(ctx,x,y,w,h,fill,stroke=C.wine,r=3){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.4;ctx.stroke();}}
  function line(ctx,x,y,xx,yy,color=C.line,width=1.2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function ellipse(ctx,x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}

  function background(ctx,s){
    ctx.fillStyle=C.cream;ctx.fillRect(0,0,W,H);
    ellipse(ctx,310,66,60,60,'#fbd7c7');ellipse(ctx,310,66,43,43,'#f8cebb');
    for(let i=0;i<5;i++){
      const x=((i*149+s.time*4)%550)-70,y=((i*171+s.camera*.04)%790)-60;
      ellipse(ctx,x,y,29,10,'#fff3eabb');ellipse(ctx,x+19,y+6,36,10,'#fff3eabb');
    }
    const baseline=H-10+Math.min(s.camera*.055,82);
    for(let i=0;i<13;i++){
      const x=i*34-15,h=40+(i*53)%92;
      ctx.fillStyle=i%2?'#dbb5a9':'#e5c3b7';ctx.fillRect(x,baseline-h,30,h);
      for(let row=0;row<4;row++){ctx.fillStyle='#cda297';ctx.fillRect(x+5,baseline-h+13+row*19,18,7);}
    }
  }

  function tower(ctx,s){
    const first=Math.max(0,Math.floor((s.camera-ConstructionJump.base)/180)-1);
    const last=Math.ceil((s.camera+H-ConstructionJump.base)/180);
    ctx.save();ctx.globalAlpha=.24;
    for(let floor=first;floor<=last;floor++){
      const top=sy(s,ConstructionJump.base+(floor+1)*180);
      box(ctx,132,top,136,174,C.pale,C.line,2);
      for(let row=0;row<4;row++)for(let col=0;col<4;col++)box(ctx,143+col*30,top+15+row*40,17,20,floor<ConstructionJump.floors(s)&&col===floor%4?'#ffc36a':C.muted,null,2);
    }
    ctx.restore();
  }

  function platform(ctx,s,p){
    if(p.broken)return;const y=sy(s,p.y),x=p.x-p.w/2;
    if(y<-45||y>H+40)return;
    box(ctx,x,y,p.w,17,p.type==='moving'?C.white:C.pale,C.wine,2);
    line(ctx,x+3,y+14,x+p.w-3,y+14,p.type==='moving'?C.red:C.line,2);
    if(p.type==='fragile'){
      line(ctx,p.x-4,y,p.x+3,y+6,C.wine,1.8);line(ctx,p.x+3,y+6,p.x-2,y+10,C.wine,1.8);line(ctx,p.x-2,y+10,p.x+4,y+17,C.wine,1.8);
    }
    if(p.type==='spring'){
      const age=s.time-(p.bounceAt??-1),stretch=age>=0&&age<.3?Math.sin(age/.3*Math.PI)*8:0;
      for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(p.x,y-4-i*(4+stretch/4),9,2.6,0,0,Math.PI*2);ctx.strokeStyle=C.wine;ctx.lineWidth=1.6;ctx.stroke();}
      box(ctx,p.x-14,y-22-stretch,28,5,C.red,C.wine,2);
    }
    if(p.wrap){ctx.font=font(17);ctx.fillStyle=C.red;ctx.textAlign='center';ctx.fillText(p.x<200?'←':'→',p.x,y-9);}
  }

  function gear(ctx,kind,x,y,scale=1,time=0){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
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
  function powerup(ctx,s,p){if(p.collected)return;const y=sy(s,p.y);if(y<-80||y>H+80)return;ellipse(ctx,p.x,y,23,23,'#da00000b');gear(ctx,p.kind,p.x,y+Math.sin(s.time*4+p.id)*3,1,s.time);}
  function obstacle(ctx,s,p){
    if(p.destroyed)return;const y=sy(s,p.y);if(y<-85||y>H+50)return;
    ctx.save();ctx.translate(p.x,y);ctx.rotate(Math.sin(s.time*3+p.phase)*.07);
    line(ctx,0,-85,0,-36,C.wine);line(ctx,0,-36,-25,10,C.wine);line(ctx,0,-36,25,10,C.wine);
    box(ctx,-28,-19,56,38,C.wine,C.ink,3);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++)box(ctx,-23+col*16,-14+row*9,12,6,'#71332b',null,1);
    line(ctx,-25,15,25,15,C.red,3);
    ctx.fillStyle=C.cream;ctx.font=font(20,900);ctx.textAlign='center';ctx.fillText('!',0,9);ctx.restore();
  }
  function material(ctx,s,p){if(p.collected)return;const y=sy(s,p.y)+Math.sin(s.time*5+p.id)*2;if(y<-20||y>H+20)return;box(ctx,p.x-10,y-6,20,12,C.pale,C.wine,2);box(ctx,p.x-6,y-3,4,5,C.muted,null,1);box(ctx,p.x+2,y-3,4,5,C.muted,null,1);}
  function gusts(ctx,s){
    const wind=ConstructionJump.wind(s);if(!wind)return;const sign=Math.sign(wind);
    for(let i=0;i<10;i++){const x=((i*79+s.time*wind*3)%570+570)%570-80,y=70+i*54;line(ctx,x,y,x+sign*65,y-4,'#a7584a80',2);line(ctx,x+sign*65,y-4,x+sign*56,y-9,'#a7584a80',2);}
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
    if(s.boost){ctx.strokeStyle=C.red;ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.beginPath();ctx.ellipse(0,-30,29,43,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);if(s.boost.kind==='jetpack')gear(ctx,'jetpack',-20,-27,.7,s.time);if(s.boost.kind==='crane')gear(ctx,'crane',0,-65,.8,s.time);}
    if(typeof JumpArt!=='undefined'&&JumpArt.has('worker')){
      const b=JumpArt.definitions.worker.frames[pose],scale=62/472;
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
