'use strict';

const {root,action,reward,modal} = Game;
const {pieces,colors,fits,floorPlan} = ApartmentRoom;
const {plans} = ApartmentPlans;
function pieceType(id){return typeof id==='string'?id.split('#')[0]:id;}
function pieceFor(id){return pieces[pieceType(id)];}
function nextInstance(type,ignore=null){
  let id=type,n=2;
  while(state.placed[id]&&id!==ignore)id=type+'#'+n++;
  return id;
}
function chooseNew(type){
  const id=nextInstance(type);state.rotations[id]=0;choose(id);
}
const icons = {
  sofa:'M5 15V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M3 14v5m18-5v5M3 16h18M3 13h3v3m15-3h-3v3',
  bed:'M3 19V6m18 13v-7M3 16h18M7 11V8h6v3m-10 0h16a2 2 0 0 1 2 2v3',
  desk:'M3 12h18M5 12v8m14-8v8M8 10V5h8v5H8m4 0v2',
  table:'M5 8h14v4H5zm2 4v8m10-8v8M2 8h20',
  plant:'M9 14h6l-1 6h-4l-1-6zm3 0v-4m0 0C6 9 6 5 5 4c3 0 6 2 7 6zm0 0c2-5 5-6 7-6-1 4-4 6-7 6z',
  storage:'M5 3h14v18H5zm7 0v18m-3-10v3m6-3v3',
  shelf:'M5 3h14v18H5zm0 6h14M5 15h14M8 4v4m3-4v4m4 2v4m-7 2v4',
  curtain:'M3 4h18M5 5v15l4-3V5m6 0v12l4 3V5M9 17h6',
  tvStand:'M5 3h14v10H5zm7 10v3M3 16h18v5H3zm5 1v3m8-3v3',
  rug:'M3 5h18v14H3zm9 2 6 5-6 5-6-5 6-5M5 2v3m4-3v3m6-3v3m4-3v3M5 19v3m4-3v3m6-3v3m4-3v3'
};
const order = Object.keys(pieces);
const groups=['Вся мебель',...new Set(order.map(key=>pieceFor(key).group))];
let scene, state, selected, status, gesture, suppressPieceClick, group, selectionMode=null, contextTarget=null, dismissedMenu=false;
const walkKeys=new Map(),walkPointers=new Map();
let walkFrame=0,lastWalkTime=0,lookDenied=false,releasedLookContext=false;
const walkDirections={KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right',ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};

function releaseLook(){
  if(document.pointerLockElement===root.querySelector('.room-canvas'))document.exitPointerLock?.();
}
function acquireLook(){
  const canvas=root.querySelector('.room-canvas');
  if(!state.walking||Game.dialog.open||!canvas?.requestPointerLock||document.pointerLockElement===canvas)return;
  canvas.focus?.({preventScroll:true});
  lookDenied=false;
  try{canvas.requestPointerLock()?.catch(()=>{lookDenied=true;});}catch{lookDenied=true;}
}
document.addEventListener('pointerlockerror',()=>{lookDenied=true;});
document.addEventListener('mousemove',event=>{
  if(!state?.walking||Game.dialog.open||document.pointerLockElement!==root.querySelector('.room-canvas'))return;
  scene.rotate(-(event.movementX||0)*.0025,(event.movementY||0)*.0025);
  updateCarryPreview();
});
document.addEventListener('pointerlockchange',()=>{
  clearWalkInput();gesture=null;state.hovered=null;
  root.querySelector('.room-viewport')?.classList.toggle('is-looking',Boolean(document.pointerLockElement));
  scene?.schedule();
});

function clearWalkInput(){
  walkKeys.clear();walkPointers.clear();lastWalkTime=0;
  if(state?.walker){state.walker.phase=0;scene?.schedule();}
  if(walkFrame)cancelAnimationFrame(walkFrame);
  walkFrame=0;
}
function walkTick(time){
  walkFrame=0;
  if(!state.walking||Game.dialog.open||document.hidden||root.querySelector('.furniture-context')){clearWalkInput();return;}
  const held=new Set([...walkKeys.values(),...walkPointers.values()]);
  const dt=lastWalkTime?Math.min((time-lastWalkTime)/1000,.05):1/60;
  lastWalkTime=time;
  if(ApartmentNavigation.move(state,Number(held.has('right'))-Number(held.has('left')),Number(held.has('up'))-Number(held.has('down')),scene.walkAngle(),dt)){updateCarryPreview();scene.schedule();}
  if(held.size)walkFrame=requestAnimationFrame(walkTick);
  else{lastWalkTime=0;if(state.walker){state.walker.phase=0;scene.schedule();}}
}
function startWalkInput(){if(!walkFrame)walkFrame=requestAnimationFrame(walkTick);}
function selectNearby(x,y){
  const key=scene.hit(x,y);
  if(!key||!state.placed[key])return false;
  if(!ApartmentNavigation.canReach(key,state)){
    status='Подойдите ближе к предмету, чтобы выбрать его.';refresh();return false;
  }
  choose(key);startCarry();return true;
}
function updateCarryPreview(){
  if(!state.walking||!state.carrying||!state.walker)return;
  const canvas=root.querySelector('.room-canvas'),rect=canvas.getBoundingClientRect(),p=state.walker.position;
  let target=scene.pixelToFloor(rect.width*.5,rect.height*.48);
  if(!target){const angle=scene.walkAngle();target=[p[0]-Math.sin(angle)*2.2,p[1]-Math.cos(angle)*2.2];}
  const distance=Math.hypot(target[0]-p[0],target[1]-p[1]);
  if(distance>3)target=target.map((v,i)=>p[i]+(v-p[i])*3/distance);
  const point=ApartmentRoom.snapPoint?.(state.carrying,target,state)||target;
  state.ghost={key:state.carrying,point};state.suggestion=null;scene.schedule();
}
function startCarry(){
  if(!state.walking||!selected||!state.placed[selected]||state.carrying===selected)return;
  state.carryOrigin={key:selected,rotation:state.rotations[selected]};
  state.carrying=selected;selectionMode='edit';state.active=selected;
  updateCarryPreview();
  status='Перенос «'+pieceFor(selected).title+'». WASD — идти, мышь — осмотр, R — поворот, ЛКМ / Enter — поставить. Красная область означает, что здесь предмет не помещается.';
  refresh();acquireLook();
}
function cancelCarry(){
  const key=state.carrying,origin=state.carryOrigin;
  if(key&&state.placed[key]&&origin?.key===key){
    if(origin.rotation===undefined)delete state.rotations[key];
    else state.rotations[key]=origin.rotation;
  }
  state.carrying=null;state.carryOrigin=null;
  if(key)ApartmentNavigation.recover?.(state);
}
function setWalking(enabled){
  if(!enabled){releaseLook();cancelCarry();}
  clearWalkInput();closeContext();gesture=null;
  if(selectionMode==='edit')state.ghost=null;
  state.carrying=null;
  state.walking=enabled;
  if(enabled&&!ApartmentNavigation.spawn(state)){
    state.walking=false;status='Нет свободного места для персонажа. Уберите или передвиньте мебель.';refresh();return;
  }
  scene.setWalk(state.walking);
  if(!state.walking)scene.setView(false);
  status=state.walking?'WASD / стрелки — идти, мышь — осмотр. ЛКМ по ближайшей мебели — взять, следующий ЛКМ — поставить. R — поворот, Delete — удалить. ПКМ / Esc — курсор.':'Вы вернулись к конструктору. Вся расстановка сохранена.';
  refresh();
  if(enabled)acquireLook();
}
document.addEventListener('keyup',event=>{walkKeys.delete(event.code||event.key);});
document.addEventListener('visibilitychange',clearWalkInput);
globalThis.addEventListener?.('blur',clearWalkInput);

function closeContext(){
  root.querySelector('.furniture-context')?.remove();
  contextTarget=null;
}

function freeCursor(){
  closeContext();selectPiece(null);gesture=null;
  status='Курсор свободен. Наведите на мебель, чтобы выделить её, или выберите новый предмет.';
  refresh();
}

function deletePiece(key){
  if(!state.placed[key])return;
  delete state.placed[key];delete state.rotations[key];
  freeCursor();status='Предмет удалён из квартиры.';refresh();
}

function replacePiece(key){
  const old=contextTarget;
  if(!old||!state.placed[old]||!pieceFor(key))return;
  key=nextInstance(pieceType(key),old);
  const point=[...state.placed[old]];
  const trial={...state,placed:{...state.placed},rotations:{...state.rotations,[key]:state.rotations[old]||0}};
  delete trial.placed[old];
  if(!fits(key,point,trial)){
    status='Новый предмет здесь не помещается. Выберите меньший вариант или сначала передвиньте мебель.';
    refresh();return;
  }
  delete state.placed[old];delete state.rotations[old];
  state.placed[key]=point;state.rotations[key]=trial.rotations[key];
  closeContext();selectPiece(key,'edit');status='Предмет заменён. Можно передвинуть или повернуть его.';refresh();
}

function positionContext(x,y){
  const menu=root.querySelector('.furniture-context');
  if(!menu)return;
  const rect=menu.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(x,window.innerWidth-rect.width-8))+'px';
  menu.style.top=Math.max(8,Math.min(y,window.innerHeight-rect.height-8))+'px';
}

