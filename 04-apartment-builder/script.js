'use strict';

const {root,action,reward,modal} = Game;
const {pieces,colors,fits,floorPlan} = ApartmentRoom;
const {plans} = ApartmentPlans;
const icons = {
  sofa:'M5 15V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M3 14v5m18-5v5M3 16h18M3 13h3v3m15-3h-3v3',
  bed:'M3 19V6m18 13v-7M3 16h18M7 11V8h6v3m-10 0h16a2 2 0 0 1 2 2v3',
  desk:'M3 12h18M5 12v8m14-8v8M8 10V5h8v5H8m4 0v2',
  table:'M5 8h14v4H5zm2 4v8m10-8v8M2 8h20',
  plant:'M9 14h6l-1 6h-4l-1-6zm3 0v-4m0 0C6 9 6 5 5 4c3 0 6 2 7 6zm0 0c2-5 5-6 7-6-1 4-4 6-7 6z',
  storage:'M5 3h14v18H5zm7 0v18m-3-10v3m6-3v3',
  shelf:'M5 3h14v18H5zm0 6h14M5 15h14M8 4v4m3-4v4m4 2v4m-7 2v4'
};
const order = Object.keys(pieces);
const groups=['Вся мебель',...new Set(order.map(key=>pieces[key].group))];
let scene, state, selected, status, gesture, suppressPieceClick, group, selectionMode=null, contextTarget=null, dismissedMenu=false;
const walkKeys=new Map(),walkPointers=new Map();
let walkFrame=0,lastWalkTime=0;
const walkDirections={KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right',ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};

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
  if(ApartmentNavigation.move(state,Number(held.has('right'))-Number(held.has('left')),Number(held.has('up'))-Number(held.has('down')),scene.walkAngle(),dt))scene.schedule();
  if(held.size)walkFrame=requestAnimationFrame(walkTick);
  else{lastWalkTime=0;if(state.walker){state.walker.phase=0;scene.schedule();}}
}
function startWalkInput(){if(!walkFrame)walkFrame=requestAnimationFrame(walkTick);}
function setWalking(enabled){
  clearWalkInput();closeContext();gesture=null;
  if(selectionMode==='edit')state.ghost=null;
  state.walking=enabled;
  if(enabled&&!ApartmentNavigation.spawn(state)){
    state.walking=false;status='Нет свободного места для персонажа. Уберите или передвиньте мебель.';refresh();return;
  }
  scene.setWalk(state.walking);
  if(!state.walking)scene.setView(false);
  status=state.walking?'WASD или стрелки — идти. Выберите мебель слева, чтобы обустраивать квартиру во время прогулки.':'Вы вернулись к конструктору. Вся расстановка сохранена.';
  refresh();
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
  if(!old||!state.placed[old]||!pieces[key]||state.placed[key])return;
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
  clearWalkInput();
  closeContext();
  contextTarget=key;
  const placing=selectionMode==='place';
  const menu=document.createElement('div');
  menu.className='furniture-context';menu.setAttribute('aria-label','Действия с мебелью');
  menu.innerHTML=`<div class="context-main"><strong>${pieces[key||selected].title}</strong>${placing?action('Убрать из буфера','cancel-piece','','context-action'):action('Удалить предмет','delete-piece','','context-action')+action('Заменить на другой','replace-menu','','context-action')}${action('Закрыть','close-context','','context-action')}</div>`;
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
  const rotation=((state.rotations[selected]||0)+1)%4;
  if(state.placed[selected]&&!fits(selected,state.placed[selected],state,rotation)){
    status='После поворота предмет перекроет стену, дверь, окно или другую мебель. Сначала подвиньте его.';
  }else{
    state.rotations[selected]=rotation;
    state.suggestion=selectionMode==='place'?ApartmentScenarios.suggestion(selected,state):null;
    if(selectionMode==='place'&&!state.ghost&&state.suggestion)state.ghost={key:selected,point:state.suggestion};
    status='Предмет повёрнут на 90°. '+(state.placed[selected]?'Можно продолжить обустройство.':'Выберите место на полу.');
  }
  refresh();
}

document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown',event=>{
  if(event.defaultPrevented)return;
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
  const symbol=icons[key]||icons[{sofa:'sofa',bed:'bed',desk:'desk',table:'table',coffee:'table',plant:'plant',storage:'storage',shelf:'shelf'}[pieces[key].type]];
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${symbol}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.65"/></svg>`;
}

