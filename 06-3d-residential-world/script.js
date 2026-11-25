'use strict';

const {root,action}=Game;
let state,scene,frame=0,lastTime=0,lastHud=-1,chosen='easy',target=null,announced=-1,rotated=false;
const keys=new Set(),pointers=new Map(),fieldTaps=new Map();
let lastTouchSubmit=-Infinity;
const keyDirections={ArrowLeft:-1,ArrowRight:1,KeyA:-1,KeyD:1};
const keyLanes={ArrowUp:'blue',KeyW:'blue',ArrowDown:'brown',KeyS:'brown'};
function plural(n,one,few,many){const a=n%100,b=n%10;return a>=11&&a<=14?many:b===1?one:b>=2&&b<=4?few:many;}

function record(level){try{return Math.max(0,Math.min(48,Number(localStorage.getItem('horizon-build-stack-v1-'+level))||0));}catch{return 0;}}
function saveRecord(){try{localStorage.setItem('horizon-build-stack-v1-'+state.level,String(Math.max(record(state.level),state.lit)));}catch{}}
function updateDriveButtons(){
  for(const button of root.querySelectorAll('[data-drive]'))button.classList.toggle('is-held',[...pointers.values()].includes(Number(button.dataset.drive)));
}
function stopInput(){keys.clear();pointers.clear();fieldTaps.clear();target=null;updateDriveButtons();}
function stopFrame(){if(frame)cancelAnimationFrame(frame);frame=0;lastTime=0;}
function syncOrientation(){
  rotated=(state.phase==='running'||state.phase==='paused')&&matchMedia('(orientation: portrait)').matches&&
    (matchMedia('(pointer: coarse)').matches||matchMedia('(max-width: 600px)').matches);
  root.querySelector('.movein').classList.toggle('is-rotated',rotated);
}