function openContext(x,y,key=null){
  releaseLook();
  clearWalkInput();
  closeContext();
  contextTarget=key;
  const placing=selectionMode==='place';
  const menu=document.createElement('div');
  menu.className='furniture-context';menu.setAttribute('aria-label','Действия с мебелью');
  menu.innerHTML=`<div class="context-main"><strong>${pieceFor(key||selected).title}</strong>${placing?action('Убрать из буфера','cancel-piece','','context-action'):action('Удалить предмет','delete-piece','','context-action')+action('Заменить на другой','replace-menu','','context-action')}${action('Закрыть','close-context','','context-action')}</div>`;
  root.append(menu);positionContext(x,y);
  menu.querySelector('button').focus({preventScroll:true});
}

// Dismissing a menu consumes the click: it must not place furniture or start orbiting.
document.addEventListener('pointerdown',event=>{
  const menu=root.querySelector('.furniture-context');
  dismissedMenu=false;
  if(menu&&!menu.contains(event.target)){
    closeContext();dismissedMenu=true;event.preventDefault();event.stopPropagation();
  }
},true);
document.addEventListener('click',event=>{
  if(dismissedMenu){dismissedMenu=false;event.preventDefault();event.stopPropagation();}
},true);

function isFullscreen(){return document.fullscreenElement===root||root.classList.contains('is-expanded');}

function syncFullscreen(){
  const active=isFullscreen();
  for(const button of root.querySelectorAll('[data-action="fullscreen"]')){
    button.textContent=active?'Выйти из полного экрана':'На весь экран';
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-keyshortcuts','F');
    button.title='Полный экран · F';
  }
  scene?.schedule();
}

async function toggleFullscreen(){
  if(document.fullscreenElement===root){
    try{await document.exitFullscreen();}catch{ /* Keep the exit control available for a retry. */ }
  }else if(root.classList.contains('is-expanded')){
    root.classList.remove('is-expanded');
    document.body.classList.remove('room-expanded');
  }else{
    try{
      if(!root.requestFullscreen)throw new Error('Fullscreen unavailable');
      await root.requestFullscreen();
    }catch{
      // iPhone and embedded browsers may only support filling the browser viewport.
      root.classList.add('is-expanded');
      document.body.classList.add('room-expanded');
    }
  }
  syncFullscreen();
}