function restart() {
  clearWalkInput();
  closeContext();selectionMode=null;
  scene?.destroy();
  scene=null;
  state = {plan:'family',palette:0,wallColor:null,floorColor:null,placed:{},rotations:{},ghost:null,suggestion:null,scenario:null,earned:{},hovered:null,active:null,walking:false,walker:null};
  selected=null;
  gesture=null;
  root.innerHTML=`<section class="scenario-welcome panel"><p class="eyebrow">Ваша квартира, ваши правила</p><h2>Как вы будете здесь жить?</h2><p>Выберите сценарий с небольшими заданиями или обустройте квартиру по своему вкусу.</p>${scenarioChoices()}<p class="scenario-note">Без таймера. Любую мебель можно свободно перемещать.</p>${action('На весь экран','fullscreen','','quiet fullscreen-toggle','aria-pressed="false"')}</section>`;
  syncFullscreen();
}

function scenarioChoices(){
  return `<div class="scenario-choices">${action('<span class="scenario-symbol" aria-hidden="true">⌨</span><strong>Работаю из дома</strong><span>Устройте место для работы, сна и перерывов.</span><small>3 необязательных задания · до 300 баллов</small>','scenario','work','scenario-card',`aria-pressed="${state.scenario==='work'}"`)}${action('<span class="scenario-symbol" aria-hidden="true">⌂</span><strong>Свободная расстановка</strong><span>Пробуйте планировки, мебель и цвета без заданий.</span><small>Полная свобода обустройства</small>','scenario','free','scenario-card',`aria-pressed="${state.scenario==='free'}"`)}</div>`;
}

