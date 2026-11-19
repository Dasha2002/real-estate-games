'use strict';

const junctions = {
  gate:{position:[0,7.35],label:'Вход во двор',links:['cross']},
  cross:{position:[0,4.95],label:'Пешеходная дорожка',links:['gate','play','ball','path','outside']},
  play:{position:[-3.35,4.45],label:'Детская площадка',links:['cross','ball']},
  ball:{position:[-5.3,4.95],label:'Мяч у скамейки',links:['play','cross']},
  path:{position:[0,-2.7],label:'Дорожка между корпусами',links:['cross','court','bench','water','lobby']},
  court:{position:[4.3,.55],label:'Спортивная площадка',links:['path']},
  water:{position:[-2.3,-2.7],label:'Лейка у входа',links:['path','lobby']},
  bench:{position:[1.85,-1.22],label:'Пергола и цветники',links:['path']},
  outside:{position:[6.75,7.6],label:'Внешний проезд',links:['cross','garage']},
  garage:{position:[6.4,6.42],label:'Въезд в паркинг',links:['outside']},
  lobby:{position:[-5.1,-2.84],label:'Лобби',links:['water','path']}
};
const missions = [
  {title:'Первый круг',steps:[['play','Осмотреть площадку']],detail:'Площадка находится внутри двора без машин. Из калитки к ней ведёт пешеходная дорожка.'},
  {title:'Верните мяч',steps:[['ball','Подобрать мяч'],['court','Бросить мяч']],detail:'Для матчей во дворе предусмотрена отдельная спортивная площадка.'},
  {title:'Полейте цветы',steps:[['water','Взять лейку'],['bench','Полить растения']],detail:'У перголы спроектирована тихая зона отдыха с клумбами и скамейками.'},
  {title:'Найдите подземный паркинг',steps:[['outside','Осмотреть проезд'],['garage','Осмотреть рампу']],detail:'Внешний въезд в подземный паркинг не пересекает двор.'},
  {title:'Завершите прогулку в лобби',steps:[['lobby','Осмотреть лобби']],detail:'Лобби соединяет вход в корпус с пешеходными дорожками двора.'}
];
const directions = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const keys = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
const blockers = [[-5.2,-6.4,4.7,3.65],[.1,-7.15,5.6,3],[6.4,-4.8,3.35,5],[6.4,5.3,2.8,1.5],[-3.3,2.55,2.3,1.68],[0,-1.9,2.9,1.2]];
const markers = Object.keys(junctions).filter(key=>!['gate','cross','path'].includes(key)).map(key=>({key,position:[...junctions[key].position,.55]}));

const {root,action,reward,modal}=Game;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let camera,position,mission,phase,trail,frame,lastTime,held,presses,effect,cargo,status,near;

function restart() {
  camera?.destroy();
  cancelAnimationFrame(frame);
  frame=0;
  position=[...junctions.gate.position];
  mission=0;
  phase=0;
  trail=[];
  held=new Map();
  presses=new Map();
  effect=null;
  cargo=null;
  status='Коснитесь дорожки или используйте стрелки.';
  near=false;
  root.innerHTML=`<section class="world-stage" aria-label="Прогулка в 3D">
    <div class="map-frame world-frame">
      <canvas tabindex="0" aria-label="Квартал 3D. WASD или стрелки для движения, E для действия у цели. Перетаскивание поворачивает камеру."></canvas>
      ${markers.map(({key})=>action('', 'pin',key,'world-marker',`data-pin="${key}" aria-label="Идти: ${junctions[key].label}" title="${junctions[key].label}" hidden`)).join('')}
    </div>
    <div class="world-hud"><div id="world-task"></div>${action('Маршрут','journal','','world-journal')}</div>
    <div class="world-instruction" id="world-message" role="status"></div>
    <div class="world-dock">
      <div class="world-dpad" role="group" aria-label="Движение">${[['↑','up','Вперёд'],['←','left','Влево'],['↓','down','Назад'],['→','right','Вправо']].map(([symbol,key,label])=>action(symbol,'step',key,'world-control',`aria-label="${label}"`)).join('')}</div>
      <div class="world-right">
        ${action('', 'interact','','world-interact','id="world-interact" hidden')}
        <div class="world-camera" role="group" aria-label="Камера">${[
          ['↶','left','Повернуть влево'],['↷','right','Повернуть вправо'],['−','out','Отдалить'],['+','in','Приблизить']
        ].map(([symbol,key,label])=>action(symbol,'camera',key,'world-control',`aria-label="${label}" title="${label}"`)).join('')}</div>
      </div>
    </div>
  </section><p class="world-help">Стрелки или WASD — идти. E — действие у цели. Сцену можно повернуть перетаскиванием.</p>`;
  camera=HorizonScene.mount(root.querySelector('.world-frame'),{view:'world',markers,onGround:moveToGround});
  refresh();
  showWalker(false);
}

