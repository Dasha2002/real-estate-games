'use strict';
(() => {
  const T=68, COLS=72, ROWS=54, W=COLS*T, H=ROWS*T;
  const avatars=[['alex','Алекс','#e5be74','#324c60','#c79473','#473b39','Городской исследователь'],['mira','Мира','#b889a8','#405e63','#e4b291','#614535','Любительница тихих садов'],['leo','Лев','#80a794','#40536b','#b87c59','#302c2b','Всегда готов к прогулке'],['nora','Нора','#8caac4','#6c5c73','#f1c6a0','#bc915c','Ищет красоту в деталях']];
  let avatarId='alex';try{avatarId=localStorage.getItem('horizon-avatar')||'alex';}catch{}
  const regions=[['Солнечный двор',4,5,21,22],['Сад соседей',26,5,45,22],['Лесная тропа',50,5,67,22],['Детский остров',4,30,21,48],['Спортивный двор',26,31,44,48],['Тихий сад',50,30,67,48],['Центральный парк',26,24,46,28]];
  const catalog=[['car','Красная машинка',20],['bench','Скамейка с сердцем',20],['slide','Солнечная горка',40],['swing','Лунные качели',80],['tree','Золотая ель',40],['bike','Мятный велосипед',20],['scooter','Синий самокат',40],['ball','Полосатый мяч',80],['horse','Игрушка-лошадка',80],['lamp','Фонарь со звездой',20],['gazebo','Беседка с флажком',40],['flower','Алый цветок',20],['car','Жёлтый автомобиль',40],['bench','Лесная скамейка',20],['ball','Забытый мяч',80],['bike','Велосипед курьера',40],['scooter','Самокат малыша',20],['horse','Деревянная лошадка',80],['tree','Розовое дерево',40],['lamp','Садовый фонарь',20],['gazebo','Тайная беседка',80],['swing','Качели для двоих',40],['flower','Лесной колокольчик',80],['ball','Баскетбольный мяч',20],['slide','Маленькая горка',40],['bike','Зелёный велосипед',20],['horse','Лошадка в траве',80],['flower','Цветок у фонтана',20]];
  let state,objects,trees,blocked,gates,rng,canvas,ctx,mini,mctx,view={w:0,h:0},camera={x:0,y:0},player,path=[],pending=null,last=0,hover=null,active=true,hintUntil=0,hintId=null,noticeTimer;
  const root=Game.root;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const center=(x,y)=>({x:(x+.5)*T,y:(y+.5)*T});
  function randomSeed(str){let n=2166136261;for(const c of str)n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
  function save(){state.player={...player};try{localStorage.setItem('horizon-park-v2',JSON.stringify(state));}catch{}}
  function cell(x,y){return Math.floor(y/T)*COLS+Math.floor(x/T);}
  function block(x,y){if(x>=0&&y>=0&&x<COLS&&y<ROWS)blocked.add(y*COLS+x);}
  function grassRect(x0,y0,x1,y1){
    const intersects=(x,y,w,h)=>x1>x&&x0<x+w&&y1>y&&y0<y+h;
    if([24,48].some(c=>intersects(c*T-25,3*T,72,48*T)))return false;
    if([25,28].some(c=>intersects(3*T,c*T,66*T,52)))return false;
    if(intersects(32*T,12*T,7*T,6*T)||intersects(29*T,35*T,12*T,8*T)||intersects(5*T,31*T,16*T,17*T))return false;
    for(let x=120;x<W-200;x+=420){const w=240+(Math.floor(x/420)%3)*30;if(intersects(x-26,15,w+52,165))return false;if((x<1600||x>2600)&&intersects(x-26,H-180,w+52,170))return false;}
    for(let y=250;y<H-300;y+=380)if(intersects(0,y,150,240))return false;
    return true;
  }
  function onGrass(x,y,r=12){return grassRect(x-r,y-r,x+r,y+r);}
  function treeOnGrass(t){return grassRect(t.x-t.size*1.3,t.y-t.size*3.8,t.x+t.size*1.3,t.y+18);}  function generate(){
    rng=randomSeed(state.day);blocked=new Set();trees=[];objects=[];
    // Buildings and woodland alternate around the edges of the neighbourhood.
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(x<3||y<3||x>68||y>50)block(x,y);
    gates=[{id:'wicket',x:13,y:30,cost:5,label:'Калитка детского острова',region:3},{id:'garden',x:58,y:30,cost:10,label:'Калитка тихого сада',region:5},{id:'bridge',x:58,y:5,cost:0,label:'Опустить лесной мостик',region:2}];
    for(const g of gates){const [,x0,y0,x1,y1]=regions[g.region];for(let x=x0;x<=x1;x++){block(x,y0);block(x,y1);}for(let y=y0;y<=y1;y++){block(x0,y);block(x1,y);}if(state.open.includes(g.id))blocked.delete(g.y*COLS+g.x);}
    // A pond is a real obstacle; paths lead around it.
    for(let y=12;y<18;y++)for(let x=32;x<39;x++)block(x,y);
    regions.forEach((r,ri)=>{
      const [,x0,y0,x1,y1]=r;
      for(let i=0;i<4;i++){
        let x,y;do{x=x0+2+Math.floor(rng()*Math.max(1,x1-x0-4));y=y0+2+Math.floor(rng()*Math.max(1,y1-y0-4));}while(blocked.has(y*COLS+x)||(catalog[ri*4+i][0]==="tree"&&!grassRect((x+.5)*T-40,(y+.5)*T-120,(x+.5)*T+40,(y+.5)*T+40))||objects.some(o=>Math.hypot(o.x-(x+.5)*T,o.y-(y+.5)*T)<T*1.5));
        const id=ri*4+i, [type,name,value]=catalog[id];objects.push({id,type,name,value,region:ri,...center(x,y)});
      }
    });
    for(let i=0;i<650;i++){
      const x=3+Math.floor(rng()*66),y=3+Math.floor(rng()*47),p=center(x,y);
      if(!onGrass(p.x,p.y,35)||objects.some(o=>Math.hypot(o.x-p.x,o.y-p.y)<T*1.6)||gates.some(g=>Math.hypot(g.x-x,g.y-y)<3)||blocked.has(y*COLS+x))continue;
      trees.push({...p,size:32+rng()*26,tone:Math.floor(rng()*3),species:Math.floor(rng()*4),phase:rng()*6});
      // Canopies conceal small objects, while their trunks are navigable obstacles.
      block(x,y);
    }
    // Keep all collectibles connected to the region entrance, even in dense forest.
    for(const r of regions){const ri=regions.indexOf(r),g=gates.find(g=>g.region===ri);const start=g?{x:g.x,y:g.y+1}:{x:r[1]+1,y:r[2]+1};for(const o of objects.filter(o=>o.region===ri)){let x=start.x,y=start.y;while(x!==Math.floor(o.x/T)){blocked.delete(y*COLS+x);x+=Math.sign(Math.floor(o.x/T)-x);}while(y!==Math.floor(o.y/T)){blocked.delete(y*COLS+x);y+=Math.sign(Math.floor(o.y/T)-y);}blocked.delete(y*COLS+x);}}
    // Every gate has a public approach, regardless of the daily woodland seed.
    for(const g of gates)for(let x=13;x<=58;x++)blocked.delete((g.y-1)*COLS+x);
    trees=trees.filter(t=>{if(!treeOnGrass(t)){blocked.delete(cell(t.x,t.y));return false;}return blocked.has(cell(t.x,t.y));});
  }
  function load(){const day=Loyalty.day();let v;try{v=JSON.parse(localStorage.getItem('horizon-park-v2'));}catch{}state=v?.day===day&&Array.isArray(v.found)&&Array.isArray(v.open)?v:{day,found:[],open:[],player:center(24,27)};if(!state.scale){state.player=center(24,27);state.scale=T;}player=state.player||center(24,27);generate();path=[];pending=null;}
  function route(target){
    const start=cell(player.x,player.y),end=cell(target.x,target.y);if(blocked.has(end))return null;
    const queue=[start],prev=new Map([[start,-1]]);let head=0;
    while(head<queue.length){const c=queue[head++];if(c===end)break;const x=c%COLS,y=Math.floor(c/COLS);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*COLS+nx;if(nx<0||ny<0||nx>=COLS||ny>=ROWS||blocked.has(n)||prev.has(n))continue;prev.set(n,c);queue.push(n);}}
    if(!prev.has(end))return null;const p=[];for(let c=end;c!==start;c=prev.get(c))p.push(center(c%COLS,Math.floor(c/COLS)));return p.reverse();
  }
  function notify(message){const n=document.querySelector('#park-notice');n.textContent=message;n.classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.classList.remove('visible'),5000);}
  function walkTo(target,done){const p=route(target);if(!p){notify('Путь закрыт. Обойдите препятствие или откройте вход в этот район.');return;}path=p;pending=done;if(!path.length)arrive();}
  function arrive(){save();const cb=pending;pending=null;if(cb)cb();}
  function find(o){
    if(state.found.includes(o.id))return;
    // Wallet first: an interrupted browser save can never pay twice.
    let earned=Loyalty.award('park:'+state.day+':'+o.id,o.value);state.found.push(o.id);
    const districts=new Set(state.found.map(id=>objects[id].region));
    if(districts.size===7)earned+=Loyalty.award('park:'+state.day+':seven',100);
    save();journal();notify(o.name+' · +'+earned+' Б'+(districts.size===7?' · Все семь районов исследованы!':''));
    if(state.found.length===objects.length)Game.modal('Парк исследован!',`<p>Все 28 находок у вас. Семь секретов открыты. Завтра вас ждёт новая расстановка предметов.</p><button class="btn" data-shop>Выбрать награду</button><button class="quiet" data-close>Ещё погулять</button>`);
  }
  function gate(g){
    if(state.open.includes(g.id))return;
    Game.modal(g.label,`<p>${g.cost?'Откройте проход за '+g.cost+' баллов из общего кошелька.':'Вы нашли рычаг мостика. Опустите его, чтобы попасть в лесной сад. Это бесплатно.'} За проходом встречаются находки всех уровней ценности.</p><button class="btn" id="open-gate" ${Loyalty.read().balance<g.cost?'disabled':''}>${g.cost?'Открыть · '+g.cost+' Б':'Потянуть рычаг'}</button>${Loyalty.read().balance<g.cost?'<p>Сначала найдите предметы в открытых районах.</p>':''}`);
    document.querySelector('#open-gate').onclick=()=>{if(state.open.includes(g.id)||!Loyalty.spend(g.cost))return;state.open.push(g.id);blocked.delete(g.y*COLS+g.x);save();Game.close();notify('Проход открыт. Исследуйте новый район!');};
  }
  function journal(){
    const found=state.found, districts=new Set(found.map(id=>objects[id].region));
    document.querySelector('#found-count').textContent=found.length+' / '+objects.length;
    document.querySelector('#secrets-count').textContent=districts.size+' / 7';
    document.querySelector('#park-progress').value=found.length;
    document.querySelector('#journal-list').innerHTML=regions.map((r,i)=>`<details ${i===0?'open':''}><summary><span class="district-dot ${districts.has(i)?'done':''}">${districts.has(i)?'✓':'◇'}</span>${r[0]} <small>${found.filter(id=>objects[id].region===i).length}/4</small></summary>${objects.filter(o=>o.region===i).map(o=>`<div class="journal-item ${found.includes(o.id)?'found':''}"><span>${found.includes(o.id)?'✓':o.value===80?'✦':o.value===40?'◇':'○'} ${o.name}</span><b>${o.value} Б</b></div>`).join('')}</details>`).join('');
  }
  function instructions(){Game.modal('Ваше приключение во дворе',`<p class="intro-kicker">7 районов · 28 находок · новый парк каждый день</p><ol class="park-instructions"><li><b>Исследуйте.</b> Нажмите на свободное место: персонаж сам построит маршрут. Камера следует за ним и останавливается на краях карты. Также работают WASD и стрелки.</li><li><b>Присматривайтесь.</b> Найдите необычные предметы и нажмите на них. Персонаж подойдёт и заберёт находку. Ищите даже в траве и под кронами.</li><li><b>Зарабатывайте.</b> Обычный предмет — 20 Б, редкий — 40 Б, тайник — 80 Б. Первая находка в каждом из 7 районов открывает секрет; все 7 секретов дают ещё 100 Б.</li><li><b>Открывайте пути.</b> Калитки стоят 5 и 10 Б. Лесной мостик опускается рычагом бесплатно. Ценность предмета не зависит от стоимости прохода.</li><li><b>Выбирайте.</b> Подсказка на 20 секунд стоит 10 Б. Общие баллы можно потратить в магазине наград.</li></ol><p>В 00:00 по времени вашего устройства меняются предметы и растительность. Прогресс поиска начинается заново; кошелёк и купоны сохраняются. Перезапуск не приносит повторных баллов за уже найденные предметы.</p><div class="actions"><button class="btn" data-avatar-menu>Выбрать персонажа</button><button class="quiet" data-close>Отправиться на прогулку</button></div>`);}
  function hint(){const o=objects.find(o=>!state.found.includes(o.id)&&route(o));if(!o){notify('Откройте оставшиеся проходы или дождитесь нового дня.');return;}Game.modal('Подсказка · 10 Б',`<p>На 20 секунд отметим на карте доступную находку и направление к ней.</p><button class="btn" id="buy-hint" ${Loyalty.read().balance<10?'disabled':''}>Показать за 10 Б</button>`);document.querySelector('#buy-hint').onclick=()=>{if(!Loyalty.spend(10))return;hintId=o.id;hintUntil=performance.now()+20000;Game.close();notify(o.name+' — '+regions[o.region][0]+'. Следуйте по пунктиру.');};}
  function mount(){
    document.body.classList.add('park-game');
    root.innerHTML=`<section class="park-shell"><div class="park-stage"><canvas id="park" tabindex="0" aria-label="Карта парка. Нажмите для перемещения. WASD и стрелки — движение, E — осмотреть ближайший объект."></canvas><div class="park-location"><span class="live-dot"></span><div><b id="district-name">Центральный парк</b><small>Ежедневная экспедиция</small></div></div><div class="park-tools"><button class="map-tool" id="fullscreen" aria-label="Полный экран">⛶</button><button class="map-tool" id="center" aria-label="Вернуться к персонажу">◎</button></div><div class="park-legend"><span>○ 20 Б</span><span>◇ 40 Б</span><span>✦ 80 Б</span></div><div class="park-minimap"><canvas id="minimap" width="180" height="135" aria-label="Обзорная карта парка"></canvas><small>Карта района</small></div><div id="park-notice" role="status"></div><div class="park-move-note">Нажмите, чтобы идти <span>· WASD / стрелки · E осмотреть</span></div></div><aside class="park-sidebar"><div class="park-title"><p class="eyebrow">ЕЖЕДНЕВНОЕ ПРИКЛЮЧЕНИЕ</p><h1>7 секретов<br>Горизонта</h1><p>Большой двор. Маленькие открытия.</p></div><button class="park-avatar-button" id="avatar-select">Выбрать персонажа</button><div class="park-stats"><div><b id="found-count">0 / 28</b><span>находок</span></div><div><b id="secrets-count">0 / 7</b><span>секретов</span></div></div><progress id="park-progress" max="28" value="0"></progress><div class="daily-note"><span>Новая экспедиция через</span><b id="day-countdown"></b></div><div id="journal-list" class="park-journal"></div><div class="park-sidebar-bottom"><button class="btn" id="hint">Подсказка · 10 Б</button><button class="quiet" data-shop>Магазин наград</button><p>За 7 секретов — ещё 100 Б</p></div></aside></section>`;
    canvas=document.querySelector('#park');ctx=canvas.getContext('2d');mini=document.querySelector('#minimap');mctx=mini.getContext('2d');
    new ResizeObserver(resize).observe(canvas);resize();journal();
    document.querySelector('#avatar-select').onclick=chooseAvatar;document.querySelector('#avatar-select').textContent=(avatars.find(a=>a[0]===avatarId)||avatars[0])[1]+' · Сменить';document.querySelector('#hint').onclick=hint;document.querySelector('[data-rules]').onclick=instructions;
    document.querySelector('#center').onclick=()=>{canvas.focus();notify('Вы в центре экрана. Продолжайте исследование.');};
    document.querySelector('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('Игра уже занимает всё окно браузера.');}};
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus();const p=pointer(e),g=gates.find(g=>Math.hypot(p.x-(g.x+.5)*T,p.y-(g.y+.5)*T)<40&&!state.open.includes(g.id));if(g){walkTo(center(g.x,g.y-1),()=>gate(g));return;}const o=objects.filter(o=>!state.found.includes(o.id)).find(o=>Math.hypot(o.x-p.x,o.y-p.y)<(o.value===80?20:29));if(o){walkTo(o,()=>find(o));return;}walkTo(p);});
    canvas.addEventListener('pointermove',e=>{const p=pointer(e);hover=objects.find(o=>!state.found.includes(o.id)&&Math.hypot(o.x-p.x,o.y-p.y)<26&&Math.hypot(o.x-player.x,o.y-player.y)<190);canvas.style.cursor=hover?'pointer':'crosshair';});
    canvas.addEventListener('pointerleave',()=>hover=null);
    mini.setAttribute('aria-label','Обзорная карта. Нажмите на дорожку, чтобы проложить маршрут.');
    mini.addEventListener('pointerdown',e=>{canvas.focus();const r=mini.getBoundingClientRect();walkTo({x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H});});
    canvas.addEventListener('keydown',e=>{const moves={ArrowLeft:[-1,0],a:[-1,0],ф:[-1,0],ArrowRight:[1,0],d:[1,0],в:[1,0],ArrowUp:[0,-1],w:[0,-1],ц:[0,-1],ArrowDown:[0,1],s:[0,1],ы:[0,1]};const d=moves[e.key];if(d){e.preventDefault();const p=center(Math.floor(player.x/T)+d[0],Math.floor(player.y/T)+d[1]);if(!blocked.has(cell(p.x,p.y))&&p.x>=0&&p.y>=0&&p.x<W&&p.y<H){path=[p];pending=null;}}if(e.key.toLowerCase()==='e'||e.key==='у'){e.preventDefault();const g=gates.find(g=>!state.open.includes(g.id)&&Math.hypot((g.x+.5)*T-player.x,(g.y+.5)*T-player.y)<100);const o=objects.find(o=>!state.found.includes(o.id)&&Math.hypot(o.x-player.x,o.y-player.y)<80);if(g)gate(g);else if(o)find(o);else notify('Подойдите ближе к предмету или калитке.');}});
  }
  function pointer(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left+camera.x,y:e.clientY-r.top+camera.y};}
  function chooseAvatar(){
    Game.modal('Кто отправится на прогулку?',`<p>Выберите своего исследователя. Персонажи отличаются внешностью; способности и доступные находки одинаковы.</p><div class="avatar-grid">${avatars.map(([id,name,shirt,pants,skin,hair,desc])=>`<button data-avatar="${id}" class="avatar-card" aria-pressed="${avatarId===id}"><span class="avatar-portrait" style="--shirt:${shirt};--pants:${pants};--skin:${skin};--hair:${hair}"><i class="avatar-hair"></i><i class="avatar-face"></i><i class="avatar-shirt"></i><i class="avatar-legs"></i></span><b>${name}</b><small>${desc}</small></button>`).join('')}</div><button class="btn" data-close>Начать прогулку</button>`);
    document.querySelectorAll('[data-avatar]').forEach(b=>b.onclick=()=>{avatarId=b.dataset.avatar;try{localStorage.setItem('horizon-avatar',avatarId);}catch{}document.querySelectorAll('[data-avatar]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));document.querySelector('#avatar-select').textContent=avatars.find(a=>a[0]===avatarId)[1]+' · Сменить';});
  }
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);view={w:r.width,h:r.height};canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);}
  function rect(x,y,w,h,color,r=0){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function line(x,y,x2,y2,color,width=3){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
  function ellipse(x,y,rx,ry,color,angle=0){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2);ctx.fill();}
  function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
  function tree(t){
    const species=t.species??(Math.floor(t.x/T+t.y/T)%4),s=t.size/40;
    ellipse(t.x+22*s,t.y+8*s,35*s,12*s,'#244d3a24',.35);ctx.save();ctx.translate(t.x,t.y);ctx.scale(s,s);
    if(species===0){rect(-5,-33,10,44,'#7a6143',3);const sway=Math.sin(performance.now()/1800+(t.phase||0))*1.4;ctx.translate(sway,0);poly([[-35,-12],[0,-68],[35,-12]],'#386752');poly([[-30,-35],[0,-89],[30,-35]],'#477f61');poly([[-23,-59],[0,-109],[23,-59]],'#5d9470');poly([[-12,-64],[0,-109],[0,-65]],'#79a27b');line(3,-94,15,-66,'#bad09c35',2);}
    else if(species===1){rect(-4,-78,9,88,'#e6e2c9',3);for(let y=-72;y<5;y+=16)line(-3,y,3,y+2,'#586957',2);ctx.save();ctx.translate(Math.sin(performance.now()/1400+(t.phase||0))*2,0);ellipse(-18,-83,27,36,'#66955b',-.4);ellipse(19,-79,29,37,'#76a263',.3);ellipse(0,-112,28,34,'#97b47a');ellipse(-12,-112,12,24,'#bad18d55');ctx.restore();line(0,-51,-23,-85,'#d4d2b7',3);line(0,-62,23,-87,'#d4d2b7',3);}
    else {rect(-6,-43,12,55,'#826145',4);const sway=Math.sin(performance.now()/1700+(t.phase||0))*1.5;ctx.translate(sway,0);const colors=species===3?['#879c68','#a6b37b','#bdc18a']:['#4e7d54','#70935d','#92ad70'];const grad=ctx.createRadialGradient(-13,-89,4,4,-66,52);grad.addColorStop(0,colors[2]);grad.addColorStop(.5,colors[1]);grad.addColorStop(1,colors[0]);ellipse(-22,-63,31,34,colors[0],-.3);ellipse(20,-62,34,38,colors[0],.4);ellipse(0,-84,42,43,grad);ellipse(-19,-90,17,19,'#dce5aa25');circle(17,-56,15,'#284f3d20');}
    ctx.restore();
  }
  function icon(o){const scale=o.value===80?.65:o.value===40?.9:1;ctx.save();ctx.translate(o.x,o.y);ctx.scale(scale,scale);ctx.globalAlpha=o.value===80?.83:1;
    switch(o.type){
      case 'car':rect(-25,-15,50,27,o.id===12?'#d9b344':'#d97962',8);rect(-12,-21,27,17,'#dbe4df',5);for(const x of [-15,15])circle(x,13,6,'#273844');break;
      case 'bench':for(let y=-10;y<9;y+=7)rect(-27,y,54,5,'#b58a55',2);line(-20,10,-20,23,'#40595a',4);line(20,10,20,23,'#40595a',4);break;
      case 'slide':line(-20,18,-20,-32,'#a07545',5);rect(-29,-35,26,9,'#d7aa62',3);ctx.strokeStyle='#de8851';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(-5,-29);ctx.bezierCurveTo(10,-25,0,20,31,20);ctx.stroke();break;
      case 'swing':line(-25,22,-20,-30,'#8d674a',4);line(25,22,20,-30,'#8d674a',4);line(-20,-30,20,-30,'#8d674a',5);line(-9,-30,-9,7,'#e1d1a4',2);line(9,-30,9,7,'#e1d1a4',2);rect(-14,7,28,6,'#cc8958',2);break;
      case 'tree':tree({x:0,y:8,size:27,tone:0});circle(0,-28,22,o.id===18?'#d6a0b0':'#d5b65b');circle(-9,-39,13,o.id===18?'#e9bcc6':'#e6cd78');break;
      case 'bike':for(const x of [-19,19]){circle(x,8,13,'#334a4a');circle(x,8,9,'#a2c7af');}line(-19,8,0,-12,'#63c6ae',4);line(0,-12,19,8,'#63c6ae',4);line(-19,8,5,8,'#63c6ae',3);line(5,8,-4,-15,'#63c6ae',3);line(-9,-17,3,-17,'#30464a',4);break;
      case 'scooter':circle(-12,15,6,'#314753');circle(15,15,6,'#314753');line(-12,9,15,9,'#719fbe',5);line(12,9,12,-25,'#719fbe',4);line(4,-26,20,-26,'#30434e',4);break;
      case 'ball':circle(0,0,15,'#e9ad67');line(-13,-5,13,5,'#926c4d',2);line(4,-14,-4,14,'#926c4d',2);break;
      case 'horse':rect(-17,-8,30,18,'#d2ac79',6);line(-12,8,-16,23,'#ae8156',5);line(10,8,15,23,'#ae8156',5);rect(7,-23,12,24,'#dab888',4);rect(7,-27,22,11,'#dab888',4);circle(19,-24,2,'#3b4140');break;
      case 'lamp':line(0,18,0,-32,'#455e61',5);rect(-11,-43,22,19,'#344f55',4);rect(-7,-40,14,13,'#f7dc91',2);circle(0,-34,24,'#ffdf7c18');break;
      case 'gazebo':for(const x of [-25,25])line(x,-13,x,24,'#a68a5b',5);rect(-32,19,64,7,'#b29b70',4);ctx.fillStyle='#7c9a86';ctx.beginPath();ctx.moveTo(-37,-13);ctx.lineTo(0,-41);ctx.lineTo(37,-13);ctx.fill();line(0,-41,0,-56,'#56695c',2);rect(1,-56,13,8,'#dca371');break;
      default:line(0,12,0,-5,'#3e7951',3);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;circle(Math.cos(a)*7,Math.sin(a)*7-9,7,'#d9939c');}circle(0,-9,5,'#f7d990');
    }
    if(o.value===80){for(let i=0;i<5;i++){const x=-23+i*11;line(x,20,x+4,-3-(i%2)*9,'#5e8659',3);line(x,20,x-4,5,'#7b9d62',2);}circle(-14,7,7,'#81a36b');circle(12,10,8,'#72975e');}
    ctx.restore();
  }
  function building(x,y,w,h){
    const variant=Math.abs(Math.floor(x/420+y/380))%4,palettes=[['#e1ceae','#bba78a','#f0dfbd'],['#b5c1b4','#869e91','#dae0cc'],['#c3937a','#956e5c','#e0b99a'],['#d1d5ce','#9ca8a5','#f0eee0']],p=palettes[variant],height=95+variant*29,base=y+h,top=base-height;
    poly([[x+10,base],[x+w+45,base+10],[x+w+100,base+65],[x+50,base+45]],'#284d3830');
    // Closed prism: the left and right roof eaves each meet a full side wall.
    poly([[x-26,top-24],[x,top],[x,base],[x-26,base-24]],p[1]);
    rect(x,top,w,height,p[0],1);poly([[x+w,top],[x+w+26,top-24],[x+w+26,base-24],[x+w,base]],p[1]);poly([[x,top],[x-26,top-24],[x+w+26,top-24],[x+w,top]],p[2]);
    line(x,top+3,x+w,top+3,'#fff2d3',4);for(let yy=top+14;yy<base-23;yy+=31)for(let xx=x+14;xx<x+w-20;xx+=38){rect(xx+2,yy+2,20,24,'#233f4330',1);rect(xx,yy,18,22,'#58727a',2);rect(xx+2,yy+2,7,15,'#afcbd0',1);line(xx+9,yy,xx+9,yy+22,'#dce1d2',2);if(variant===2&&Math.floor((xx-x)/38)%2===0){rect(xx-3,yy+19,25,5,'#b7aa94',1);line(xx-3,yy+11,xx-3,yy+20,'#66756c',1);line(xx+22,yy+11,xx+22,yy+20,'#66756c',1);}}
    rect(x+w/2-17,base-34,34,34,'#365557',3);rect(x+w/2-12,base-30,10,25,'#8ca9a7',1);poly([[x+w/2-28,base-32],[x+w/2+25,base-32],[x+w/2+15,base-43],[x+w/2-37,base-43]],'#5f7e70');rect(x+8,base-8,w-16,8,p[1]);
  }
  function draw(){
    camera.x=clamp(player.x-view.w/2,0,Math.max(0,W-view.w));camera.y=clamp(player.y-view.h/2,0,Math.max(0,H-view.h));
    ctx.clearRect(0,0,view.w,view.h);ctx.save();ctx.translate(-camera.x,-camera.y);rect(0,0,W,H,'#9db785');
    // Tile texture is deterministic and static across frames.
    for(let y=Math.floor(camera.y/T);y<Math.min(ROWS,(camera.y+view.h)/T+1);y++)for(let x=Math.floor(camera.x/T);x<Math.min(COLS,(camera.x+view.w)/T+1);x++){if((x*17+y*13)%7===0)rect(x*T,y*T,T,T,'#a2bf922a');if((x+y)%3===0){line(x*T+12,y*T+20,x*T+15,y*T+15,'#7b9d7240',1);}}
    for(const x of [24,48]){rect(x*T-25,3*T,72,48*T,'#d9cfb2',30);line(x*T+9,3*T,x*T+9,51*T,'#ede4ca',3);}
    for(const y of [25,28])rect(3*T,y*T,66*T,52,'#ded5bc',25);
    // Low-contrast lawn islands, flower borders and raised planters enrich the ground plane.
    for(let i=0;i<95;i++){const x=220+(i*223)%(W-450),y=220+(i*379)%(H-450);if(blocked.has(cell(x,y)))continue;ellipse(x,y,50+i%4*17,24+i%3*7,i%2?'#b6c59445':'#779b7150',i*.7);}
    regions.forEach(([name,x0,y0,x1,y1],i)=>{if(i===6)return;rect((x0+1)*T,(y0+1)*T,(x1-x0-1)*T,(y1-y0-1)*T,i===3?'#ccb386':i===4?'#779e91':'#a5bc8a',65);ctx.fillStyle='#35574465';ctx.font='700 20px Segoe UI';ctx.textAlign='center';ctx.fillText(name,(x0+x1+1)*T/2,(y0+2)*T);});
    // Paving joints follow the public boulevards.
    for(let i=0;i<90;i++){const x=220+(i*223)%(W-450),y=220+(i*379)%(H-450);if(blocked.has(cell(x,y)))continue;ellipse(x,y,35+i%4*12,18+i%3*5,i%2?'#c5cc9640':'#6f95682b',i*.7);for(let j=0;j<4;j++)line(x+j*9-15,y+3,x+j*9-13,y-3,'#5d815438',1);}
    for(const x of [24,48])for(let y=Math.floor(camera.y/35)*35;y<camera.y+view.h;y+=35)line(x*T-24,y,x*T+46,y,'#a59f7a30',1);
    for(const y of [25,28])for(let x=Math.floor(camera.x/45)*45;x<camera.x+view.w;x+=45)line(x,y*T+2,x,y*T+50,'#a59f7a30',1);
    for(let i=0;i<26;i++){const x=260+(i*311)%(W-600),y=200+(i*467)%(H-500);if(blocked.has(cell(x,y)))continue;ellipse(x+7,y+9,43,21,'#44614423');ellipse(x,y,45,21,'#c2b58d');ellipse(x,y-4,42,20,'#628058');for(let j=0;j<10;j++){const a=j*2.4;circle(x+Math.cos(a)*((j%3+1)*11),y-4+Math.sin(a)*12,3.5,['#ddbb91','#d1a2ae','#e5d19c'][i%3]);}}
    rect(32*T+8,12*T+12,7*T,6*T,'#3d6c6333',90);rect(32*T,12*T,7*T,6*T,'#b6c19a',90);const water=ctx.createLinearGradient(0,12*T,0,18*T);water.addColorStop(0,'#69a89c');water.addColorStop(1,'#99c5b3');rect(32*T+15,12*T+15,7*T-30,6*T-30,water,80);for(let i=0;i<12;i++){const xx=33*T+i*26,yy=14*T+i%3*55+Math.sin(performance.now()/1300+i)*3;line(xx,yy,xx+28,yy,'#d6e9c755',2);}
    // Sport court with marked playing field.
    ctx.strokeStyle='#dce5d0';ctx.lineWidth=4;ctx.strokeRect(29*T,35*T,12*T,8*T);ctx.beginPath();ctx.arc(35*T,39*T,65,0,Math.PI*2);ctx.stroke();line(35*T,35*T,35*T,43*T,'#dce5d0',4);
    for(const g of gates){const [,x0,y0,x1,y1]=regions[g.region];line(x0*T+24,y0*T+24,(x1+.5)*T,y0*T+24,'#497051',17);line(x0*T+24,(y1+.5)*T,(x1+.5)*T,(y1+.5)*T,'#497051',17);line(x0*T+24,y0*T+24,x0*T+24,(y1+.5)*T,'#497051',17);line((x1+.5)*T,y0*T+24,(x1+.5)*T,(y1+.5)*T,'#497051',17);rect(g.x*T,g.y*T,T,T,state.open.includes(g.id)?'#ddc9a4':'#af855d',4);ctx.fillStyle=state.open.includes(g.id)?'#3b644a':'#fff2cf';ctx.font='bold 16px Segoe UI';ctx.textAlign='center';ctx.fillText(state.open.includes(g.id)?'✓':g.cost?g.cost+' Б':'⚙',(g.x+.5)*T,(g.y+.65)*T);}
    // Housing along two edges, woodland along the other edges.
    for(let x=120;x<W-200;x+=420){building(x,15,240+(Math.floor(x/420)%3)*30,165);if(x<1600||x>2600)building(x,H-180,240+(Math.floor(x/420)%3)*30,170);}
    for(let y=250;y<H-300;y+=380)building(8,y,115,240);
    for(let x=120;x<W;x+=85)if(treeOnGrass({x,y:H-30,size:38}))tree({x,y:H-30,size:38,tone:Math.floor(x/85)%3});
    for(let y=150;y<H;y+=75)if(treeOnGrass({x:W-65,y,size:48}))tree({x:W-65,y,size:48,tone:Math.floor(y/75)%3});
    // Everyday scenery makes targets part of a lived-in neighbourhood.
    for(let i=0;i<65;i++){const x=300+(i*137)%(W-600),y=180+(i*251)%(H-600);if(!blocked.has(cell(x,y)))icon({x,y,type:['bench','lamp','flower'][i%3],id:-1,value:20});}
    if(path.length){ctx.setLineDash([5,10]);ctx.strokeStyle='#fff9df9c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(player.x,player.y);for(const p of path)ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);}
    const visible=(p)=>p.x>camera.x-80&&p.y>camera.y-80&&p.x<camera.x+view.w+80&&p.y<camera.y+view.h+80;
    const layers=[...trees.filter(visible).map(t=>({y:t.y,draw:()=>tree(t)})),...objects.filter(o=>!state.found.includes(o.id)&&visible(o)).map(o=>({y:o.y-8,draw:()=>icon(o)})),{y:player.y,draw:()=>drawPlayer()}];layers.sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
    // Airborne seeds and soft sun shafts move independently of the player.
    for(let i=0;i<12;i++){const x=camera.x+(i*173+performance.now()/65)%Math.max(1,view.w),y=camera.y+(i*113+Math.sin(performance.now()/1800+i)*16)%Math.max(1,view.h);ellipse(x,y,2,1,'#f8edbe80',.5);}
    if(hintId!==null&&performance.now()<hintUntil&&!state.found.includes(hintId)){const o=objects[hintId];ctx.setLineDash([8,8]);line(player.x,player.y,o.x,o.y,'#f9eabb',3);ctx.setLineDash([]);ctx.strokeStyle='#fff1a8';ctx.lineWidth=4;ctx.beginPath();ctx.arc(o.x,o.y,32+Math.sin(performance.now()/250)*5,0,Math.PI*2);ctx.stroke();}
    if(hover){rect(hover.x-120,hover.y-75,240,35,'#182f30e8',10);ctx.fillStyle='#fff4d8';ctx.font='14px Segoe UI';ctx.textAlign='center';ctx.fillText(hover.name+' · '+hover.value+' Б',hover.x,hover.y-52);}
    ctx.restore();drawMini();
  }
  function drawPlayer(){
    const {x,y}=player,bob=path.length?Math.sin(performance.now()/70)*2:0,walk=path.length?Math.sin(performance.now()/90)*4:0,a=avatars.find(a=>a[0]===avatarId)||avatars[0];
    ellipse(x+10,y+6,18,7,'#25453840',.2);ellipse(x,y+6,21,10,'#f7edc755');line(x-5,y-12,x-7+walk,y+2,a[3],7);line(x+5,y-12,x+7-walk,y+2,a[3],7);ellipse(x-7+walk,y+3,5,3,'#e1dfc5');ellipse(x+7-walk,y+3,5,3,'#e1dfc5');
    rect(x-13,y-38+bob,26,29,a[2],9);rect(x+7,y-34+bob,7,24,'#2c493e27',4);line(x-13,y-31+bob,x-17,y-16-walk,a[4],6);line(x+13,y-31+bob,x+17,y-16+walk,a[4],6);circle(x,y-47+bob,11,a[4]);ellipse(x-4,y-49+bob,5,7,'#ffe2b125');
    ctx.fillStyle=a[5];ctx.beginPath();ctx.arc(x,y-51+bob,11,Math.PI,Math.PI*2);ctx.fill();if(avatarId==='mira'||avatarId==='nora'){ellipse(x-9,y-44+bob,4,10,a[5]);if(avatarId==='mira')ellipse(x-11,y-39+bob,5,7,a[5]);}circle(x+4,y-48+bob,1.6,'#394238');line(x-1,y-40+bob,x+4,y-40+bob,'#ac8062',1);if(avatarId==='leo'){ellipse(x,y-56+bob,13,5,'#d1b58b');ellipse(x+5,y-54+bob,15,3,'#af936c');}rect(x-4,y-36+bob,8,3,'#e8d3ad',2);
  }
  function drawMini(){mctx.fillStyle='#92b486';mctx.fillRect(0,0,180,135);mctx.fillStyle='#d9cfb2';for(const x of [24,48])mctx.fillRect(x/COLS*180,7,4,120);for(const y of [25,28])mctx.fillRect(7,y/ROWS*135,165,3);mctx.fillStyle='#6daca9';mctx.fillRect(80,30,18,15);mctx.strokeStyle='#4f7258';for(const [,x,y,x1,y1]of regions)mctx.strokeRect(x/COLS*180,y/ROWS*135,(x1-x)/COLS*180,(y1-y)/ROWS*135);mctx.fillStyle='#fff2b1';mctx.beginPath();mctx.arc(player.x/W*180,player.y/H*135,3,0,7);mctx.fill();mctx.strokeStyle='#ffffffaa';mctx.strokeRect(camera.x/W*180,camera.y/H*135,view.w/W*180,view.h/H*135);}
  function tick(now){if(!active)return;const dt=Math.min((now-last)/1000,.05)||0;last=now;if(!Game.dialog.open&&path.length){let remaining=dt*340;while(path.length&&remaining>0){const p=path[0],dist=Math.hypot(p.x-player.x,p.y-player.y);if(dist<=remaining){player={...p};path.shift();remaining-=dist;if(!path.length)arrive();}else{player.x+=(p.x-player.x)/dist*remaining;player.y+=(p.y-player.y)/dist*remaining;remaining=0;}}}draw();requestAnimationFrame(tick);}
  function daily(){const now=new Date();if(Loyalty.day(now)!==state.day){load();journal();Game.close();hintId=null;notify('Новый день! В парке появились новые тайники. Ваши баллы сохранены.');}const midnight=new Date(now);midnight.setHours(24,0,0,0);const s=Math.floor((midnight-now)/1000);document.querySelector('#day-countdown').textContent=[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');const r=regions.find(([,x,y,x1,y1])=>player.x/T>=x&&player.x/T<=x1+1&&player.y/T>=y&&player.y/T<=y1+1);document.querySelector('#district-name').textContent=r?.[0]||'Зелёный бульвар';}
  load();mount();daily();setInterval(daily,1000);requestAnimationFrame(tick);
  Game.dialog.addEventListener('click',e=>{if(e.target===Game.dialog||e.target.closest('[data-close]'))Game.close();});
  document.querySelector('#restart').onclick=()=>{path=[];pending=null;player=center(24,27);save();notify('Вы вернулись ко входу. Находки и открытые проходы сохранены.');};
  window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(!document.hidden)daily();});
  document.addEventListener('click',e=>{if(e.target.closest('[data-avatar-menu]'))chooseAvatar();});
  instructions();
})();
