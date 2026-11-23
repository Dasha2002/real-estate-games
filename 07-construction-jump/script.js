'use strict';

const {root,action}=Game;
const keyDirection={ArrowLeft:-1,ArrowRight:1,KeyA:-1,KeyD:1};
const heldKeys=new Set(),heldPointers=new Map(),shootPointers=new Set();
let state,frame=0,lastTime=0,lastHud='',best=readBest(),endingAt=-1,dimming=false;

function readBest(){
  try{return Math.max(0,Number(localStorage.getItem('horizon-construction-jump-v1'))||0);}
  catch{return 0;}
}
function saveBest(){
  best=Math.max(best,ConstructionJump.score(state));
  try{localStorage.setItem('horizon-construction-jump-v1',String(best));}catch{}
}
function stopFrame(){if(frame)cancelAnimationFrame(frame);frame=0;lastTime=0;endingAt=-1;dimming=false;}
function clearInput(){heldKeys.clear();heldPointers.clear();shootPointers.clear();}
function resizeCanvas(){
  const canvas=root.querySelector('canvas');if(!canvas)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(ConstructionJump.width*dpr);canvas.height=Math.round(ConstructionJump.height*dpr);
  canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
  ConstructionScene.draw(canvas,state);
}
function restart(){
  stopFrame();clearInput();state=ConstructionJump.create();lastHud='';
  root.innerHTML=`<div class="jump-layout">
    <section class="jump-card" aria-label="На высоту">
      <div class="jump-hud"><div><span>Этаж</span><strong id="floor-count">0</strong></div><div><span>Материалы</span><strong id="material-count">0</strong></div><div><span>Очки</span><strong id="score-count">0</strong></div></div>
      <div class="jump-screen"><canvas tabindex="0" aria-label="Бесконечный подъём по строительным лесам. Стрелки влево и вправо или A и D управляют движением. На телефоне удерживайте кнопки под игрой."></canvas><div class="jump-overlay" id="jump-overlay"></div></div>
      <div class="jump-controls" role="group" aria-label="Управление строителем"><button class="jump-drive" data-drive="-1" type="button" aria-label="Двигаться влево">←</button><button class="jump-fire" data-action="shoot" data-shoot type="button" aria-label="Стрелять вверх. Пробел на клавиатуре.">↑ Огонь</button><button class="jump-drive" data-drive="1" type="button" aria-label="Двигаться вправо">→</button></div>
    </section>
    <aside class="panel jump-side stack"><div><p class="eyebrow">Бесконечная стройка</p><h2>Как высоко вы подниметесь?</h2><p>Строитель прыгает сам. Направляйте его на леса, собирайте кирпичи и стройте этаж за этажом. Чем выше вы поднимаетесь, тем сложнее маршрут.</p></div>
      <div class="jump-progress"><div class="stats"><span>До следующего этажа</span><strong id="height-label">0%</strong></div><progress id="height-progress" max="100" value="0" aria-label="Прогресс до следующего этажа"></progress></div>
      <div class="jump-record"><span>Ваш рекорд</span><strong id="best-score">${best} очков</strong></div>
      <div class="jump-difficulty"><span>Этап</span><strong id="difficulty-label">Разминка</strong><span id="wind-label">Штиль</span></div>
      <div class="jump-rules"><h3>Как играть</h3><p><strong>← →</strong> или <strong>A D</strong> — движение. На телефоне удерживайте кнопки или касайтесь левой и правой половины экрана.</p><p><strong>Голубые леса</strong> двигаются, <strong>треснувшие</strong> ломаются, а площадка с пружиной даёт высоту прыжка ×2,25.</p><p><strong>Коснитесь буста:</strong> каска с пропеллером, джетпак или крюк крана автоматически поднимут вас. Во время подъёма можно двигаться в стороны.</p><p>Ветер сносит по стрелкам. После <strong>50-го этажа</strong> встречаются маршруты через край экрана: уходите за край и появляйтесь на другой стороне. После <strong>100-го этажа</strong> остаются только быстрые движущиеся платформы, а переходы между краями встречаются чаще. За кирпич — 15 очков. <strong>P / Esc</strong> — пауза.</p></div>
      <p class="jump-combat-rule"><strong>Подвешенный груз:</strong> столкновение сбоку или снизу завершает игру. Прыгните сверху для пружинного отскока или разрушьте его выстрелом. Во время любого буста вы неуязвимы к грузам. <strong>Пробел / «↑ Огонь»</strong> — стрелять вверх; можно удерживать.</p>
      ${action('Пауза','pause','','quiet jump-pause','id="pause-button" disabled')}<p class="jump-status" id="jump-status" role="status" aria-live="polite"></p>
    </aside>
  </div>`;
  resizeCanvas();showOverlay();updateHud(true);
}
function showOverlay(){
  const overlay=root.querySelector('#jump-overlay');overlay.hidden=state.phase==='running';
  overlay.classList.remove('is-ending','is-result');
  if(state.phase==='failed')overlay.classList.add('is-result');
  if(state.phase==='ready')overlay.innerHTML=`<div class="jump-dialog"><span class="jump-kicker">Бесконечная стройка</span><h2>Выше и выше</h2><p>Прыгайте по лесам и собирайте материалы. С каждым этажом путь становится сложнее.</p>${action('Начать подъём','start','','btn')}<small>Стрелки / A D · на телефоне — кнопки или касание экрана</small></div>`;
  if(state.phase==='paused')overlay.innerHTML=`<div class="jump-dialog"><span class="jump-kicker">Пауза</span><h2>Передышка на лесах</h2><p>Высота и собранные материалы сохранены.</p>${action('Продолжить','resume','','btn')}</div>`;
  if(state.phase==='failed')overlay.innerHTML=`<div class="jump-dialog result"><span class="jump-kicker">Попытка завершена</span><h2>${ConstructionJump.floors(state)} этажей!</h2><p class="jump-result-score">${ConstructionJump.score(state)} очков</p><p>${state.notice}</p><p>${state.collected} материалов · грузов: ${state.destroyed}</p><p>Рекорд: ${best} очков</p>${action('Подняться ещё выше','restart','','btn')}</div>`;
}
function updateHud(force=false){
  const wind=ConstructionJump.wind(state);
  const stamp=[ConstructionJump.floors(state),state.collected,ConstructionJump.score(state),state.phase,state.tier,Math.sign(wind),state.notice].join(':');
  if(!force&&stamp===lastHud)return;lastHud=stamp;
  const floors=ConstructionJump.floors(state),fraction=(state.maxHeight-ConstructionJump.base)%ConstructionJump.floorHeight;
  root.querySelector('#floor-count').textContent=floors;
  root.querySelector('#material-count').textContent=state.collected;
  root.querySelector('#score-count').textContent=ConstructionJump.score(state);
  root.querySelector('#height-label').textContent=`${Math.round(fraction/ConstructionJump.floorHeight*100)}%`;
  root.querySelector('#height-progress').value=Math.round(fraction/ConstructionJump.floorHeight*100);
  root.querySelector('#best-score').textContent=`${best} очков`;
  root.querySelector('#difficulty-label').textContent=ConstructionJump.tiers[state.tier].name;
  root.querySelector('#wind-label').textContent=wind?`Ветер ${wind>0?'→':'←'}`:'Штиль';
  const pause=root.querySelector('#pause-button');pause.disabled=state.phase!=='running'&&state.phase!=='paused';
  pause.textContent=state.phase==='paused'?'Продолжить':'Пауза';
  root.querySelector('[data-shoot]').disabled=state.phase!=='running';
  root.querySelector('#jump-status').textContent=state.notice;
}
function direction(){
  const keyboard=[...heldKeys].reduce((value,key)=>value+(keyDirection[key]||0),0);
  const touch=[...heldPointers.values()].reduce((value,next)=>value+next,0);
  return Math.sign(keyboard+touch);
}
function start(){
  if(state.phase!=='ready')return;
  ConstructionJump.start(state);showOverlay();updateHud(true);
  root.querySelector('canvas').focus({preventScroll:true});lastTime=performance.now();frame=requestAnimationFrame(tick);
}
function pause(){
  if(state.phase!=='running')return;
  ConstructionJump.pause(state);stopFrame();clearInput();showOverlay();updateHud(true);
  root.querySelector('[data-action="resume"]').focus({preventScroll:true});
}
function resume(){
  if(state.phase!=='paused')return;
  ConstructionJump.resume(state);showOverlay();updateHud(true);
  root.querySelector('canvas').focus({preventScroll:true});lastTime=performance.now();frame=requestAnimationFrame(tick);
}
function tick(time){
  frame=0;if(state.phase!=='running')return;
  if(heldKeys.has('Space') || shootPointers.size)ConstructionJump.shoot(state);
  ConstructionJump.advance(state,(time-lastTime)/1000,direction());lastTime=time;
  ConstructionScene.draw(root.querySelector('canvas'),state);updateHud();
  if(state.phase==='failed'){
    clearInput();saveBest();updateHud(true);endingAt=time;
    frame=requestAnimationFrame(finishTransition);return;
  }
  frame=requestAnimationFrame(tick);
}