function target() { return missions[mission]?.steps[phase]; }

function refresh() {
  const current=missions[mission];
  for(const {key} of markers) {
    const pin=root.querySelector('[data-pin="'+key+'"]');
    pin.hidden=target()?.[0]!==key;
    pin.textContent=key==='ball'?'●':key==='water'?'◈':'◆';
  }
  root.querySelector('#world-task').innerHTML=current?`<p>Прогулка · ${mission+1} / ${missions.length} · ${mission*30} баллов</p><h2>${current.title}</h2><span>${junctions[target()[0]].label}</span>`:`<p>Задания · 5 / 5 · 200 баллов</p><h2>Прогулка завершена</h2>${action('Получить награду','finish')}`;
  setWorldMessage(status);
  refreshProximity();
}
function refreshProximity() {
  const next=target();
  near=Boolean(next&&distance(position,junctions[next[0]].position)<.93);
  const button=root.querySelector('#world-interact');
  button.hidden=!near;
  if(near) button.textContent=next[1];
  const pin=next&&root.querySelector('[data-pin="'+next[0]+'"]');
  pin?.classList.toggle('near',near);
}

function distance(a,b) { return Math.hypot(a[0]-b[0],a[1]-b[1]); }

function clearLine(from,to) {
  const steps=Math.max(1,Math.ceil(distance(from,to)/.18));
  for(let i=1;i<=steps;i++){
    const portion=i/steps;
    if(!passable(from[0]+(to[0]-from[0])*portion,from[1]+(to[1]-from[1])*portion))return false;
  }
  return true;
}

function gridPoint(point) {
  const rounded=point.map(value=>Math.round(value*2)/2);
  const candidates=[];
  for(const dx of [0,-.5,.5]) for(const dz of [0,-.5,.5]) {
    const cell=[rounded[0]+dx,rounded[1]+dz];
    if(passable(...cell)&&clearLine(point,cell))candidates.push(cell);
  }
  return candidates.sort((a,b)=>distance(point,a)-distance(point,b))[0];
}

function routeTo(end) {
  if(clearLine(position,end))return [end];
  const start=gridPoint(position),goal=gridPoint(end);
  if(!start||!goal)return [];
  const key=point=>point.join(',');
  const queue=[start];
  const parents=new Map([[key(start),null]]);
  for(let i=0;i<queue.length;i++){
    const cell=queue[i];
    if(key(cell)===key(goal)) {
      const nodes=[end];
      for(let cursor=cell;cursor;cursor=parents.get(key(cursor)))nodes.unshift(cursor);
      const path=[];
      let anchor=position;
      while(nodes.length){
        let index=nodes.findLastIndex(point=>clearLine(anchor,point));
        if(index<0)return [];
        anchor=nodes[index];
        path.push(anchor);
        nodes.splice(0,index+1);
      }
      return path;
    }
    for(const [dx,dz] of Object.values(directions)){
      const next=[cell[0]+dx*.5,cell[1]+dz*.5];
      if(parents.has(key(next))||!passable(...next)||!clearLine(cell,next))continue;
      parents.set(key(next),cell);
      queue.push(next);
    }
  }
  return [];
}

function passable(x,z) {
  return Math.abs(x)<8&&Math.abs(z)<8&&!blockers.some(([ox,oz,w,d])=>Math.abs(x-ox)<w/2+.25&&Math.abs(z-oz)<d/2+.25);
}

function setWorldMessage(message,retry=false) {
  status = message;
  const output = root.querySelector('#world-message');
  output.textContent = status;
  output.classList.toggle('is-retry',retry);
}

function moveToGround(x,z) {
  if(!passable(x,z)){
    setWorldMessage('Здесь нельзя пройти. Коснитесь свободной дорожки или выделенной метки.',true);
    return;
  }
  travel([x,z]);
}

function travel(destination) {
  const point=Array.isArray(destination)?destination:junctions[destination].position;
  if(distance(position,point)<.12) {refreshProximity();return;}
  trail=routeTo(point);
  if(!trail.length){
    setWorldMessage('Отсюда нет прохода. Выберите другую точку или выделенную метку.',true);
    return;
  }
  setWorldMessage('Подойдите к выделенной метке. Рядом с ней появится действие.');
  if(reduce.matches&&trail.length) {
    const end=trail.at(-1);
    if(passable(...end))position=[...end];
    trail=[];
    showWalker(false);
    refreshProximity();
    return;
  }
  wake();
}

function move(dx,dz) {
  if(passable(position[0]+dx,position[1]))position[0]+=dx;
  if(passable(position[0],position[1]+dz))position[1]+=dz;
}

