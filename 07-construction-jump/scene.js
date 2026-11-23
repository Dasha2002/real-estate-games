'use strict';

const ConstructionScene=(()=>{
  const W=ConstructionJump.width,H=ConstructionJump.height;
  function rounded(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
  function line(ctx,x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function worldY(state,y){return H-(y-state.camera);}

  function background(ctx,state){
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#24415a');sky.addColorStop(1,'#36536a');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffffff09';ctx.beginPath();ctx.arc(327,100,40,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffffff16';for(let i=0;i<7;i++){
      const y=((i*127+state.camera*.08)%800)-80;
      rounded(ctx,((i*83)%440)-30,y,115,11,7,'#ffffff18');
      rounded(ctx,((i*83)%440)-5,y-8,58,16,8,'#ffffff18');
    }
    const skyline=H-35+state.camera*.13;
    ctx.fillStyle='#193a58';
    for(let i=0;i<11;i++){
      const x=i*43-7,h=55+(i*37)%92;
      ctx.fillRect(x,skyline-h,39,h+40);
      ctx.fillStyle='#d8d6b632';
      for(let row=0;row<4;row++)for(let col=0;col<2;col++)ctx.fillRect(x+8+col*13,skyline-h+13+row*19,5,8);
      ctx.fillStyle='#193a58';
    }
  }

  function tower(ctx,state){
    const built=ConstructionJump.floors(state);
    const first=Math.max(0,Math.floor((state.camera-ConstructionJump.base)/ConstructionJump.floorHeight)-1);
    const last=Math.ceil((state.camera+H-ConstructionJump.base)/ConstructionJump.floorHeight)+1;
    for(let floor=first;floor<=last;floor++){
      const top=worldY(state,ConstructionJump.base+(floor+1)*ConstructionJump.floorHeight);
      const bottom=worldY(state,ConstructionJump.base+floor*ConstructionJump.floorHeight);
      if(bottom<-40||top>H+40)continue;
      const done=floor<built;
      ctx.fillStyle=done?'#d6d5c5':'#c5d2d22a';ctx.fillRect(89,top+5,222,bottom-top-7);
      ctx.fillStyle=done?'#b8b9ae':'#9cb2bc76';ctx.fillRect(82,top,236,10);
      ctx.fillStyle=done?'#778793':'#7190a88c';ctx.fillRect(86,top,8,bottom-top);
      ctx.fillRect(306,top,8,bottom-top);
      for(let col=0;col<3;col++){
        const wx=106+col*68;
        rounded(ctx,wx,top+34,46,68,4,done?'#305b73':'#2847637a');
        if(done){ctx.fillStyle='#e9c792';ctx.fillRect(wx+5,top+38,36,13);}
        line(ctx,wx+23,top+34,wx+23,top+102,done?'#b0bcb9':'#7d9aa8',3);
      }
      if(done){ctx.fillStyle='#83a08d';ctx.fillRect(92,bottom-17,216,9);}
    }
    const nextMilestone=Math.max(10,(Math.floor((state.camera+H-ConstructionJump.base)/(ConstructionJump.floorHeight*10))+1)*10);
    const crane=worldY(state,ConstructionJump.base+nextMilestone*ConstructionJump.floorHeight+100);
    if(crane>-150&&crane<H+100){
      line(ctx,290,crane,290,crane+170,'#e3ad5a',9);
      line(ctx,112,crane+5,365,crane+5,'#e3ad5a',8);
      line(ctx,154,crane+5,290,crane-56,'#e3ad5a',3);
      line(ctx,290,crane-56,351,crane+5,'#e3ad5a',3);
      line(ctx,137,crane+5,137,crane+77,'#cfdfde',2);
      ctx.fillStyle='#efbc6c';ctx.fillRect(132,crane+75,10,12);
    }
    const current=Math.floor((state.maxHeight-ConstructionJump.base)/ConstructionJump.floorHeight)+1;
    const labelY=worldY(state,ConstructionJump.base+(current-1)*ConstructionJump.floorHeight+90);
    if(labelY>24&&labelY<H-20){ctx.fillStyle='#e9f3eea6';ctx.font='700 11px Segoe UI, sans-serif';ctx.textAlign='left';ctx.fillText(`${current} ЭТАЖ`,13,labelY);}
  }

  function platform(ctx,state,item){
    if(item.broken)return;
    const y=worldY(state,item.y),x=item.x-item.w/2;
    if(y<-20||y>H+25)return;
    if(item.type==='moving'){
      rounded(ctx,x,y-4,item.w,13,4,'#56bbcc');
      ctx.fillStyle='#2e687b';ctx.fillRect(x+10,y+9,8,7);ctx.fillRect(x+item.w-18,y+9,8,7);
      line(ctx,x+20,y+2,x+item.w-20,y+2,'#d6f4e9',2);
    }else if(item.type==='fragile'){
      rounded(ctx,x,y-5,item.w,14,3,'#d5a46e');
      line(ctx,x+item.w*.5,y-4,x+item.w*.57,y+7,'#765141',2);
      line(ctx,x+item.w*.57,y+7,x+item.w*.49,y+8,'#765141',2);
    }else{
      rounded(ctx,x,y-5,item.w,14,3,item.type==='spring'?'#f7c973':'#dba876');
      ctx.fillStyle='#7d6155';ctx.fillRect(x+9,y+9,7,9);ctx.fillRect(x+item.w-16,y+9,7,9);
      line(ctx,x+8,y+2,x+item.w-8,y+2,'#f4d7ab',2);
      if(item.type==='spring'){
        const stretch=item.bounceAt && state.time-item.bounceAt<.35?8*Math.sin((state.time-item.bounceAt)/.35*Math.PI):0;
        rounded(ctx,item.x-17,y-30-stretch,34,7,3,'#fff1b5');
        ctx.strokeStyle='#fce6a4';ctx.lineWidth=3;
        for(let coil=0;coil<4;coil++){
          ctx.beginPath();ctx.ellipse(item.x,y-9-coil*(5+stretch/4),11,3,0,0,Math.PI*2);ctx.stroke();
        }
        rounded(ctx,item.x-17,y-7,34,5,2,'#aa6b3b');
      }
    }
    if(item.wrap){
      ctx.fillStyle='#c7f4ee';ctx.font='bold 18px Segoe UI';ctx.textAlign='center';
      ctx.fillText(item.x<200?'←':'→',item.x,y-18);
    }
    if(item.type==='base'){
      ctx.fillStyle='#607d7e';ctx.fillRect(x+8,y+18,5,17);ctx.fillRect(x+item.w-13,y+18,5,17);
    }
  }

  function powerup(ctx,state,item){
    if(item.collected)return;
    const y=worldY(state,item.y);if(y<-70||y>H+70)return;
    ctx.save();ctx.translate(item.x,y);
    ctx.fillStyle='#b9f3d932';ctx.beginPath();ctx.arc(0,0,28+Math.sin(state.time*4)*3,0,Math.PI*2);ctx.fill();
    if(item.kind==='propeller'){
      rounded(ctx,-14,-4,28,13,7,'#f7c45c');line(ctx,0,-8,0,-18,'#e4ece2',3);
      ctx.save();ctx.translate(0,-18);ctx.scale(Math.cos(state.time*15),1);
      rounded(ctx,-23,-3,46,6,3,'#c7f4ef');ctx.restore();
    }else if(item.kind==='jetpack'){
      rounded(ctx,-15,-17,12,32,5,'#8fdae3');rounded(ctx,3,-17,12,32,5,'#8fdae3');
      rounded(ctx,-6,-9,12,17,3,'#d9e7e6');
      ctx.fillStyle='#ffb855';ctx.beginPath();ctx.moveTo(-13,16);ctx.lineTo(-9,26);ctx.lineTo(-5,16);ctx.fill();
      ctx.beginPath();ctx.moveTo(5,16);ctx.lineTo(9,26);ctx.lineTo(13,16);ctx.fill();
    }else{
      line(ctx,0,-80,0,-15,'#d7e6dd',3);
      rounded(ctx,-10,-18,20,17,4,'#f3c460');
      ctx.strokeStyle='#f3c460';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,6,10,-Math.PI/2,Math.PI*.9);ctx.stroke();
    }
    ctx.restore();
  }

  function obstacle(ctx,state,item){
    const y=worldY(state,item.y);if(y<-65 || y>H+65)return;
    ctx.save();ctx.translate(item.x,y);ctx.rotate(Math.sin(state.time*3+item.phase)*.07);
    // A suspended pallet of bricks, with slings and hazard markings.
    line(ctx,0,-80,0,-42,'#bdced0',2);
    line(ctx,0,-42,-24,13,'#e6c26b',3);line(ctx,0,-42,24,13,'#e6c26b',3);
    ctx.shadowColor='#e45e4b';ctx.shadowBlur=10;
    rounded(ctx,-27,-18,54,30,2,'#a95440');ctx.shadowBlur=0;
    for(let row=0;row<3;row++){
      line(ctx,-26,-8+row*10,26,-8+row*10,'#e2a076',2);
      for(let col=0;col<3;col++){
        const x=-17+col*20+(row%2?9:0);
        if(x<26)line(ctx,x,-17+row*10,x,-8+row*10,'#e2a076',2);
      }
    }
    rounded(ctx,-29,12,58,7,2,'#f2bc59');
    for(let i=0;i<6;i++)line(ctx,-26+i*10,13,-22+i*10,18,'#3c3640',4);
    ctx.fillStyle='#ffdb76';ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(-12,7);ctx.lineTo(12,7);ctx.closePath();ctx.fill();
    line(ctx,0,-7,0,0,'#543b38',3);rounded(ctx,-1,3,2,2,1,'#543b38');
    ctx.restore();
  }

  function combatEffects(ctx,state){
    for(const shot of state.shots){
      if(shot.done)continue;
      const y=worldY(state,shot.y);
      rounded(ctx,shot.x-3,y-8,6,16,3,'#fff5b0');
      line(ctx,shot.x,y+9,shot.x,y+19,'#fac36b88',3);
    }
    for(const effect of state.effects){
      const age=(state.time-effect.at)/.45;
      ctx.save();ctx.globalAlpha=Math.max(0,1-age);
      for(let i=0;i<7;i++){
        const angle=i*Math.PI*2/7;
        rounded(ctx,effect.x+Math.cos(angle)*age*48-3,worldY(state,effect.y)+Math.sin(angle)*age*40-3,6,6,2,i%2?'#f8d075':'#e56a52');
      }
      ctx.restore();
    }
  }

  function gusts(ctx,state){
    const wind=ConstructionJump.wind(state);if(!wind)return;
    const sign=Math.sign(wind);
    ctx.strokeStyle='#e6f7efad';ctx.lineWidth=2.5;ctx.lineCap='round';
    for(let i=0;i<13;i++){
      const x=((i*79+state.time*wind*3.4)%600+600)%600-100,y=40+i*48;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+sign*40,y-12,x+sign*90,y-4);ctx.stroke();
      line(ctx,x+sign*90,y-4,x+sign*80,y-11,'#e6f7efad',2.5);
    }
    rounded(ctx,111,16,178,30,12,'#183448df');
    ctx.fillStyle='#e6f7ef';ctx.font='bold 14px Segoe UI';ctx.textAlign='center';
    ctx.fillText(sign>0?'ВЕТЕР  → → →':'← ← ←  ВЕТЕР',200,36);
  }

  function material(ctx,state,item){
    if(item.collected)return;
    const y=worldY(state,item.y)+Math.sin(state.time*5+item.id)*3;
    if(y<-25||y>H+25)return;
    ctx.save();ctx.translate(item.x,y);ctx.rotate(-.13);
    rounded(ctx,-12,-9,24,19,3,'#efba70');
    ctx.fillStyle='#9c674b';ctx.fillRect(-8,-6,6,5);ctx.fillRect(3,-6,6,5);
    line(ctx,-11,2,11,2,'#b77750',2);
    ctx.restore();
  }

  function worker(ctx,state){
    const p=state.player,y=worldY(state,p.y);
    ctx.save();ctx.translate(p.x,y);
    if(state.boost){
      ctx.strokeStyle='#b8fff0';ctx.lineWidth=2.5;
      ctx.fillStyle='#b8fff017';ctx.beginPath();ctx.ellipse(0,-30,31,48,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      const kind=state.boost.kind;
      if(kind==='jetpack'){
        rounded(ctx,-22,-34,12,27,4,'#8fdae3');
        ctx.fillStyle='#ffb855';ctx.beginPath();ctx.moveTo(-22,-7);ctx.lineTo(-16,22+Math.sin(state.time*35)*7);ctx.lineTo(-10,-7);ctx.fill();
      }else if(kind==='crane'){
        line(ctx,0,-180,0,-70,'#e7d4a1',3);
        line(ctx,-19,-29,0,-70,'#f1c25d',3);line(ctx,19,-29,0,-70,'#f1c25d',3);
      }
      ctx.strokeStyle='#b9f3d970';ctx.lineWidth=3;
      for(let i=0;i<3;i++)line(ctx,-24-i*7,10+i*15,-24-i*7,26+i*15,'#b9f3d970',2);
    }
    ctx.fillStyle='#17354d88';ctx.beginPath();ctx.ellipse(0,2,18,5,0,0,Math.PI*2);ctx.fill();
    const swing=state.phase==='running'?Math.sin(state.time*13)*4:0;
    line(ctx,-6,-12,-10+swing,-1,'#243b56',5);
    line(ctx,6,-12,10-swing,-1,'#243b56',5);
    rounded(ctx,-12,-36,24,25,5,'#e67746');
    ctx.fillStyle='#fff1cc';ctx.fillRect(-3,-35,6,22);
    line(ctx,-11,-30,-18,-18+swing,'#edbc92',5);
    line(ctx,11,-30,18,-18-swing,'#edbc92',5);
    ctx.fillStyle='#f2c49a';ctx.beginPath();ctx.arc(0,-43,10,0,Math.PI*2);ctx.fill();
    rounded(ctx,-13,-56,26,8,3,'#f3bc57');
    rounded(ctx,-10,-63,20,11,7,'#f3bc57');
    if(state.time<state.shootAt-.12){
      rounded(ctx,11,-56,8,20,3,'#91ced6');
      ctx.fillStyle='#fff4b8';ctx.beginPath();ctx.arc(15,-61,6,0,Math.PI*2);ctx.fill();
    }
    if(state.boost?.kind==='propeller'){
      line(ctx,0,-63,0,-72,'#e6f2df',3);
      ctx.save();ctx.translate(0,-72);ctx.scale(Math.cos(state.time*24),1);rounded(ctx,-28,-3,56,6,3,'#bce9e8');ctx.restore();
    }
    ctx.fillStyle='#273b50';ctx.beginPath();ctx.arc(4,-43,1.5,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  function draw(canvas,state){
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    background(ctx,state);ctx.save();ctx.globalAlpha=.16;tower(ctx,state);ctx.restore();gusts(ctx,state);
    for(const item of state.platforms)platform(ctx,state,item);
    for(const item of state.materials)material(ctx,state,item);
    for(const item of state.powerups)powerup(ctx,state,item);
    for(const item of state.obstacles)if(!item.destroyed)obstacle(ctx,state,item);
    combatEffects(ctx,state);
    worker(ctx,state);
    const shade=ctx.createLinearGradient(0,0,0,H);
    shade.addColorStop(0,'#0c213856');shade.addColorStop(.2,'#0c213800');shade.addColorStop(.78,'#0c213800');shade.addColorStop(1,'#0c213859');
    ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  }
  return {draw};
})();
