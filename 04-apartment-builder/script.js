'use strict';

const {root,action,reward,modal} = Game;
const {pieces,colors,fits,suggest,floorPlan} = ApartmentRoom;
const {plans} = ApartmentPlans;
function starterPieces(){return state.plan==='compact'?['bed','armchair','smallTable']:state.plan==='classic'?['bed','desk','table']:['sofa','bed','table'];}
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
let scene, state, selected, status, gesture, suppressPieceClick, group;

function glyph(key) {
  const symbol=icons[key]||icons[{sofa:'sofa',bed:'bed',desk:'desk',table:'table',coffee:'table',plant:'plant',storage:'storage',shelf:'shelf'}[pieces[key].type]];
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${symbol}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.65"/></svg>`;
}

function restart() {
  scene?.destroy();
  state = {plan:'family',palette:0,finish:0,placed:{},rotations:{},ghost:null,suggestion:null};
  group='Вся мебель';
  selectPiece('sofa');
  status='Начните с дивана. Нажмите «Поставить сюда» на полу или перетащите его.';
  gesture=null;
  suppressPieceClick=false;
  root.innerHTML = `<section class="apartment-studio" aria-label="Конструктор квартиры">
    <div class="room-configuration">
      <div class="plan-picker" role="group" aria-label="Планировка">${plans.map(plan=>action(`<strong>${plan.title}</strong><span>${plan.area.toLocaleString('ru-RU')} м²</span>`,'plan',plan.id,'plan-choice',`aria-pressed="${state.plan===plan.id}"`)).join('')}</div>
    </div>
    <div class="room-viewport">
      <canvas class="room-canvas" tabindex="0" aria-label="Объёмная квартира. Стрелки перемещают выбранный предмет, Enter ставит его. Без выбранного предмета стрелки поворачивают комнату."></canvas>
      <div class="room-objective"><strong>Обставьте квартиру</strong><span id="placed-count"></span><progress id="room-progress" max="3" value="0" aria-label="Разместите три предмета"></progress></div>
      ${action('Поставить сюда','suggested','','room-spot','id="room-suggestion" hidden')}
      <div class="room-item-tools" role="group" aria-label="Выбранный предмет">
        ${action('Повернуть предмет','rotate','','room-tool','id="rotate-piece"')}
        ${action('Убрать в набор','remove','','room-tool','id="remove-piece" hidden')}
      </div>
      <div class="room-view-tools" role="group" aria-label="Камера">${[
        ['↶','rotate-left','Повернуть влево'],['↷','rotate-right','Повернуть вправо'],['3D','perspective','Объёмный вид'],['План','top','Вид сверху']
      ].map(([symbol,key,label])=>action(symbol,'view',key,'room-tool',`aria-label="${label}" title="${label}" ${key==='top'||key==='perspective'?`aria-pressed="${key==='perspective'}"`:''}`)).join('')}</div>
    </div>
    <div class="furnishing-bar">
      <div class="furnishing-intro"><strong>Мебель</strong><p class="room-feedback" id="room-feedback" role="status"></p></div>
      <div class="furniture-categories" role="group" aria-label="Категория мебели">${groups.map((label,i)=>action(label,'group',i,'quiet',`aria-pressed="${i===0}"`)).join('')}</div>
      <div class="furnishing-tools"><div class="furniture-tray" role="group" aria-label="Мебель">${order.map(key=>action(`${glyph(key)}<span>${pieces[key].title}</span><i class="piece-mark" aria-hidden="true"></i>`,'piece',key,'furniture-button','aria-pressed="false" draggable="false"')).join('')}</div>
        ${action('Посмотреть результат','result','','btn','id="finish-room" disabled')}
      </div>
      </div>
    <details class="room-preferences"><summary>Цвет и отделка</summary>
      <div class="room-options">
      ${optionGroup('Палитра','palette',['Песок','Глина','Шалфей'],0,colors.map(palette=>palette.wallSide))}
      ${optionGroup('Отделка','finish',['Минимализм','Классика','Лофт'])}
      </div>
    </details><p class="plan-caption" id="plan-caption"></p></section>`;
  const marker = root.querySelector('#room-suggestion');
  scene = ApartmentRoom.mount(root.querySelector('.room-canvas'),()=>state,point=>{
    marker.hidden=!point;
    if(point){
      marker.style.left=point[0]+'px';
      marker.style.top=point[1]+'px';
    }
  });
  refresh();
}