function rotateSelected(){
  if(selectionMode!=='place'&&state.hovered&&state.placed[state.hovered])selectPiece(state.hovered,'edit');
  if(!selected)return;
  if(pieceFor(selected).type==='curtain'){status='Гардина крепится над окном и автоматически поворачивается вдоль стены.';refresh();return;}
  const rotation=((state.rotations[selected]||0)+1)%4;
  if(!state.carrying&&state.placed[selected]&&!fits(selected,state.placed[selected],state,rotation)){
    status='После поворота предмет перекроет стену, дверь, окно или другую мебель. Сначала подвиньте его.';
  }else{
    state.rotations[selected]=rotation;
    updateCarryPreview();
    state.suggestion=selectionMode==='place'?ApartmentScenarios.suggestion(selected,state):null;
    if(selectionMode==='place'&&!state.ghost&&state.suggestion)state.ghost={key:selected,point:state.suggestion};
    status='Предмет повёрнут на 90°. '+(state.placed[selected]?'Можно продолжить обустройство.':'Выберите место на полу.');
  }
  refresh();
}

document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented)return;
  if((event.code==='KeyF'||event.key?.toLowerCase()==='f')&&!Game.dialog.open&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')){
    event.preventDefault();toggleFullscreen();return;
  }
  if(event.key==='Escape'&&document.pointerLockElement===root.querySelector('.room-canvas')){releaseLook();clearWalkInput();event.preventDefault();return;}
  if(event.key==='Escape'&&(contextTarget||root.querySelector('.furniture-context'))){closeContext();event.preventDefault();return;}
  if(event.key==='Escape'&&selected&&!Game.dialog.open){freeCursor();event.preventDefault();return;}
  if(event.key==='Escape'&&root.classList.contains('is-expanded')&&!Game.dialog.open){
    toggleFullscreen();return;
  }
  const direction=walkDirections[event.code]||walkDirections[event.key];
  if(state.walking&&direction&&!Game.dialog.open&&!root.querySelector('.furniture-context')&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable]')){
    event.preventDefault();walkKeys.set(event.code||event.key,direction);startWalkInput();return;
  }
  if(!scene||(!selected&&!state.hovered)||Game.dialog.open||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
  if(event.key==='Delete'&&selectionMode==='edit'){event.preventDefault();deletePiece(selected);return;}
  if(event.code==='KeyR'||event.key.toLowerCase()==='r'){
    event.preventDefault();rotateSelected();
  }
});

function glyph(key) {
  const symbol=icons[key]||icons[{sofa:'sofa',bed:'bed',desk:'desk',table:'table',coffee:'table',plant:'plant',storage:'storage',shelf:'shelf'}[pieceFor(key).type]];
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${symbol}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.65"/></svg>`;
}

function restart() {
  releaseLook();
  clearWalkInput();
  closeContext();selectionMode=null;
  scene?.destroy();
  scene=null;
  state = {plan:'family',palette:0,wallColor:null,floorColor:null,placed:{},rotations:{},ghost:null,suggestion:null,scenario:null,earned:{},hovered:null,active:null,walking:false,walker:null,carrying:null};
  selected=null;
  gesture=null;
  root.innerHTML=`<section class="scenario-welcome panel"><a class="back-link" href="../index.html#games">← Все игры</a><h1>Выберите сценарий</h1><p>Выполните задания или начните со свободной расстановки.</p>${scenarioChoices()}<div class="welcome-bottom"><span>Без таймера. Сценарий можно сменить в любой момент.</span>${action('На весь экран','fullscreen','','quiet fullscreen-toggle','aria-pressed="false"')}</div></section>`;
  syncFullscreen();
}

function scenarioChoices(){
  return `<div class="scenario-choices">${ApartmentScenarios.scenarios.map(s=>action(`<span class="scenario-symbol" aria-hidden="true">${s.id==='relax'?glyph('sofa'):s.symbol}</span><strong>${s.title}</strong><span>${s.description}</span><small>${s.tasks.length} предметов · ${s.points} баллов${state.earned[s.id]?' · Награда получена':''}</small>`,'scenario',s.id,'scenario-card',`aria-pressed="${state.scenario===s.id}"`)).join('')}${action('<span class="scenario-symbol" aria-hidden="true">⌂</span><strong>Свободная расстановка</strong><span>Пробуйте планировки, мебель и цвета без заданий.</span><small>Без начисления баллов</small>','scenario','free','scenario-card',`aria-pressed="${state.scenario==='free'}"`)}</div>`;
}