function showWalker(walking,time=performance.now()) {
  camera.walk([...position],{walking:walking&&!reduce.matches,cargo,
    effect:effect?{kind:effect.kind,pct:Math.min(.999,(time-effect.started)/effect.duration)}:null});
}
function wake() {
  if(!frame){lastTime=performance.now();frame=requestAnimationFrame(tick);}
}
function tick(time) {
  frame=0;
  const dt=Math.min(.06,(time-lastTime)/1000);
  lastTime=time;
  let walking=false;
  if(held.size) {
    const vector=[...held.values()].reduce((total,key)=>total.map((value,i)=>value+directions[key][i]),[0,0]);
    const length=Math.hypot(...vector);
    if(length) {
      const [dx,dz]=camera.direction(vector[0]/length,vector[1]/length);
      move(dx*dt*5.9,dz*dt*5.9);
      walking=true;
    }
  } else if(trail.length) {
    const next=trail[0];
    const remaining=distance(position,next);
    if(remaining<Math.max(dt*5.9,.045)) {position=[...trail.shift()];}
    else {
      const before=[...position];
      move((next[0]-position[0])*dt*5.9/remaining,(next[1]-position[1])*dt*5.9/remaining);
      if(distance(before,position)<.0005)trail=[];
    }
    walking=true;
  }
  if(effect&&time-effect.started>=effect.duration)effect=null;
  refreshProximity();
  showWalker(walking,time);
  if(held.size||trail.length||effect)frame=requestAnimationFrame(tick);
}

function interact() {
  if(!near||!target())return;
  const [key]=target(),current=missions[mission];
  if(key==='ball')cargo='ball';
  if(key==='water')cargo='water';
  if(key==='court'||key==='bench') {
    cargo=null;
    if(!reduce.matches)effect={kind:key==='court'?'throw':'water',started:performance.now(),duration:680};
  }
  phase++;
  if(phase===current.steps.length) {
    mission++;
    phase=0;
    status=target()?'+30 баллов. Идите к следующей метке: '+junctions[target()[0]].label+'.':'Все поручения выполнены. Нажмите «Получить награду».';
  } else status=key==='ball'?'Мяч у вас. Дойдите до спортивной площадки.':key==='water'?'Лейка у вас. Дойдите до перголы.':'Теперь пройдите от проезда до рампы.';
  refresh();
  showWalker(false);
  root.querySelector(target()?'canvas':'[data-action="finish"]').focus({preventScroll:true});
  if(effect)wake();
}

function journal() {
  modal('Маршрут прогулки',`<div class="world-log">${missions.map((item,i)=>`<article><h3>${i<mission?'✓ ':i===mission?'◆ ':''}${item.title}</h3><p>${i<mission?item.detail:i===mission?'Сейчас: '+junctions[target()[0]].label:'Откроется позже'}</p></article>`).join('')}</div>`);
}

root.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  const button=event.target.closest('[data-action="step"]');
  const pin=event.target.closest('[data-pin]');
  if(button) {
    trail=[];
    held.set(event.pointerId,button.dataset.value);
    button.setPointerCapture(event.pointerId);
    wake();
  } else if(pin&&event.pointerType==='touch')presses.set(event.pointerId,{key:pin.dataset.pin,x:event.clientX,y:event.clientY});
});
root.addEventListener('pointerup',event=>{
  const press=presses.get(event.pointerId);
  held.delete(event.pointerId);
  presses.delete(event.pointerId);
  if(press?.key&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<10)travel(press.key);
});
root.addEventListener('pointercancel',event=>{held.delete(event.pointerId);presses.delete(event.pointerId);});
root.addEventListener('keydown',event=>{
  if(!event.target.matches('canvas'))return;
  const key=event.key.toLowerCase();
  if(key==='e'||event.code==='KeyE') {event.preventDefault(); if(!event.repeat)interact(); return;}
  const direction=keys[event.key]||keys[key]||keys[event.code.replace(/^Key/,'').toLowerCase()];
  if(!direction)return;
  event.preventDefault();
  trail=[];
  held.set(event.code,direction);
  wake();
});
root.addEventListener('keyup',event=>{held.delete(event.code);});
root.addEventListener('focusout',event=>{if(event.target.matches('canvas'))held.forEach((_,id)=>{if(typeof id==='string')held.delete(id);});});
window.addEventListener('blur',()=>held?.clear());

Game.init({restart,onAction(name,value){
  if(name==='camera')camera.control(value);
  if(name==='pin')travel(value);
  if(name==='interact')interact();
  if(name==='journal')journal();
  if(name==='step') {
    const vector=camera.direction(...directions[value]);
    move(vector[0]*.26,vector[1]*.26);
    refreshProximity();
    showWalker(false);
  }
  if(name==='finish')modal('Экскурсия завершена',reward({title:'Гость Горизонта',score:200,badge:'Виртуальный сертификат',detail:'Пять поручений выполнены. Вы осмотрели двор, зоны отдыха, паркинг и лобби.',cta:'Записаться на экскурсию'}));
}});