function optionGroup(label,field,labels,offset=0,swatches=[]) {
  return `<div><p>${label}</p><div class="room-values" role="group" aria-label="${label}">${labels.map((name,i)=>action(`${swatches[i]?`<span class="swatch" style="--swatch:${swatches[i]}" aria-hidden="true"></span>`:''}${name}`, 'setting',field+':'+(i+offset),'quiet',`aria-pressed="${state[field]===i+offset}"`)).join('')}</div></div>`;
}

function refresh() {
  const count = Object.keys(state.placed).length;
  const plan=floorPlan(state);
  root.querySelector('#plan-caption').innerHTML=`Упрощённая игровая адаптация. Площадь в источнике — ${plan.area.toLocaleString('ru-RU')} м². <a href="${plan.source}" target="_blank" rel="noopener noreferrer">Исходная схема ИНГРУПП ↗</a>`;
  for(const button of root.querySelectorAll('[data-action="plan"]'))button.setAttribute('aria-pressed',button.dataset.value===state.plan);
  for(const button of root.querySelectorAll('[data-action="group"]'))button.setAttribute('aria-pressed',groups[Number(button.dataset.value)]===group);
  root.querySelector('.room-item-tools').hidden=!selected;
  root.querySelector('#rotate-piece').disabled=!selected;
  root.querySelector('#remove-piece').hidden=!selected||!state.placed[selected];
  root.querySelector('#placed-count').textContent = count<3?count+' из 3 предметов':'Цель выполнена · '+count*20+' баллов';
  root.querySelector('#room-progress').value = Math.min(count,3);
  root.querySelector('#room-suggestion').setAttribute('aria-label',selected?'Поставить сюда: '+pieces[selected].title:'Поставить сюда');
  root.querySelector('#finish-room').disabled = count<3;
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
  scene.schedule();
}

function selectPiece(key) {
  selected=key;
  state.suggestion=key?suggest(key,state):null;
  const point=key && (state.placed[key]||state.suggestion);
  state.ghost=point?{key,point}:null;
}

function choose(key) {
  selectPiece(key);
  if(group!=='Вся мебель')group=pieces[key].group;
  status=state.suggestion?'Выбран предмет «'+pieces[key].title+'». Нажмите «Поставить сюда» или перетащите его.':'На полу мало места. Уберите предмет или выберите меньший вариант.';
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
    const count = Object.keys(state.placed).length;
    const nextKey=count<3?starterPieces().find(item=>!state.placed[item]):null;
    selectPiece(nextKey);
    if(nextKey&&group!=='Вся мебель')group=pieces[nextKey].group;
    status=nextKey?'Предмет на месте. Теперь поставьте «'+pieces[nextKey].title+'».':'Квартира готова. Нажмите «Посмотреть результат» или добавьте ещё предметы.';
  } else {
    status='Здесь тесно. Выберите свободный участок пола или нажмите «Поставить сюда».';
    state.ghost = {key,point};
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
  if(event.button!==0||gesture)return;
  const piece=event.target.closest('[data-action="piece"]');
  const canvas=event.target.closest('canvas');
  if(!piece&&!canvas)return;
  const start=[event.clientX,event.clientY];
  const {x,y}=locate(event);
  const hit=canvas&&!selected?scene.hit(x,y):null;
  const key=piece?.dataset.value||hit||selected;
  gesture={id:event.pointerId,start,last:start,offset:[0,0],type:piece?'tray':key?'place':'orbit'};
  if(piece || hit) choose(key);
  if(hit) {
    const floor=scene.pixelToFloor(x,y);
    if(floor) gesture.offset=state.placed[hit].map((value,i)=>value-floor[i]);
  }
  (piece||canvas).setPointerCapture(event.pointerId);
});