function startStudio(scenario){
  clearWalkInput();
  closeContext();
  scene?.destroy();
  state.scenario=scenario;
  state.panel=scenario==='free'?'furniture':'tasks';
  const challenge=ApartmentScenarios.current(state);
  group='Вся мебель';
  selectPiece(null);
  status='Выберите предмет, затем нажмите на место в квартире.';
  gesture=null;
  suppressPieceClick=false;
  root.innerHTML = `<section class="apartment-studio" aria-label="Конструктор квартиры">
    <div class="scenario-toolbar"><div class="workspace-title"><a class="back-link" href="../index.html#games" aria-label="К списку игр" title="Все игры">←</a><strong>${challenge?.title||'Свободная расстановка'}</strong><span id="scenario-score" class="scenario-score" role="status"></span></div><div class="scenario-toolbar-actions">${action('Ходить','walk-mode','','quiet','id="walk-mode" aria-pressed="false"')}${action('Сценарии','scenarios','','quiet')}${action('На весь экран','fullscreen','','quiet fullscreen-toggle','aria-pressed="false"')}${action('?','help','','quiet help-toggle','aria-label="Управление" title="Управление"')}${action('Готово','result','','btn finish-button','id="finish-room" disabled')}</div></div>
    <div class="studio-layout"><aside class="studio-sidebar" aria-label="Мебель, задания и отделка">
    <nav class="sidebar-tabs" aria-label="Инструменты">${action('Мебель','panel','furniture','sidebar-tab','aria-controls="studio-furniture"')}${challenge?action('Задания <span id="tasks-count"></span>','panel','tasks','sidebar-tab','aria-controls="scenario-tasks"'):''}${action('Отделка','panel','finishes','sidebar-tab','aria-controls="studio-finishes"')}</nav>
    <div class="sidebar-content">
    <section id="scenario-tasks" class="scenario-tasks" aria-label="Задания сценария" hidden>
      <div class="task-heading"><h2>Задания</h2><p id="task-room"></p><p>Расставьте ${challenge?.tasks.length||0} ${challenge?.tasks.length===4?'предмета':'предметов'} — получите ${challenge?.points||0} баллов.</p></div>
      <div class="task-list">${(challenge?.tasks||[]).map(task=>`<article class="scenario-task" id="task-${task.id}"><div class="task-title"><span class="task-check" aria-hidden="true">○</span><h3>${task.title}</h3></div><p>${task.detail}</p><div class="task-bottom"><span class="task-state"></span>${action('Выбрать мебель','task',task.id,'quiet')}</div></article>`).join('')}</div>
      <p class="task-notice" id="task-notice" role="status" aria-live="polite"></p>
    </section>
    <section class="furnishing-bar" id="studio-furniture" aria-label="Каталог мебели" hidden>
      <div class="furnishing-intro"><h2>Мебель</h2><p>Нажмите на предмет, чтобы добавить его.</p></div>
      <div class="furniture-categories" role="group" aria-label="Категория мебели">${groups.map((label,i)=>action(label,'group',i,'quiet',`aria-pressed="${i===0}"`)).join('')}</div>
      <div class="mobile-item-controls" role="group" aria-label="Управление предметом"><span id="mobile-selected-piece"></span>${action('Повернуть на 90°','rotate','','quiet','id="mobile-rotate-piece"')}${action('Действия','item-menu','','quiet')}${action('Свободный курсор','cancel-piece','','quiet')}</div>
      <div class="furnishing-tools"><div class="furniture-tray" role="group" aria-label="Мебель">${order.map(key=>action(`${glyph(key)}<span>${pieceFor(key).title}</span><i class="piece-mark" aria-hidden="true"></i>`,'piece',key,'furniture-button','aria-pressed="false" draggable="false"')).join('')}</div>
      </div>
      </section>
    <section class="room-preferences" id="studio-finishes" aria-label="Отделка" hidden><h2>Отделка</h2>
      <div class="room-options">
      ${colorControls('Цвет стен','wallColor',['#f6dfcc','#f3f0e9','#c5d3ba','#a6bfce','#d6a8a3','#8c9296'])}
      ${colorControls('Цвет пола','floorColor',['#d8b78b','#eee3ce','#a77c55','#705441','#b9bec2','#67696a'])}
      ${optionGroup('Палитра','palette',['Песок','Глина','Шалфей'],0,colors.map(palette=>palette.wallSide))}
      </div>
    </section></div><p class="room-feedback" id="room-feedback" role="status" aria-live="polite"></p></aside><section class="studio-stage" aria-label="Планировка квартиры">
    <div class="room-configuration">
      <div class="plan-picker" role="group" aria-label="Планировка">${plans.map(plan=>action(`<strong>${plan.title}</strong><span>${plan.area.toLocaleString('ru-RU')} м²</span>`,'plan',plan.id,'plan-choice',`aria-pressed="${state.plan===plan.id}"`)).join('')}</div>
    </div>
    <div class="room-viewport">
      <canvas class="room-canvas" tabindex="0" aria-label="Объёмная квартира. Стрелки перемещают выбранный предмет, Enter ставит его, R поворачивает на 90 градусов. Без выбранного предмета стрелки поворачивают комнату."></canvas>
      <div class="room-objective"><strong>${challenge?.title||'Ваша квартира'}</strong><span id="placed-count"></span><progress id="room-progress" max="${challenge?.tasks.length||1}" value="0" aria-label="Выполненные задания" ${scenario==='free'?'hidden':''}></progress></div>
      <div class="walk-controls" role="group" aria-label="Движение персонажа" hidden>${[['↑','up','Идти вперёд'],['←','left','Идти влево'],['↓','down','Идти назад'],['→','right','Идти вправо']].map(([symbol,key,label])=>`<button type="button" class="room-tool walk-direction walk-${key}" data-walk="${key}" aria-label="${label}">${symbol}</button>`).join('')}</div>
      ${challenge?'':action('Поставить сюда','suggested','','room-spot','id="room-suggestion" hidden')}
      <div class="room-item-tools" role="group" aria-label="Выбранный предмет">
        <span class="selected-piece-name" id="selected-piece-name"></span>
        ${action('Повернуть · R','rotate','','room-tool','id="rotate-piece" aria-keyshortcuts="R"')}
        ${action('Убрать в набор','remove','','room-tool','id="remove-piece" hidden')}
        ${action('Действия','item-menu','','room-tool')}
        ${action('Снять выделение','cancel-piece','','room-tool')}
      </div>
      <div class="room-view-tools" role="group" aria-label="Камера">${[
        ['−','zoom-out','Отдалить'],['+','zoom-in','Приблизить'],['↶','rotate-left','Повернуть влево'],['↷','rotate-right','Повернуть вправо'],['3D','perspective','Объёмный вид'],['План','top','Вид сверху']
      ].map(([symbol,key,label])=>action(symbol,'view',key,'room-tool',`aria-label="${label}" title="${label}" ${key==='top'||key==='perspective'?`aria-pressed="${key==='perspective'}"`:''}`)).join('')}</div>
    </div>
    </section></div></section>`;
  const marker = root.querySelector('#room-suggestion');
  scene = ApartmentRoom.mount(root.querySelector('.room-canvas'),()=>state,point=>{
    if(!marker)return;
    marker.hidden=!point;
    if(point){
      marker.style.left=point[0]+'px';
      marker.style.top=point[1]+'px';
    }
  });
  if(state.walking){ApartmentNavigation.spawn(state);scene.setWalk(true);}
  syncFullscreen();
  refresh();
}