function finishTransition(time){
  frame=0;if(state.phase!=='failed' || endingAt<0)return;
  const elapsed=time-endingAt;
  if(elapsed>=720){
    endingAt=-1;showOverlay();
    root.querySelector('.jump-dialog .btn').focus({preventScroll:true});return;
  }
  if(elapsed>=180 && !dimming){
    const overlay=root.querySelector('#jump-overlay');
    overlay.innerHTML='';overlay.hidden=false;overlay.classList.add('is-ending');dimming=true;
  }
  frame=requestAnimationFrame(finishTransition);
}

Game.init({restart,onAction(name){
  if(name==='start')start();
  if(name==='pause')state.phase==='paused'?resume():pause();
  if(name==='resume')resume();
  if(name==='shoot')ConstructionJump.shoot(state);
}});
root.addEventListener('pointerdown',event=>{
  if(state.phase!=='running')return;
  const fire=event.target.closest('[data-shoot]');
  if(fire){event.preventDefault();shootPointers.add(event.pointerId);fire.setPointerCapture(event.pointerId);ConstructionJump.shoot(state);return;}
  const button=event.target.closest('[data-drive]'),canvas=event.target.closest('canvas');
  if(!button&&!canvas)return;
  event.preventDefault();
  const value=button?Number(button.dataset.drive):(event.clientX-canvas.getBoundingClientRect().left)<canvas.getBoundingClientRect().width/2?-1:1;
  heldPointers.set(event.pointerId,value);event.target.setPointerCapture(event.pointerId);
});
root.addEventListener('pointermove',event=>{
  if(!heldPointers.has(event.pointerId)||event.target.tagName!=='CANVAS')return;
  const rect=event.target.getBoundingClientRect();
  heldPointers.set(event.pointerId,event.clientX-rect.left<rect.width/2?-1:1);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,event=>{heldPointers.delete(event.pointerId);shootPointers.delete(event.pointerId);});
window.addEventListener('keydown',event=>{
  if(state.phase==='running' && event.code==='Space'){event.preventDefault();heldKeys.add('Space');ConstructionJump.shoot(state);}
  if(state.phase==='running'&&keyDirection[event.code]){event.preventDefault();heldKeys.add(event.code);}
  if((event.code==='KeyP'||event.code==='Escape')&&(state.phase==='running'||state.phase==='paused')){
    event.preventDefault();state.phase==='running'?pause():resume();
  }
});
window.addEventListener('keyup',event=>heldKeys.delete(event.code));
window.addEventListener('blur',()=>{if(state.phase==='running')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='running')pause();});
window.addEventListener('resize',resizeCanvas);
