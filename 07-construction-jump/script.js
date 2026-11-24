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
      <div class="jump-hud"><div><span>Этаж</span><strong id="floor-count">0</strong></div><div><span>Материалы</span><strong id="material-count">0</strong></div><div><span>Очки</span><strong id="score-count">0</strong></div><button type="button" class="jump-pause" data-action="pause" id="pause-button" aria-label="Пауза" disabled>Ⅱ</button></div>
      <div class="jump-screen"><canvas tabindex="0" aria-label="Строитель поднимается по строительным лесам. Стрелки влево и вправо или A и D управляют движением. На телефоне удерживайте кнопки под игрой."></canvas><div class="jump-overlay" id="jump-overlay"></div></div>
      <div class="jump-controls" role="group" aria-label="Управление строителем"><button class="jump-drive" data-drive="-1" type="button" aria-label="Двигаться влево">←</button><button class="jump-fire" data-action="shoot" data-shoot type="button" aria-label="Стрелять вверх. Пробел на клавиатуре.">↑ Огонь</button><button class="jump-drive" data-drive="1" type="button" aria-label="Двигаться вправо">→</button></div>
    </section>
    <p class="visually-hidden" id="jump-status" role="status" aria-live="polite"></p>

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
  if(state.phase==='ready' && typeof JumpArt!=='undefined' && !JumpArt.ready){
    const button=overlay.querySelector('[data-action="start"]');
    if(button){button.disabled=true;button.textContent='Загружаем стройку…';}
  }
}
function updateHud(force=false){
  const wind=ConstructionJump.wind(state);
  const stamp=[ConstructionJump.floors(state),state.collected,ConstructionJump.score(state),state.phase,state.tier,Math.sign(wind),state.notice].join(':');
  if(!force&&stamp===lastHud)return;lastHud=stamp;
  const floors=ConstructionJump.floors(state);
  root.querySelector('#floor-count').textContent=floors;
  root.querySelector('#material-count').textContent=state.collected;
  root.querySelector('#score-count').textContent=ConstructionJump.score(state);
  const pause=root.querySelector('#pause-button');pause.disabled=state.phase!=='running'&&state.phase!=='paused';
  pause.textContent=state.phase==='paused'?'▶':'Ⅱ';
  pause.setAttribute('aria-label',state.phase==='paused'?'Продолжить':'Пауза');
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
  if(typeof JumpArt!=='undefined' && !JumpArt.ready)return;
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
if(typeof JumpArt!=='undefined')JumpArt.preload().then(()=>{
  if(state.phase==='ready'){resizeCanvas();showOverlay();}
});