function colorControls(label,field,swatches){
  const current=state[field]||(field==='wallColor'?colors[state.palette].wall:colors[state.palette].wood);
  return `<div class="surface-colors"><p>${label}</p><div class="surface-swatches" role="group" aria-label="${label}">${swatches.map(color=>action(`<span class="swatch" style="--swatch:${color}" aria-hidden="true"></span>`,'surface',field+':'+color,'surface-swatch',`aria-label="${label}: ${color}" aria-pressed="${current===color}"`)).join('')}<label class="custom-color">Свой<input type="color" data-surface="${field}" value="${current}" aria-label="${label}: свой цвет"></label></div></div>`;
}

function optionGroup(label,field,labels,offset=0,swatches=[]) {
  return `<div><p>${label}</p><div class="room-values" role="group" aria-label="${label}">${labels.map((name,i)=>action(`${swatches[i]?`<span class="swatch" style="--swatch:${swatches[i]}" aria-hidden="true"></span>`:''}${name}`, 'setting',field+':'+(i+offset),'quiet',`aria-pressed="${state[field]===i+offset}"`)).join('')}</div></div>`;
}

function refresh() {
  const count = Object.keys(state.placed).length;
  const plan=floorPlan(state);
  const gained=ApartmentScenarios.award(state);
  const challenge=ApartmentScenarios.current(state);
  const completed=ApartmentScenarios.evaluate(state);
  const done=Object.values(completed).filter(Boolean).length;
  const walkButton=root.querySelector('#walk-mode');
  walkButton.textContent=state.walking?'К планировке':'Ходить';
  walkButton.setAttribute('aria-pressed',String(Boolean(state.walking)));
  root.querySelector('.walk-controls').hidden=!state.walking;
  root.querySelector('.room-viewport').classList.toggle('is-walking',Boolean(state.walking));
  root.querySelector('.room-canvas').setAttribute('aria-label',state.walking?'Квартира от первого лица. WASD или стрелки — идти. Мышь — осмотр. Клик — захват курсора, Escape — освобождение.':'Объёмная квартира. Выберите мебель, кликните по полу для размещения. R — поворот предмета.');
  for(const button of root.querySelectorAll('[data-action="view"][data-value^="zoom-"]'))button.hidden=Boolean(state.walking);
  for(const [panel,selector] of [['tasks','#scenario-tasks'],['furniture','#studio-furniture'],['finishes','#studio-finishes']])root.querySelector(selector).hidden=state.panel!==panel;
  for(const button of root.querySelectorAll('[data-action="panel"]'))button.setAttribute('aria-pressed',String(button.dataset.value===state.panel));
  root.querySelector('#scenario-score').textContent=ApartmentScenarios.score(state)+' баллов';
  if(challenge){
    root.querySelector('#tasks-count').textContent=done+'/'+challenge.tasks.length;
    root.querySelector('#task-room').textContent='Комната для заданий: '+ApartmentScenarios.targetZone(state).name;
    for(const task of challenge.tasks){
      const card=root.querySelector('#task-'+task.id), active=completed[task.id];
      card.classList.toggle('is-complete',active);
      card.querySelector('.task-check').textContent=active?'✓':'○';
      card.querySelector('.task-state').textContent=active?'Выполнено':'Пока не выполнено';
    }
    root.querySelector('#task-notice').textContent=gained.length?'Сценарий выполнен! +'+challenge.points+' баллов.':state.earned[challenge.id]?'Награда получена. Можно продолжить расстановку.':'Баллы начисляются за все задания один раз.';
  }
  for(const button of root.querySelectorAll('[data-action="plan"]'))button.setAttribute('aria-pressed',button.dataset.value===state.plan);
  for(const button of root.querySelectorAll('[data-action="group"]'))button.setAttribute('aria-pressed',groups[Number(button.dataset.value)]===group);
  root.querySelector('.room-item-tools').hidden=!selected;
  root.querySelector('#selected-piece-name').textContent=selected?pieceFor(selected).title:'';
  root.querySelector('#rotate-piece').disabled=!selected;
  root.querySelector('#mobile-rotate-piece').disabled=!selected;
  root.querySelector('#mobile-selected-piece').textContent=selected?pieceFor(selected).title:'Выберите предмет мебели';
  root.querySelector('#remove-piece').hidden=selectionMode!=='edit';
  root.querySelector('#remove-piece').textContent='Удалить предмет';
  root.querySelector('#placed-count').textContent = challenge?done+' из '+challenge.tasks.length+' заданий':count+' предметов';
  root.querySelector('#room-progress').value = done;
  root.querySelector('#room-suggestion')?.setAttribute('aria-label',selected?'Поставить сюда: '+pieceFor(selected).title:'Поставить сюда');
  root.querySelector('#finish-room').disabled = count===0;
  const feedback = root.querySelector('#room-feedback');
  feedback.textContent = status;
  feedback.classList.toggle('is-retry', status.startsWith('Здесь тесно.'));
  feedback.classList.toggle('is-success', status.startsWith('Квартира готова.'));
  for(const button of root.querySelectorAll('[data-action="piece"]')) {
    const key=button.dataset.value;
    const count=Object.keys(state.placed).filter(id=>pieceType(id)===key).length;
    button.setAttribute('aria-pressed',key===pieceType(selected));
    button.classList.toggle('placed',count>0);
    button.title='Добавить: '+pieceFor(key).title+(count?' · В квартире: '+count:'');
    button.hidden=group!=='Вся мебель'&&pieceFor(key).group!==group;
    button.querySelector('.piece-mark').textContent=count||'+';
  }
  for(const button of root.querySelectorAll('[data-action="setting"]')) {
    const [field,value]=button.dataset.value.split(':');
    button.setAttribute('aria-pressed',state[field]===Number(value));
  }
  for(const button of root.querySelectorAll('[data-action="surface"]')){
    const [field,color]=button.dataset.value.split(':');
    button.setAttribute('aria-pressed',(state[field]||(field==='wallColor'?colors[state.palette].wall:colors[state.palette].wood))===color);
  }
  for(const input of root.querySelectorAll('[data-surface]'))input.value=state[input.dataset.surface]||(input.dataset.surface==='wallColor'?colors[state.palette].wall:colors[state.palette].wood);
  root.querySelector('.room-canvas').style.cursor=selectionMode==='place'?'crosshair':state.hovered?'move':'grab';
  scene.schedule();
}

