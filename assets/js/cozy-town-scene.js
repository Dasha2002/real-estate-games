'use strict';
const CozyTownScene=(()=>{
  const A=CozyTownArt;
  function render(c,{T,W,H,view,camera,player,objects,trees,path,state,avatarId,hover,time}){
    const {x:cx,y:cy}=camera,visible=(x,y,w=100,h=200)=>x+w>cx&&x-w<cx+view.w&&y+60>cy&&y-h<cy+view.h;
    c.clearRect(0,0,view.w,view.h);c.save();c.translate(-cx,-cy);c.fillStyle='#e4d4b9';c.fillRect(cx,cy,view.w,view.h);
    c.lineJoin='round';c.lineCap='round';c.lineWidth=3;
    for(let y=Math.floor(cy/T);y<(cy+view.h)/T+1;y++)for(let x=Math.floor(cx/T);x<(cx+view.w)/T+1;x++){c.fillStyle=(x+y)%3?'#f0e5d133':'#c9b79718';c.beginPath();c.roundRect(x*T+1,y*T+1,T-2,T-2,7);c.fill();}
    for(const [x,y,w,h] of TownCore.lawns){A.box(c,x*T,y*T,w*T,h*T,'#c3cea4',40,'#adbd93');A.box(c,x*T+11,y*T+11,w*T-22,h*T-22,'#cbd6ae',34,null);}
    for(const x of [24,48]){A.box(c,x*T-35,3*T,92,48*T,'#edd8b4',13,'#bba98b');for(let y=Math.floor(cy/38)*38;y<cy+view.h;y+=38){A.line(c,x*T-32,y,x*T+54,y,'#cbb89688',1.5);A.line(c,x*T+10,y,x*T+10,y+38,'#cbb89688',1);}}
    for(const y of [25,28]){A.box(c,3*T,y*T,66*T,65,'#edd8b4',15,'#bba98b');for(let x=Math.floor(cx/42)*42;x<cx+view.w;x+=42)A.line(c,x,y*T+3,x,y*T+62,'#cbb89688',1.5);}
    for(const [x,y,w,h] of TownCore.buildings){const px=(x+w*.5)*T,py=(y+h)*T;A.box(c,px-37,py-2,74,85,'#e9d2ac',8,'#c6ad88');}
    A.oval(c,35.5*T,15*T,3.5*T,2.7*T,'#d7d0a4','#9ba281');A.oval(c,35.5*T,15*T,3.2*T,2.4*T,'#9fbfb1','#789a92');for(let i=0;i<8;i++){const xx=33*T+i*42,yy=14*T+i%3*40+Math.sin(time/1600+i)*2;A.line(c,xx,yy,xx+22,yy,'#d9e5ca',2);}
    // Quiet ground detail and small planted courtyards anchor each destination.
    const lawnAt=(x,y)=>TownCore.lawns.some(([a,b,w,h])=>x>(a+.4)*T&&x<(a+w-.4)*T&&y>(b+.4)*T&&y<(b+h-.4)*T);
    for(let y=Math.floor(cy/210)*210;y<cy+view.h;y+=210)for(let x=Math.floor(cx/190)*190;x<cx+view.w;x+=190){const xx=x+((x+y)%63),yy=y+((x+y)%47);if(!lawnAt(xx,yy)||!TownCore.canDecorate(xx,yy,T)||TownCore.buildings.some(([a,b,w,h])=>xx>a*T-30&&xx<(a+w)*T+30&&yy>b*T-180&&yy<(b+h)*T+50))continue;c.save();c.globalAlpha=.3;A.line(c,xx-7,yy,xx-12,yy-7,'#91aa79',2);A.line(c,xx,yy,xx+1,yy-10,'#91aa79',2);A.line(c,xx+7,yy,xx+12,yy-5,'#91aa79',2);if((x+y)%4===0){A.oval(c,xx+20,yy-2,3,3,'#fff4d9',null);A.oval(c,xx+26,yy+3,2,2,'#fff4d9',null);}c.restore();}
    for(const o of objects){if(o.kind==='neighbor'||!visible(o.x,o.y,160,150)||!lawnAt(o.x,o.y))continue;A.oval(c,o.x+3,o.y+34,110,24,'#7e8c6510',null);A.box(c,o.x-106,o.y-30,212,88,'#e5ddbd',28,'#c3bd9d');A.line(c,o.x-80,o.y+46,o.x+80,o.y+46,'#f6edd480',2);for(let i=0;i<3;i++){const yy=o.y+78+i*29;if(lawnAt(o.x,yy))A.oval(c,o.x+(i%2?7:-5),yy,19-i*2,7,'#e1d7b7','#c3bd9d');}for(const dx of [-116,116]){if(!lawnAt(o.x+dx,o.y-15))continue;A.oval(c,o.x+dx,o.y+4,23,7,'#85966c18',null);A.oval(c,o.x+dx-11,o.y-11,15,13,'#b7c89f','#a5b78d');A.oval(c,o.x+dx+10,o.y-12,16,15,'#c0cfa9','#a5b78d');A.oval(c,o.x+dx,o.y-24,17,16,'#cad7b2','#a5b78d');A.oval(c,o.x+dx-4,o.y-28,3,3,'#f3e7c9',null);}}
    // Small gardens and street furniture, with room to see and move around them.
    for(let i=0;i<145;i++){const x=260+(i*311)%(W-520),y=260+(i*461)%(H-520);if(!visible(x,y)||trees.some(t=>x+55>t.x-t.size*1.3&&x-55<t.x+t.size*1.3&&y+35>t.y-t.size*3.2&&y-100<t.y+18)||!TownCore.canDecorate(x,y,T)||x>32*T&&x<39*T&&y>12*T&&y<18*T||x>29*T&&x<41*T&&y>35*T&&y<43*T||TownCore.buildings.some(([a,b,w,h])=>x>a*T-20&&x<(a+w)*T+20&&y>b*T-220&&y<(b+h)*T+80))continue;if(i%3===0)A.bench(c,x,y);else if(i%3===1){A.box(c,x-27,y-8,54,21,'#c69e7b',5);for(let j=0;j<3;j++)A.flower(c,x-17+j*16,y-5,j);}else{A.line(c,x,y+7,x,y-81,'#917762',5);A.box(c,x-12,y-89,24,26,'#f2dfaa',7);A.oval(c,x,y-76,5,9,'#fff2cb',null);}}
    if(path.length){c.setLineDash([3,13]);A.line(c,player.x,player.y,path[0].x,path[0].y,'#fff1bc',5);c.beginPath();c.moveTo(player.x,player.y);for(const p of path)c.lineTo(p.x,p.y);c.stroke();c.setLineDash([]);const goal=path.at(-1);A.oval(c,goal.x,goal.y,18+Math.sin(time/180)*2,8,'#f4df9699','#b69554');}
    const layers=[];
    TownCore.buildings.forEach(([x,y,w,h,v],index)=>{if(visible((x+w/2)*T,(y+h)*T,w*T,350))layers.push({y:(y+h)*T,draw:()=>A.building(c,x*T,y*T,w*T,h*T,v,index+1)});});
    trees.filter(t=>visible(t.x,t.y,90,230)).forEach(t=>layers.push({y:t.y,draw:()=>A.tree(c,t.x,t.y,t.size,t.species,time)}));
    for(const o of objects){if(!visible(o.x,o.y,150,180))continue;layers.push({y:o.y,draw:()=>{if(o.kind==='neighbor'){const i=TownCore.neighbors.findIndex(n=>n.id===o.id);A.cat(c,o.x,o.y,{color:['#eee1c0','#aaa9a1','#e6ba86','#d39a73'][i],accent:['#ac877b','#798d80','#b78c79','#9d897a'][i],variant:i,time,scale:.93});}else A.place(c,o,time);}});}
    const colors={alex:['#edc477','#b97a50'],mira:['#f1dfbc','#a9868e'],leo:['#9fbaa6','#718c80'],nora:['#d9a080','#9a818f']},a=colors[avatarId]||colors.alex;
    layers.push({y:player.y,draw:()=>{A.oval(c,player.x,player.y+7,29,11,'#f4dea766','#b6a06e');A.shape(c,[[player.x-7,player.y-81],[player.x+7,player.y-81],[player.x,player.y-70]],'#b5c38c','#899b6b');A.cat(c,player.x,player.y,{color:a[0],accent:a[1],variant:avatarId==='mira'?1:0,time,walk:path.length>0});}});
    layers.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
    // Labels live above scenery so destinations are readable, never hidden by roofs.
    for(const o of objects){if(!visible(o.x,o.y,130,170))continue;const done=o.kind==='neighbor'?state.talked.includes(o.id):state.completed.includes(o.id),label=o.kind==='neighbor'?o.name:o.place;c.font='bold '+(view.scale<1?15:13)+'px Segoe UI';const w=c.measureText(label).width+23,yy=o.y-(o.kind==='neighbor'?82:125);A.box(c,o.x-w/2,yy,w,25,done?'#e1e2b6':'#fff0cc',8);c.fillStyle=A.ink;c.textAlign='center';c.fillText(label,o.x,yy+17);const badgeY=yy-19+Math.sin(time/430+o.x)*3;c.font='bold 18px Segoe UI';if(o.kind==='neighbor'){if(!done){c.font='900 37px Segoe UI';c.lineWidth=3;c.strokeStyle='#8b6739';c.strokeText('!',o.x,badgeY+10);c.fillStyle='#ffe331';c.fillText('!',o.x,badgeY+10);}}else{A.oval(c,o.x,badgeY,15,15,done?'#c2d5a3':'#a9cfc0','#775047');c.fillStyle='#67473e';c.fillText(done?'✓':'▶',o.x,badgeY+6);}}
    if(hover){const text=hover.kind==='neighbor'?'Поговорить':hover.reward+' Б';c.font='bold 13px sans-serif';const w=c.measureText(text).width+24;A.box(c,hover.x-w/2,hover.y+26,w,24,'#775047',8);c.fillStyle='#fff1cb';c.textAlign='center';c.fillText(text,hover.x,hover.y+43);}
    c.restore();
  }
  return {render};
})();