function startStudio(scenario){
  clearWalkInput();
  closeContext();
  scene?.destroy();
  state.scenario=scenario;
  group='Вся мебель';
  selectPiece(null);
  status='Выберите мебель и поставьте её на пол. Можно воспользоваться подсказкой «Поставить сюда».';
  gesture=null;
  suppressPieceClick=false;
  root.innerHTML = `<section class="apartment-studio" aria-label="Конструктор квартиры">
    <div class="scenario-toolbar"><div><p class="eyebrow">Ваш сценарий</p><strong>${scenario==='work'?'Работаю из дома':'Свободная расстановка'}</strong></div><div class="scenario-toolbar-actions"><span id="scenario-score" class="scenario-score"></span>${action('Прогулка по квартире','walk-mode','','btn','id="walk-mode" aria-pressed="false"')}${action('Сменить сценарий','scenarios','','quiet')}${action('На весь экран','fullscreen','','quiet fullscreen-toggle','aria-pressed="false"')}</div></div>
    <div class="studio-layout"><aside class="studio-sidebar" aria-label="Мебель, задания и отделка">
    <section id="scenario-tasks" class="scenario-tasks" aria-label="Необязательные задания" ${scenario==='free'?'hidden':''}>
      <div class="task-heading"><strong>Обустройте свой день дома</strong><p>Задания необязательны. За каждое — 100 баллов один раз за прохождение.</p></div>
      <div class="task-list">${ApartmentScenarios.tasks.map(task=>`<article class="scenario-task" id="task-${task.id}"><div class="task-title"><span class="task-check" aria-hidden="true">○</span><h3>${task.title}</h3><span class="task-points">+${task.points}</span></div><p>${task.detail}</p><div class="task-bottom"><span class="task-state"></span>${action('Выбрать мебель','task',task.id,'quiet')}</div></article>`).join('')}</div>
      <p class="task-notice" id="task-notice" role="status" aria-live="polite"></p>
    </section>
    <div class="furnishing-bar">
      <div class="furnishing-intro"><strong>Мебель</strong><p class="room-feedback" id="room-feedback" role="status"></p></div>
      <div class="furniture-categories" role="group" aria-label="Категория мебели">${groups.map((label,i)=>action(label,'group',i,'quiet',`aria-pressed="${i===0}"`)).join('')}</div>
      <div class="mobile-item-controls" role="group" aria-label="Управление предметом"><span id="mobile-selected-piece"></span>${action('Повернуть на 90°','rotate','','quiet','id="mobile-rotate-piece"')}${action('Действия','item-menu','','quiet')}${action('Свободный курсор','cancel-piece','','quiet')}</div>
      <div class="furnishing-tools"><div class="furniture-tray" role="group" aria-label="Мебель">${order.map(key=>action(`${glyph(key)}<span>${pieces[key].title}</span><i class="piece-mark" aria-hidden="true"></i>`,'piece',key,'furniture-button','aria-pressed="false" draggable="false"')).join('')}</div>
        ${action('Посмотреть результат','result','','btn','id="finish-room" disabled')}
      </div>
      </div>
    <details class="room-preferences" open><summary>Цвет стен и пола</summary>
      <div class="room-options">
      ${colorControls('Цвет стен','wallColor',['#f6dfcc','#f3f0e9','#c5d3ba','#a6bfce','#d6a8a3','#8c9296'])}
      ${colorControls('Цвет пола','floorColor',['#d8b78b','#eee3ce','#a77c55','#705441','#b9bec2','#67696a'])}
      ${optionGroup('Палитра','palette',['Песок','Глина','Шалфей'],0,colors.map(palette=>palette.wallSide))}
      </div>
    </details></aside><section class="studio-stage" aria-label="Планировка квартиры">
    <div class="room-configuration">
      <div class="plan-picker" role="group" aria-label="Планировка">${plans.map(plan=>action(`<strong>${plan.title}</strong><span>${plan.area.toLocaleString('ru-RU')} м²</span>`,'plan',plan.id,'plan-choice',`aria-pressed="${state.plan===plan.id}"`)).join('')}</div>
    </div>
    <div class="room-viewport">
      <canvas class="room-canvas" tabindex="0" aria-label="Объёмная квартира. Стрелки перемещают выбранный предмет, Enter ставит его, R поворачивает на 90 градусов. Без выбранного предмета стрелки поворачивают комнату."></canvas>
      <div class="room-objective"><strong>${scenario==='work'?'Работаю из дома':'Ваша квартира'}</strong><span id="placed-count"></span><progress id="room-progress" max="3" value="0" aria-label="Выполненные задания" ${scenario==='free'?'hidden':''}></progress></div>
      <div class="walk-controls" role="group" aria-label="Движение персонажа" hidden>${[['↑','up','Идти вперёд'],['←','left','Идти влево'],['↓','down','Идти назад'],['→','right','Идти вправо']].map(([symbol,key,label])=>`<button type="button" class="room-tool walk-direction walk-${key}" data-walk="${key}" aria-label="${label}">${symbol}</button>`).join('')}</div>
      <p class="walk-hint" hidden>Прогулка · WASD / стрелки<br>Мебель можно расставлять прямо сейчас</p>
      ${action('Поставить сюда','suggested','','room-spot','id="room-suggestion" hidden')}
      <div class="room-item-tools" role="group" aria-label="Выбранный предмет">
        ${action('Повернуть на 90° · R','rotate','','room-tool','id="rotate-piece" aria-keyshortcuts="R"')}
        ${action('Убрать в набор','remove','','room-tool','id="remove-piece" hidden')}
        ${action('Действия','item-menu','','room-tool')}
        ${action('Свободный курсор','cancel-piece','','room-tool')}
      </div>
      <div class="room-view-tools" role="group" aria-label="Камера">${[
        ['−','zoom-out','Отдалить'],['+','zoom-in','Приблизить'],['↶','rotate-left','Повернуть влево'],['↷','rotate-right','Повернуть вправо'],['3D','perspective','Объёмный вид'],['План','top','Вид сверху']
      ].map(([symbol,key,label])=>action(symbol,'view',key,'room-tool',`aria-label="${label}" title="${label}" ${key==='top'||key==='perspective'?`aria-pressed="${key==='perspective'}"`:''}`)).join('')}</div>
    </div>
    <p class="camera-help">ЛКМ по мебели — выбрать или перенести · ЛКМ по пустому месту — вращение · ПКМ — действия с мебелью · Колёсико — масштаб, зажатое — перемещение · R — поворот · Esc — свободный курсор</p>
    <p class="plan-caption" id="plan-caption"></p></section></div></section>`;
  const marker = root.querySelector('#room-suggestion');
  scene = ApartmentRoom.mount(root.querySelector('.room-canvas'),()=>state,point=>{
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
  const completed=ApartmentScenarios.evaluate(state);
  const done=Object.values(completed).filter(Boolean).length;
  const walkButton=root.querySelector('#walk-mode');
  walkButton.textContent=state.walking?'Вернуться к конструктору':'Прогулка по квартире';
  walkButton.setAttribute('aria-pressed',String(Boolean(state.walking)));
  root.querySelector('.walk-controls').hidden=!state.walking;
  root.querySelector('.walk-hint').hidden=!state.walking;
  root.querySelector('.room-viewport').classList.toggle('is-walking',Boolean(state.walking));
  root.querySelector('.camera-help').textContent=state.walking?'WASD / стрелки — идти · ЛКМ по пустому месту — камера · Выберите мебель слева и кликните по полу · R — поворот · ПКМ — действия':'ЛКМ по мебели — выбрать или перенести · ЛКМ по пустому месту — вращение · ПКМ — действия с мебелью · Колёсико — масштаб, зажатое — перемещение · R — поворот · Esc — свободный курсор';
  root.querySelector('#scenario-score').textContent=ApartmentScenarios.score(state)+' баллов';
  if(state.scenario==='work'){
    for(const task of ApartmentScenarios.tasks){
      const card=root.querySelector('#task-'+task.id), active=completed[task.id];
      card.classList.toggle('is-complete',active);
      card.querySelector('.task-check').textContent=active?'✓':'○';
      card.querySelector('.task-state').textContent=active?'Выполнено':state.earned[task.id]?'Баллы получены · мебель изменена':'Пока не выполнено';
      card.querySelector('.task-points').textContent=state.earned[task.id]?'100 получено':'+100';
    }
    root.querySelector('#task-notice').textContent=gained.map(task=>task.title+': +'+task.points+' баллов!').join(' ');
  }
  root.querySelector('#plan-caption').innerHTML=`Упрощённая игровая адаптация. Площадь в источнике — ${plan.area.toLocaleString('ru-RU')} м². <a href="${plan.source}" target="_blank" rel="noopener noreferrer">Исходная схема ИНГРУПП ↗</a>`;
  for(const button of root.querySelectorAll('[data-action="plan"]'))button.setAttribute('aria-pressed',button.dataset.value===state.plan);
  for(const button of root.querySelectorAll('[data-action="group"]'))button.setAttribute('aria-pressed',groups[Number(button.dataset.value)]===group);
  root.querySelector('.room-item-tools').hidden=!selected;
  root.querySelector('#rotate-piece').disabled=!selected;
  root.querySelector('#mobile-rotate-piece').disabled=!selected;
  root.querySelector('#mobile-selected-piece').textContent=selected?pieces[selected].title:'Выберите предмет мебели';
  root.querySelector('#remove-piece').hidden=selectionMode!=='edit';
  root.querySelector('#remove-piece').textContent='Удалить предмет';
  root.querySelector('#placed-count').textContent = state.scenario==='work'?done+' из 3 заданий':count+' предметов';
  root.querySelector('#room-progress').value = done;
  root.querySelector('#room-suggestion').setAttribute('aria-label',selected?'Поставить сюда: '+pieces[selected].title:'Поставить сюда');
  root.querySelector('#finish-room').disabled = count===0;
  const feedback = root.querySelector('#room-feedback');
  feedback.textContent = status;
  feedback.classList.toggle('is-retry', status.startsWith('Здесь тесно.'));
  feedback.classList.toggle('is-success', status.startsWith('Квартира готова.'));
  for(const button of root.querySelectorAll('[data-action="piece"]')) {
    const key=button.dataset.value;
    button.setAttribute('aria-pressed',key===selected);
    button.classList.toggle('placed',Boolean(state.placed[key]));
    button.hidden=group!=='Вся мебель'&&pieces[key].group!==group;
    button.querySelector('.piece-mark').textContent=state.placed[key]?'✓':'+';
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
  selected=key;
  selectionMode=mode;state.active=mode==='edit'?key:null;state.hovered=null;
  state.suggestion=mode==='place'?ApartmentScenarios.suggestion(key,state):null;
  const point=mode==='place'&&state.suggestion;
  state.ghost=point?{key,point}:null;
}

function choose(key) {
  closeContext();
  selectPiece(key);
  if(group!=='Вся мебель')group=pieces[key].group;
  status=selectionMode==='edit'?'Выбран предмет «'+pieces[key].title+'». Перетащите его, нажмите R для поворота или ПКМ для действий.':state.suggestion?'Выбран предмет «'+pieces[key].title+'». Нажмите «Поставить сюда» или перетащите его.':'На полу мало места. Уберите предмет или выберите меньший вариант.';
  refresh();
}

function locate(event) {
  const rect = root.querySelector('canvas').getBoundingClientRect();
  const x=event.clientX-rect.left, y=event.clientY-rect.top;
  return {x,y,inside:x>=0&&x<=rect.width&&y>=0&&y<=rect.height};
}

function drop(point) {
  if(!selected||!point)return;
  const key=selected;
  if(fits(key,point,state)) {
    state.placed[key]=point;
    const editing=selectionMode==='edit';
    selectPiece(editing?key:null);
    status='Предмет на месте. Курсор свободен для выбора мебели и вращения сцены.';
  } else {
    status='Здесь тесно. Выберите свободный участок пола или нажмите «Поставить сюда».';
    state.ghost = selectionMode==='edit'?null:{key,point};
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
  const point=nearHint?[...state.suggestion]:position.map(value=>Math.round(value*100)/100);
  state.ghost={key:selected,point};
  scene.schedule();
  return point;
}

root.addEventListener('pointerdown',event=>{
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
  const start=[event.clientX,event.clientY];
  const {x,y}=locate(event);
  const hit=canvas&&selectionMode!=='place'?scene.hit(x,y):null;
  const key=piece?.dataset.value||hit||selected;
  gesture={id:event.pointerId,start,last:start,offset:[0,0],type:piece?'tray':hit?'object':'canvas',invertX:true};
  if(piece || hit) choose(key);
  if(hit) {
    const floor=scene.pixelToFloor(x,y);
    if(floor) gesture.offset=state.placed[hit].map((value,i)=>value-floor[i]);
  }
  (piece||canvas).setPointerCapture(event.pointerId);
});

root.addEventListener('pointermove',event=>{
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
  if(gesture.type==='orbit')scene.rotate((event.clientX-lastX)*.008*(gesture.invertX?-1:1),(event.clientY-lastY)*.006);
  else if(gesture.type==='pan')scene.pan(event.clientX-lastX,event.clientY-lastY);
  else movePreview(event);
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
    submenu.innerHTML=`<strong>Заменить на</strong>${order.map(key=>action(pieces[key].title,'replace-piece',key,'context-action',state.placed[key]?'disabled':'')).join('')}`;
    const rect=menu.getBoundingClientRect();menu.append(submenu);positionContext(rect.left,rect.top);
  }
  if(name==='item-menu'&&selected){
    const button=root.querySelector('[data-action="item-menu"]'),rect=button.getBoundingClientRect();
    openContext(rect.left,rect.bottom,selectionMode==='edit'?selected:null);
  }
  if(name==='fullscreen')toggleFullscreen();
  if(name==='scenarios')modal('Выберите сценарий',`<p>Расстановка мебели и заработанные баллы сохранятся.</p>${scenarioChoices()}`);
  if(name==='scenario'&&['work','free'].includes(value)){
    Game.close();startStudio(value);root.focus({preventScroll:true});
  }
  if(name==='task'){
    const task=ApartmentScenarios.tasks.find(item=>item.id===value);
    if(task){
      const key=task.id==='break'&&['sofa','loveseat','armchair'].some(item=>state.placed[item])?'coffee':task.piece;
      choose(key);
      status=task.detail+' Подсказка на полу предлагает подходящее свободное место, если оно есть.';
      refresh();
      root.querySelector('.room-canvas').scrollIntoView({block:'center',behavior:'smooth'});
      root.querySelector('.room-canvas').focus({preventScroll:true});
    }
  }
  if(name==='piece'&&!suppressPieceClick) choose(value);
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
    state.plan=value;
    const returned=[];
    for(const key of Object.keys(state.placed)){
      if(!fits(key,state.placed[key],state)){delete state.placed[key];returned.push(pieces[key].title.toLowerCase());}
    }
    closeContext();selectPiece(null);
    if(state.walking&&!ApartmentNavigation.spawn(state))state.walking=false;
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
    const summary=Object.keys(state.placed).map(key=>pieces[key].title).join(', ');
    const completed=ApartmentScenarios.evaluate(state);
    modal('Ваш вариант квартиры',reward({title:state.scenario==='work'?'Моя квартира для работы из дома':'Моя квартира',score:ApartmentScenarios.score(state),badge:'Автор планировки',
      detail:floorPlan(state).title+' · '+floorPlan(state).area.toLocaleString('ru-RU')+' м² · '+summary,
      extra:state.scenario==='work'?`<ul class="result-tasks">${ApartmentScenarios.tasks.map(task=>`<li>${completed[task.id]?'✓':'○'} ${task.title} · ${completed[task.id]?'выполнено':'не выполнено'}</li>`).join('')}</ul><p>Баллы сохраняются до начала нового прохождения.</p>`:'',
      cta:'Получить подборку похожих квартир'}));
  }
}});