function selectPiece(key,mode=key?(state.placed[key]?'edit':'place'):null) {
  if(key&&!(state.walking&&mode==='edit'))releaseLook();
  cancelCarry();
  selected=key;
  selectionMode=mode;state.active=mode==='edit'?key:null;state.hovered=null;
  state.suggestion=mode==='place'?ApartmentScenarios.suggestion(key,state):null;
  const point=mode==='place'&&state.suggestion;
  state.ghost=point?{key,point}:null;
}

function choose(key) {
  closeContext();
  selectPiece(key);
  if(group!=='Вся мебель')group=pieceFor(key).group;
  status=selectionMode==='edit'?pieceFor(key).title+': перетащите для перемещения. R — поворот.':state.suggestion?pieceFor(key).title+': нажмите на свободное место в квартире.':'Мало места. Передвиньте мебель или выберите предмет поменьше.';
  if(state.walking&&selectionMode==='edit')status='Выбран «'+pieceFor(key).title+'». ЛКМ по предмету — взять, R — повернуть, Delete — удалить. ПКМ — курсор.';
  if(pieceFor(key).type==='curtain')status='Поднесите гардину к окну: она закрепится над ним.';
  refresh();
}

function locate(event) {
  const rect = root.querySelector('canvas').getBoundingClientRect();
  const x=event.clientX-rect.left, y=event.clientY-rect.top;
  return {x,y,inside:x>=0&&x<=rect.width&&y>=0&&y<=rect.height};
}

function drop(point) {
  if(!selected||!point)return;
  point=ApartmentRoom.snapPoint?.(selected,point,state)||point;
  const key=selected;
  if(fits(key,point,state)) {
    state.placed[key]=point;
    state.carryOrigin=null;
    selectPiece(null);
    status=state.walking?'Предмет на месте, выделение снято. ЛКМ по мебели — взять снова.':'Предмет на месте. Курсор свободен для выбора мебели и вращения сцены.';
  } else {
    status='Здесь тесно. Выберите свободное место или поверните предмет.';
    state.ghost = selectionMode==='edit'&&!state.carrying?null:{key,point};
  }
  refresh();
}

function movePreview(event) {
  const {x,y,inside}=locate(event);
  if(!inside || !selected)return null;
  const floor=scene.pixelToFloor(x,y);
  if(!floor)return null;
  const offset=gesture?.offset||[0,0];
  const position=floor.map((value,i)=>value+offset[i]);
  const nearHint=state.suggestion&&Math.hypot(position[0]-state.suggestion[0],position[1]-state.suggestion[1])<.12;
  const raw=nearHint?[...state.suggestion]:position.map(value=>Math.round(value*100)/100);
  const point=ApartmentRoom.snapPoint?.(selected,raw,state)||raw;
  state.ghost={key:selected,point};
  scene.schedule();
  return point;
}

root.addEventListener('pointerdown',event=>{
  releasedLookContext=false;
  if(event.button===2&&state.walking&&event.target.matches('.room-canvas')&&document.pointerLockElement===event.target){
    event.preventDefault();releasedLookContext=true;releaseLook();clearWalkInput();gesture=null;return;
  }
  const walkButton=event.target.closest('[data-walk]');
  if(walkButton&&state.walking&&event.button===0){
    event.preventDefault();walkPointers.set(event.pointerId,walkButton.dataset.walk);walkButton.setPointerCapture(event.pointerId);startWalkInput();return;
  }
  if(event.target.closest('.furniture-context'))return;
  if(gesture)return;
  if(event.button===1&&event.target.matches('.room-canvas')){
    event.preventDefault();
    gesture={id:event.pointerId,start:[event.clientX,event.clientY],last:[event.clientX,event.clientY],offset:[0,0],type:'pan'};
    event.target.setPointerCapture(event.pointerId);
    return;
  }
  if(event.button!==0)return;
  const piece=event.target.closest('[data-action="piece"]');
  const canvas=event.target.closest('canvas');
  if(!piece&&!canvas)return;
  if(canvas&&state.walking){
    if(event.pointerType==='mouse'&&selectionMode!=='place'){
      event.preventDefault();
      if(state.carrying){updateCarryPreview();if(state.ghost)drop(state.ghost.point);}
      else{
        const rect=canvas.getBoundingClientRect(),locked=document.pointerLockElement===canvas;
        const {x,y}=locked?{x:rect.width*.5,y:rect.height*.48}:locate(event);
        selectNearby(x,y);
      }
      acquireLook();return;
    }
    // Looking around must also work when the finger starts over furniture.
    gesture={id:event.pointerId,start:[event.clientX,event.clientY],last:[event.clientX,event.clientY],offset:[0,0],type:'canvas'};
    canvas.setPointerCapture(event.pointerId);
    canvas.focus?.({preventScroll:true});
    return;
  }
  const start=[event.clientX,event.clientY];
  const {x,y}=locate(event);
  const hit=canvas&&selectionMode!=='place'?scene.hit(x,y):null;
  const key=piece?nextInstance(piece.dataset.value):hit||selected;
  if(piece)state.rotations[key]=0;
  gesture={id:event.pointerId,start,last:start,offset:[0,0],type:piece?'tray':hit?'object':'canvas'};
  if(piece || hit) choose(key);
  if(hit) {
    const floor=scene.pixelToFloor(x,y);
    if(floor) gesture.offset=state.placed[hit].map((value,i)=>value-floor[i]);
  }
  (piece||canvas).setPointerCapture(event.pointerId);
});