function restart(){
  stopFrame();stopInput();scene?.destroy();state=MoveInArcade.create(chosen);lastHud=-1;announced=-1;
  root.innerHTML=`<section class="movein" aria-label="Стройсборка">
    <div class="arcade-topline"><div><p class="eyebrow">Два плана. Один пикап.</p><h2>Ловите материалы — стройте новый дом</h2></div><p class="round-rule">1 окно = 1 балл<br><span>Каждый раунд — 90 секунд</span></p></div>
    <div class="arcade-levels" role="group" aria-label="Сложность">${Object.entries(MoveInArcade.levels).map(([key,level])=>action(`<strong>${level.title}</strong><span>${level.description}</span>`,'difficulty',key,'difficulty-card',`aria-label="${level.title}. ${level.description}" aria-pressed="${key===chosen}"`)).join('')}</div>
    <div class="arcade-hud" aria-label="Состояние игры"><div><span>Осталось</span><strong id="time-left">1:30</strong></div><div><span>Коробки</span><strong id="lit-count">0</strong></div><div><span>Груз в кузове</span><strong id="cargo-count">0</strong></div><div><span id="record-label">Рекорд · ${MoveInArcade.levels[chosen].title}</span><strong id="record-count">${record(chosen)} <small>окон</small></strong></div>${action('Пауза','pause','','quiet','id="pause-game" disabled aria-label="Поставить игру на паузу"')}</div>
    <div class="construction-progress"><span>Сдано: <strong id="materials-count">0</strong> ед.</span><strong id="stack-multiplier">Груз ×1</strong><span id="next-window">До окна: 1000 ед.</span><progress id="build-progress" max="1000" value="0" aria-label="Материалы для следующего окна"></progress></div>
    <div class="arcade-stage"><canvas class="arcade-canvas" tabindex="0" aria-label="Пикап на двух планах. Влево и вправо — движение. Вверх — синий дальний план, вниз — жёлтый ближний. Пробел — сдать стопку на стройку."></canvas><div class="arcade-overlay" id="arcade-overlay"></div></div>
    <div class="arcade-controls" aria-label="Управление пикапом"><div class="drive-controls" role="group" aria-label="Двигаться влево и вправо"><button type="button" class="drive-button" data-drive="-1" aria-label="Двигаться влево">←</button><button type="button" class="drive-button" data-drive="1" aria-label="Двигаться вправо">→</button></div>${action('На стройку · Пробел','submit','','btn submit-stack','id="submit-stack"')}<div class="lane-controls" role="group" aria-label="Переключить дорожку">${action('<span aria-hidden="true">↑</span><span class="lane-label"> Дальняя</span>','lane','blue','lane-button blue','aria-pressed="false" aria-label="Перейти на дальнюю синюю дорожку"')}${action('<span aria-hidden="true">↓</span><span class="lane-label"> Ближняя</span>','lane','brown','lane-button brown','aria-pressed="true" aria-label="Перейти на ближнюю жёлтую дорожку"')}</div></div>
    <div class="arcade-notice" id="arcade-notice" role="status" aria-live="polite"></div><div id="arcade-result" hidden></div>
    <details class="arcade-rules"><summary>Правила: планы, стопки и опасности</summary><div class="rule-grid"><p><strong>1. Совпадите с цветом</strong>← / → или A / D — движение. ↑ / W — дальний синий план, ↓ / S — ближний коричневый. Грузы ловятся только на своём плане. Оба цвета падают с одной высоты и с одной скоростью. На телефоне есть кнопки планов.</p><p><strong>2. Сдавайте стопку</strong>Тап по полю, пробел или «На стройку» мгновенно сдаёт все материалы из любой точки. Блок — 100, панель — 150, уголок — 200 ед. В кузове максимум 12 коробок: блок занимает 1 ячейку, панель — 2, уголок — 3. Если свободных ячеек меньше, из связки загружается только то количество коробок, которое помещается. Остальные продолжают падать; стоимость начисляется пропорционально загруженной части. За 1–3 коробки множитель ×1, за 4–6 — ×2, за 7–12 — ×3. Полный кузов не принимает новые грузы: сдайте их пробелом. Несданные материалы в конце не засчитываются.</p><p><strong>3. Стройте и уклоняйтесь</strong>Каждые 1000 ед. зажигают окно: это один итоговый балл. На второй и третьей сложности после 12 секунд падают опасные баллоны: касание сбивает стопку и ненадолго останавливает пикап. Готовые окна не гаснут.</p></div></details>
  </section>`;
  scene=MoveInScene.mount(root.querySelector('canvas'),()=>state);showOverlay();updateHud(true);scene.draw(state);
}
function showOverlay(){
  root.querySelector('.movein').classList.toggle('is-live',state.phase!=='ready');
  root.querySelector('.movein').classList.toggle('is-playing',state.phase==='running'||state.phase==='paused');
  syncOrientation();
  const overlay=root.querySelector('#arcade-overlay');overlay.hidden=state.phase==='running'||state.phase==='finished';
  if(state.phase==='ready')overlay.innerHTML=`<div class="start-card"><span class="arcade-kicker">Стройсборка</span><h3>Загрузите пикап —<br>постройте дом</h3><p>Подставляйте пикап под синие грузы на дальнем плане и коричневые — на ближнем. Кузов вмещает 12 коробок. <span class="keyboard-help">Пробел сдаёт весь груз.</span><span class="touch-help">Удерживайте ← → для движения. Кнопки ↑ и ↓ по центру меняют дорожку. Тап по свободной области экрана сдаёт груз.</span></p><div class="parcel-legend"><span><i class="parcel-dot blue" aria-hidden="true"></i>↑ Дальний план</span><span><i class="parcel-dot brown" aria-hidden="true"></i>↓ Ближний план</span></div>${action('Начать 90 секунд','start','','btn start-round')}<small>${MoveInArcade.levels[chosen].title} · Пробел — сдать · Esc — пауза</small></div>`;
  if(state.phase==='paused')overlay.innerHTML=`<div class="start-card pause-card"><span class="arcade-kicker">Таймер остановлен</span><h3>Пауза на стройке</h3><p>Все материалы и готовые окна сохранены.</p>${action('Продолжить','resume','','btn')}</div>`;
}
function updateHud(force=false){
  const stamp=Math.floor(state.elapsed*8);if(!force&&stamp===lastHud)return;lastHud=stamp;
  const left=Math.max(0,Math.ceil(90-state.elapsed)),count=MoveInArcade.cargoCount(state),factor=MoveInArcade.multiplier(state);
  root.querySelector('#time-left').textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
  root.querySelector('#time-left').classList.toggle('last-seconds',left<=15&&state.phase!=='ready');
  root.querySelector('#lit-count').textContent=state.lit;
  root.querySelector('#cargo-count').textContent=count;
  root.querySelector('#cargo-count').classList.toggle('is-full',count===MoveInArcade.capacity);
  root.querySelector('#materials-count').textContent=state.materials.toLocaleString('ru-RU');
  root.querySelector('#stack-multiplier').textContent='Груз ×'+factor;
  root.querySelector('#stack-multiplier').classList.toggle('bonus-active',factor>1);
  root.querySelector('#next-window').textContent=state.lit===48?'Дом готов!':'До окна: '+(1000-state.materials%1000)+' ед.';
  root.querySelector('#build-progress').value=state.lit===48?1000:state.materials%1000;
  root.querySelector('#pause-game').disabled=state.phase!=='running'&&state.phase!=='paused';
  root.querySelector('#pause-game').textContent=state.phase==='paused'?'Продолжить':'Пауза';
  for(const button of root.querySelectorAll('[data-action="difficulty"]'))button.disabled=state.phase!=='ready'&&state.phase!=='finished';
  for(const button of root.querySelectorAll('[data-action="lane"],[data-drive]'))button.disabled=state.phase!=='running';
  for(const button of root.querySelectorAll('[data-action="lane"]'))button.setAttribute('aria-pressed',button.dataset.value===state.lane);
  root.querySelector('#submit-stack').disabled=state.phase!=='running'||!state.cargo.length||state.elapsed<state.stunnedUntil;
  root.querySelector('#submit-stack').textContent='На стройку · '+(count?'×'+factor:'Пробел');
  if(force||announced!==state.notice.id){root.querySelector('#arcade-notice').textContent=state.notice.text;announced=state.notice.id;}
}
function begin(){
  if(state.phase!=='ready')return;
  stopInput();MoveInArcade.start(state);lastTime=performance.now();showOverlay();updateHud(true);
  root.querySelector('canvas').focus({preventScroll:true});frame=requestAnimationFrame(tick);
  root.querySelector('.arcade-hud').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
function pause(){
  if(state.phase!=='running')return;
  MoveInArcade.pause(state);stopFrame();stopInput();state.moving=0;showOverlay();updateHud(true);scene.draw(state);
  root.querySelector('[data-action="resume"]').focus({preventScroll:true});
}
function resume(){
  if(state.phase!=='paused')return;
  MoveInArcade.resume(state);lastTime=performance.now();showOverlay();updateHud(true);
  root.querySelector('canvas').focus({preventScroll:true});frame=requestAnimationFrame(tick);
}
function tick(time){
  frame=0;if(state.phase!=='running')return;
  const direction=[...keys].reduce((n,key)=>n+(keyDirections[key]||0),0)+[...pointers.values()].reduce((a,b)=>a+b,0);
  MoveInArcade.advance(state,Math.max(0,(time-lastTime)/1000),{direction,target});lastTime=time;scene.draw(state);updateHud();
  if(state.phase==='finished'){finish();return;}frame=requestAnimationFrame(tick);
}
function finish(){
  stopFrame();stopInput();saveRecord();showOverlay();updateHud(true);
  root.querySelector('#record-count').innerHTML=record(state.level)+' <small>'+plural(record(state.level),'окно','окна','окон')+'</small>';
  const panel=root.querySelector('#arcade-result');panel.hidden=false;
  panel.innerHTML=`<section class="arcade-result" aria-label="Результат раунда"><div><p class="eyebrow">90 секунд · ${MoveInArcade.levels[state.level].title}</p><h3>Зажжено окон: <span>${state.lit}</span> / 48</h3><p class="result-score">${state.lit} ${plural(state.lit,'балл','балла','баллов')} — по одному за каждое окно.</p><p>На стройку сдано ${state.materials.toLocaleString('ru-RU')} ед. материалов. Отправлено коробок: ${state.submitted}. Потерянных стопок: ${state.crashes}. Несданных коробок: ${MoveInArcade.cargoCount(state)}.</p></div><div class="result-actions">${action('Ещё одна смена','again','','btn')}${action('Выбрать сложность','pick-level','','btn secondary')}${action('Посмотреть квартиры в Горизонте','lead','Посмотреть квартиры в Горизонте','quiet')}</div></section>`;
  root.querySelector('#arcade-notice').textContent='Стройка завершена! Зажжено окон: '+state.lit+'. Результат: '+state.lit+' '+plural(state.lit,'балл','балла','баллов')+'.';
  panel.setAttribute('tabindex','-1');panel.focus({preventScroll:true});
}
function changeLane(lane){
  if(MoveInArcade.switchLane(state,lane)){updateHud(true);scene.draw(state);}
}
function submit(){if(MoveInArcade.submit(state)){updateHud(true);scene.draw(state);}}
function pointerTarget(event,chooseLane=false){
  const canvas=root.querySelector('canvas'),rect=canvas.getBoundingClientRect();
  const x=rotated?(event.clientY-rect.top)*canvas.clientWidth/rect.height:(event.clientX-rect.left)*canvas.clientWidth/rect.width;
  const y=rotated?(rect.right-event.clientX)*canvas.clientHeight/rect.width:(event.clientY-rect.top)*canvas.clientHeight/rect.height;
  const pick=scene.targetAt(x,y,chooseLane);
  target=pick.target;
  if(chooseLane&&pick.lane!==state.lane)changeLane(pick.lane);
}
root.addEventListener('pointerdown',event=>{
  if(state.phase!=='running'||event.button!==0)return;
  const drive=event.target.closest('[data-drive]');
  if(drive){event.preventDefault();target=null;pointers.set(event.pointerId,Number(drive.dataset.drive));drive.setPointerCapture(event.pointerId);updateDriveButtons();return;}
  const lane=event.target.closest('[data-action="lane"]');
  if(lane){event.preventDefault();changeLane(lane.dataset.value);return;}
  if((event.pointerType==='touch'||event.pointerType==='pen')&&!event.target.closest('button,a,input,select,textarea,summary,[role="button"]')){
    fieldTaps.set(event.pointerId,{x:event.clientX,y:event.clientY,at:performance.now()});
    root.setPointerCapture?.(event.pointerId);
  }
});
root.addEventListener('pointermove',event=>{
  if(state.phase==='running'&&event.target.matches('canvas')&&event.pointerType==='mouse')pointerTarget(event,false);
});
root.addEventListener('click',event=>{
  if(event.pointerType==='touch'||event.pointerType==='pen'||performance.now()-lastTouchSubmit<600)return;
  if(state.phase!=='running'||event.target.closest('button,a,input,select,textarea,summary,[role="button"]'))return;
  submit();
});
function releasePointer(event){
  const tap=fieldTaps.get(event.pointerId);fieldTaps.delete(event.pointerId);
  if(tap&&event.type==='pointerup'&&state.phase==='running'&&performance.now()-tap.at<500&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<=12){
    lastTouchSubmit=performance.now();submit();
  }
  pointers.delete(event.pointerId);updateDriveButtons();if(event.type==='pointercancel'&&event.target.matches('canvas'))target=null;
}
root.addEventListener('pointerup',releasePointer);
root.addEventListener('pointercancel',releasePointer);
root.addEventListener('lostpointercapture',releasePointer);
document.addEventListener('keydown',event=>{
  if(event.target.closest('input,textarea,select,[contenteditable]')||Game.dialog.open)return;
  if(state.phase==='running'){
    if(keyDirections[event.code]){event.preventDefault();target=null;keys.add(event.code);}
    if(keyLanes[event.code]){event.preventDefault();if(!event.repeat)changeLane(keyLanes[event.code]);}
    if(event.code==='Space'){event.preventDefault();if(!event.repeat)submit();}
  }
  if((event.key==='Escape'||event.code==='KeyP')&&!event.repeat&&(state.phase==='running'||state.phase==='paused')){
    event.preventDefault();state.phase==='running'?pause():resume();
  }
});
document.addEventListener('keyup',event=>keys.delete(event.code));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
window.addEventListener('resize',()=>{stopInput();syncOrientation();scene.draw(state);});
Game.init({restart,onAction(name,value){
  if(name==='difficulty'&&MoveInArcade.levels[value]&&(state.phase==='ready'||state.phase==='finished')){chosen=value;restart();}
  if(name==='start')begin();if(name==='pause')state.phase==='running'?pause():resume();if(name==='resume')resume();
  if(name==='again'){restart();begin();}
  if(name==='pick-level'){restart();root.querySelector('[data-action="difficulty"][aria-pressed="true"]').focus({preventScroll:true});}
  if(name==='lane')changeLane(value);if(name==='submit')submit();
}});