root.addEventListener('pointermove',event=>{
  if(gesture?.id!==event.pointerId) {
    if(event.pointerType==='mouse'&&event.target.matches('.room-canvas')&&selected)movePreview(event);
    return;
  }
  const [lastX,lastY]=gesture.last;
  if(gesture.type==='orbit')scene.rotate((event.clientX-lastX)*.008,(event.clientY-lastY)*.006);
  else movePreview(event);
  gesture.last=[event.clientX,event.clientY];
});

root.addEventListener('pointerup',event=>{
  if(gesture?.id!==event.pointerId)return;
  const {type,start}=gesture;
  if(type==='tray'&&Math.hypot(event.clientX-start[0],event.clientY-start[1])>6) {
    suppressPieceClick=true;
    setTimeout(()=>{suppressPieceClick=false;},0);
  }
  const point=type==='orbit'?null:movePreview(event);
  gesture=null;
  if(point)drop(point);
});
root.addEventListener('pointercancel',event=>{if(gesture?.id===event.pointerId)gesture=null;});
root.addEventListener('keydown',event=>{
  if(!event.target.matches('.room-canvas'))return;
  const offset={ArrowLeft:[-.25,0],ArrowRight:[.25,0],ArrowUp:[0,-.25],ArrowDown:[0,.25]}[event.key];
  if(event.key==='Escape'&&selected){selectPiece(null);status='Перемещение отменено. Выберите предмет в наборе.';refresh();return;}
  if(event.key==='Enter'&&state.ghost){event.preventDefault();drop(state.ghost.point);return;}
  if(!offset)return;
  event.preventDefault();
  if(state.ghost) {
    state.ghost.point=state.ghost.point.map((value,i)=>value+offset[i]);
    scene.schedule();
  } else scene.rotate(offset[0],offset[1]*.6);
});
root.addEventListener('wheel',event=>{
  if(!event.target.matches('.room-canvas')||!event.ctrlKey)return;
  event.preventDefault();scene.scaleBy(event.deltaY>0?-.08:.08);
},{passive:false});

Game.init({restart,onAction(name,value){
  if(name==='piece'&&!suppressPieceClick) choose(value);
  if(name==='suggested'&&state.suggestion) drop(state.suggestion);
  if(name==='group'){
    group=groups[Number(value)];
    refresh();
  }
  if(name==='rotate'&&selected){
    const rotation=((state.rotations[selected]||0)+1)%4;
    if(state.placed[selected]&&!fits(selected,state.placed[selected],state,rotation)){
      status='После поворота предмет перекроет стену, дверь или окно. Сначала подвиньте его.';
    }else{
      state.rotations[selected]=rotation;
      state.suggestion=suggest(selected,state);
      status='Предмет повёрнут. Выберите место на полу.';
    }
    refresh();
  }
  if(name==='remove'&&selected){
    delete state.placed[selected];
    selectPiece(selected);
    status='Предмет возвращён в набор. Можно поставить его в другом месте.';
    refresh();
  }
  if(name==='plan'){
    state.plan=value;
    const returned=[];
    for(const key of Object.keys(state.placed)){
      if(!fits(key,state.placed[key],state)){delete state.placed[key];returned.push(pieces[key].title.toLowerCase());}
    }
    selectPiece(starterPieces().find(key=>!state.placed[key])||null);
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
      scene.setView(value==='top');
      for(const button of root.querySelectorAll('.room-tool[aria-pressed]')){
        button.setAttribute('aria-pressed',button.dataset.value===value);
      }
    }
    else scene.rotate(value==='rotate-left'?-.22:.22,0);
  }
  if(name==='result'&&Object.keys(state.placed).length>=3) {
    const summary=Object.keys(state.placed).map(key=>pieces[key].title).join(', ');
    modal('Ваша квартира собрана',reward({title:'Ваша квартира собрана',score:Object.keys(state.placed).length*20,badge:'Автор планировки',
      detail:floorPlan(state).title+' · '+floorPlan(state).area.toLocaleString('ru-RU')+' м² · '+summary,
      cta:'Получить подборку похожих квартир'}));
  }
}});