root.addEventListener('pointermove',event=>{
  if(state.walking&&event.pointerType==='mouse'&&event.target.matches('.room-canvas')&&selectionMode!=='place'){
    if(document.pointerLockElement!==event.target&&(lookDenied||!event.target.requestPointerLock)&&!Game.dialog.open&&!root.querySelector('.furniture-context'))scene.rotate(-(event.movementX||0)*.0025,(event.movementY||0)*.0025);
    updateCarryPreview();
    return;
  }
  if(gesture?.id!==event.pointerId) {
    if(root.querySelector('.furniture-context'))return;
    if(event.pointerType==='mouse'&&event.target.matches('.room-canvas')){
      if(selectionMode==='place')movePreview(event);
      else{
        const {x,y}=locate(event),hit=scene.hit(x,y);
        if(state.hovered!==hit){state.hovered=hit;scene.schedule();}
        event.target.style.cursor=hit?'move':'grab';
      }
    }
    return;
  }
  const [lastX,lastY]=gesture.last;
  if(gesture.type==='canvas'){
    if(Math.hypot(event.clientX-gesture.start[0],event.clientY-gesture.start[1])<=6)return;
    gesture.type='orbit';
  }
  if(gesture.type==='object'){
    if(Math.hypot(event.clientX-gesture.start[0],event.clientY-gesture.start[1])<=6)return;
    gesture.type='move-object';
  }
  if(gesture.type==='orbit'){
    const direction=state.walking?1:-1;
    scene.rotate((event.clientX-lastX)*.008*direction,-(event.clientY-lastY)*.006*direction);
  }
  else if(gesture.type==='pan')scene.pan(event.clientX-lastX,event.clientY-lastY);
  else movePreview(event);
  if(gesture.type==='orbit')updateCarryPreview();
  gesture.last=[event.clientX,event.clientY];
});

root.addEventListener('pointerup',event=>{
  if(walkPointers.has(event.pointerId)){walkPointers.delete(event.pointerId);return;}
  if(gesture?.id!==event.pointerId)return;
  const {type,start}=gesture;
  if(type==='tray'&&Math.hypot(event.clientX-start[0],event.clientY-start[1])>6) {
    suppressPieceClick=true;
    setTimeout(()=>{suppressPieceClick=false;},0);
  }
  const draggedCanvas=type==='canvas'&&Math.hypot(event.clientX-start[0],event.clientY-start[1])>6;
  if(state.walking&&type==='canvas'&&!draggedCanvas&&selectionMode!=='place'){
    gesture=null;
    if(state.carrying){updateCarryPreview();if(state.ghost)drop(state.ghost.point);}
    else{const {x,y}=locate(event);selectNearby(x,y);}
    return;
  }
  const point=type==='orbit'||type==='pan'||type==='object'||draggedCanvas||(type==='canvas'&&selectionMode!=='place')?null:movePreview(event);
  gesture=null;
  if(point)drop(point);
  else if(type==='move-object'){state.ghost=null;refresh();}
  else if(type==='canvas'&&!draggedCanvas&&selectionMode!=='place')freeCursor();
});
root.addEventListener('pointercancel',event=>{walkPointers.delete(event.pointerId);if(gesture?.id===event.pointerId){gesture=null;if(selectionMode==='edit')state.ghost=null;scene.schedule();}});
root.addEventListener('pointerleave',event=>{if(event.target.matches('.room-canvas')&&!gesture){state.hovered=null;scene.schedule();}},true);
root.addEventListener('keydown',event=>{
  if(!event.target.matches('.room-canvas'))return;
  const offset={ArrowLeft:[-.25,0],ArrowRight:[.25,0],ArrowUp:[0,-.25],ArrowDown:[0,.25]}[event.key];
  if(state.walking&&offset)return;
  if(event.key==='Escape'&&selected){freeCursor();event.preventDefault();return;}
  if(event.key==='Enter'&&state.ghost){event.preventDefault();drop(state.ghost.point);return;}
  if(!offset)return;
  event.preventDefault();
  if(selectionMode==='edit'&&!state.ghost)state.ghost={key:selected,point:[...state.placed[selected]]};
  if(state.ghost) {
    state.ghost.point=state.ghost.point.map((value,i)=>value+offset[i]);
    scene.schedule();
  } else scene.rotate(offset[0],offset[1]*.6);
});
root.addEventListener('wheel',event=>{
  if(!event.target.matches('.room-canvas'))return;
  event.preventDefault();
  const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?400:1);
  const {x,y}=locate(event);
  scene.scaleBy(Math.max(-.4,Math.min(.4,-pixels*.002)),x,y);
},{passive:false});
root.addEventListener('auxclick',event=>{if(event.button===1&&event.target.matches('.room-canvas'))event.preventDefault();});
root.addEventListener('contextmenu',event=>{
  if(releasedLookContext){releasedLookContext=false;event.preventDefault();return;}
  if(state.walking&&event.target.matches('.room-canvas')&&document.pointerLockElement===event.target){
    event.preventDefault();releaseLook();clearWalkInput();gesture=null;return;
  }
  if(dismissedMenu){event.preventDefault();return;}
  const canvas=event.target.matches('.room-canvas');
  if(!canvas&&!event.target.closest('[data-action="piece"]'))return;
  if(selectionMode==='place'&&selected){event.preventDefault();openContext(event.clientX,event.clientY);return;}
  if(canvas){
    const {x,y}=locate(event),key=scene.hit(x,y);
    if(key){event.preventDefault();choose(key);openContext(event.clientX,event.clientY,key);}
  }
});
root.addEventListener('input',event=>{
  const field=event.target.dataset.surface;
  if(['wallColor','floorColor'].includes(field)&&/^#[0-9a-f]{6}$/i.test(event.target.value)){
    state[field]=event.target.value;
    status='Цвет '+(field==='wallColor'?'стен':'пола')+' обновлён.';refresh();
  }
});

Game.init({restart,onAction(name,value){
  if(['scenarios','result','help'].includes(name)){releaseLook();clearWalkInput();}
  if(name==='panel'&&['furniture','finishes',...(ApartmentScenarios.current(state)?['tasks']:[])].includes(value)){state.panel=value;refresh();}
  if(name==='help')modal('Управление',`<div class="controls-guide"><h3>Планировка</h3><dl><dt>Добавить предмет</dt><dd>Выберите его в каталоге и нажмите на пол.</dd><dt>Вращать камеру</dt><dd>Зажмите ЛКМ на пустом месте и двигайте мышь.</dd><dt>Масштаб / сдвиг</dt><dd>Колёсико / зажатое колёсико.</dd></dl><h3>Прогулка</h3><dl><dt>Идти / осматриваться</dt><dd>WASD или стрелки / движение мыши.</dd><dt>Взять / поставить</dt><dd>ЛКМ по предмету рядом / ЛКМ по свободному месту.</dd><dt>Освободить курсор</dt><dd>ПКМ или Esc.</dd></dl><h3>Быстрые действия</h3><p>R — повернуть предмет · Delete — удалить · F — на весь экран.</p></div>`);
  if(name==='walk-mode')setWalking(!state.walking);
  if(name==='cancel-piece')freeCursor();
  if(name==='close-context')closeContext();
  if(name==='delete-piece')deletePiece(contextTarget);
  if(name==='replace-piece')replacePiece(value);
  if(name==='replace-menu'&&contextTarget){
    const menu=root.querySelector('.furniture-context');
    menu.querySelector('.context-replacements')?.remove();
    const submenu=document.createElement('div');submenu.className='context-replacements';
    submenu.setAttribute('aria-label','Выберите замену');
    submenu.innerHTML=`<strong>Заменить на</strong>${order.map(key=>action(pieceFor(key).title,'replace-piece',key,'context-action')).join('')}`;
    const rect=menu.getBoundingClientRect();menu.append(submenu);positionContext(rect.left,rect.top);
  }
  if(name==='item-menu'&&selected){
    const button=root.querySelector('[data-action="item-menu"]'),rect=button.getBoundingClientRect();
    openContext(rect.left,rect.bottom,selectionMode==='edit'?selected:null);
  }
  if(name==='fullscreen')toggleFullscreen();
  if(name==='scenarios')modal('Выберите сценарий',`<p>Мебель и баллы сохраняются при смене сценария.</p>${scenarioChoices()}<div class="scenario-reset">${action('Начать заново','restart','','quiet')}<small>Очистить квартиру и сбросить баллы</small></div>`);
  if(name==='scenario'&&(value==='free'||ApartmentScenarios.scenarios.some(s=>s.id===value))){
    Game.close();startStudio(value);root.focus({preventScroll:true});
  }
  if(name==='task'){
    const task=ApartmentScenarios.current(state)?.tasks.find(item=>item.id===value);
    if(task){
      const key=task.piece;
      state.panel='furniture';
      chooseNew(key);
      status=task.detail;
      refresh();
      root.querySelector('.room-canvas').scrollIntoView({block:'center',behavior:'smooth'});
      root.querySelector('.room-canvas').focus({preventScroll:true});
    }
  }
  if(name==='piece'&&!suppressPieceClick) chooseNew(value);
  if(name==='suggested'&&state.suggestion) drop(state.suggestion);
  if(name==='group'){
    group=groups[Number(value)];
    refresh();
  }
  if(name==='rotate')rotateSelected();
  if(name==='surface'){
    const [field,color]=value.split(':');
    if(['wallColor','floorColor'].includes(field)&&/^#[0-9a-f]{6}$/i.test(color)){
      state[field]=color;status='Цвет '+(field==='wallColor'?'стен':'пола')+' обновлён.';refresh();
    }
  }
  if(name==='remove'&&selected){
    deletePiece(selected);
  }
  if(name==='plan'){
    clearWalkInput();
    cancelCarry();
    state.plan=value;
    const returned=[];
    for(const key of Object.keys(state.placed)){
      if(!fits(key,state.placed[key],state)){delete state.placed[key];returned.push(pieceFor(key).title.toLowerCase());}
    }
    closeContext();selectPiece(null);
    if(state.walking){
      if(ApartmentNavigation.spawn(state))scene.setWalk(true);
      else{state.walking=false;scene.setView(false);}
    }
    group='Вся мебель';
    status=returned.length?'Вещи, не поместившиеся в новую квартиру, вернулись в набор: '+returned.join(', ')+'.':'Площадь, окна и контур квартиры обновлены.';
    refresh();
  }
  if(name==='setting'){
    const [field,setting]=value.split(':');
    state[field]=Number(setting);
    status='Материалы обновлены.';
    refresh();
  }
  if(name==='view') {
    if(value==='top'||value==='perspective'){
      if(state.walking)setWalking(false);
      scene.setView(value==='top');
      for(const button of root.querySelectorAll('.room-tool[aria-pressed]')){
        button.setAttribute('aria-pressed',button.dataset.value===value);
      }
    }
    else if(value==='zoom-in'||value==='zoom-out')scene.scaleBy(value==='zoom-in'?.2:-.2);
    else scene.rotate(value==='rotate-left'?-.22:.22,0);
  }
  if(name==='result'&&Object.keys(state.placed).length>0) {
    const summary=Object.keys(state.placed).map(key=>pieceFor(key).title).join(', ');
    const challenge=ApartmentScenarios.current(state);
    const completed=ApartmentScenarios.evaluate(state);
    modal('Ваш вариант квартиры',reward({title:challenge?.title||'Моя квартира',score:ApartmentScenarios.score(state),badge:'Автор планировки',
      detail:floorPlan(state).title+' · '+floorPlan(state).area.toLocaleString('ru-RU')+' м² · '+summary,
      extra:challenge?`<ul class="result-tasks">${challenge.tasks.map(task=>`<li>${completed[task.id]?'✓':'○'} ${task.title} · ${completed[task.id]?'выполнено':'не выполнено'}</li>`).join('')}</ul><p>Награда за сценарий: ${challenge.points} баллов · ${state.earned[challenge.id]?'получена':'выполните все задания'}. Баллы сохраняются до начала нового прохождения.</p>`:'',
      cta:'Получить подборку похожих квартир'}));
  }
}});
