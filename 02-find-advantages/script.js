'use strict';

const places = [
  ['yard','Закрытый двор','Двор отдан пешеходам. Автомобили жителей размещаются в подземном паркинге.','Как показать преимущество двора семье?', ['Провести от лобби до площадки по двору','Пообещать, что во дворе никогда не будет шума','Указать только площадь двора'],0,'Короткий маршрут показывает, как устроен повседневный путь с ребёнком.'],
  ['play','Детская площадка','Во дворе есть площадка для игр с местом отдыха рядом.','Что лучше сделать на семейном показе?', ['Описать цвет оборудования','Показать площадку и место, где взрослые могут подождать','Пообещать присмотр за детьми'],1,'Покупателю проще оценить площадку, когда он видит, где играют дети и где можно посидеть.'],
  ['sport','Спортивная зона','Во дворе предусмотрена отдельная площадка для занятий спортом.','Что сказать любителю спорта?', ['Обещать бесплатного тренера','Говорить только о фасаде','Уточнить, чем он занимается, и показать площадку'],2,'Свяжите аргумент с привычками человека и покажите доступное пространство.'],
  ['parking','Подземный паркинг','Въезд в паркинг находится с внешней стороны квартала.','Как объяснить связь парковки и двора?', ['Показать, где заезжают машины и как проходят пешеходы','Обещать место в подарок','Советовать парковаться у площадки'],0,'Раздельные маршруты хорошо видны на плане и во время экскурсии.'],
  ['garden','Озеленение','Деревья, клумбы и скамейки образуют отдельную зону отдыха.','Как рассказать про зелень?', ['Назвать растения, которых нет в проекте','Пройти по дорожке и показать место для отдыха','Пообещать абсолютную тишину'],1,'Маршрут и место отдыха конкретнее обещаний о тишине.'],
  ['lobby','Входная группа','Светлое лобби связывает корпуса с дворовыми дорожками.','Что показать, когда речь заходит о входе?', ['Только дверную ручку','Вид с крыши','Путь от входа к лифту и во двор'],2,'Покупатель сможет представить ежедневный путь домой.'],
  ['shops','Сервисы на первых этажах','Помещения на первом этаже предназначены для коммерческой инфраструктуры.','Как говорить о будущих сервисах?', ['Объяснить назначение помещений и уточнить, кто уже известен','Гарантировать конкретную сеть','Пообещать скидки на все покупки'],0,'Назначение помещений известно. Состав арендаторов стоит подтверждать отдельно.']
];

const regions = [[34,84,13,13],[7,52,27,27],[67,15,22,28],[85,73,14,26],[34,34,24,24],[3,24,14,27],[49,67,35,17]];
const clues = ['Калитка и ограда у пешеходного входа','Горка и качели на оранжевом покрытии','Синяя площадка с белой разметкой','Рампа, уходящая под землю','Цветник, вокруг которого огибается дорожка','Высокие стеклянные двери в корпус','Терраса с полосатыми зонтиками'];
const {root,action,progress,reward} = Game;
let mode, found, trained, active, revealed, response, notice;

function restart(nextMode) {
  mode=nextMode;
  found=new Set();
  trained=new Map();
  active=null;
  revealed=false;
  response=null;
  notice='';
  render();
}

function render(focus) {
  const training = mode==='agent';
  const finished = training ? trained.size===places.length : found.size===places.length;
  const score = found.size*20+[...trained.values()].filter(Boolean).length*10;
  const panel = active===null ? '' : article(active);
  root.innerHTML = `<div class="map-layout secrets-layout"><div>
    <div class="secrets-toolbar">${progress(found.size,places.length,score,'Открыто секретов',notice.startsWith('+20')?20:0)}${action(revealed?'Скрыть подсветку':'Подсветить области','areas','','quiet',`aria-pressed="${revealed}"`)}</div>
    <div class="secret-board${revealed?' lit':''}"><img src="../assets/images/secrets.webp" alt="Вид сверху на дворовые дорожки, здания, спортивную площадку и террасу" width="1440" height="1080">
      ${places.map(([key,label],i)=>{
        const [x,y,w,h] = regions[i];
        const visible = found.has(i);
        return action(visible?'✓':'','discover',i,'secret-area'+(visible?' found':'')+(active===i?' selected':''),`style="--x:${x}%;--y:${y}%;--w:${w}%;--h:${h}%" aria-label="${visible?label:'Осмотреть область '+(i+1)}"`);
      }).join('')}
    </div>
    <p class="map-note" role="status">${notice||'Нажимайте прямо на детали рисунка. Подсветку можно включить, если нужна помощь.'}</p>
  </div>
  <div class="secret-sidebar stack">${finished?`<div class="secret-win">${reward({title:'Все секреты открыты',score:score+50,detail:'Вы нашли все семь объектов квартала.',cta:training?'':'Запросить подарок'})}</div>`:''}
  ${panel || (!finished?`<section class="panel stack secret-brief"><h2>Что скрыто во дворе?</h2><p>Найдите семь ориентиров на иллюстрации. Список подскажет, как они выглядят.</p></section>`:'')}
    ${!finished?`<section class="panel stack secret-diary"><h3>${training?`Аргументы · ${trained.size} / 7`:'Дневник находок'}</h3><ul>${places.map(([,label],i)=>`<li>${found.has(i)?action(`<span aria-hidden="true">✓</span> ${label}`,'journal',i,'journal-entry',`aria-current="${active===i}"`):`<span class="clue"><span aria-hidden="true">○</span> ${clues[i]}</span>`}</li>`).join('')}</ul></section>`:''}
  </div></div>`;
  if(focus) root.querySelector(focus)?.focus({preventScroll:!focus.startsWith('.reward')});
}

function article(i) {
  const [,label,description,query,options,key,reason] = places[i];
  const training = mode==='agent';
  const state = response===null?null:response===key;
  return `<section class="panel stack secret-feature appear" id="secret-card">
    <p class="eyebrow">Секрет ${i+1} из 7</p><h2>${label}</h2><p>${description}</p>
    ${training && !trained.has(i) && response===null ? `<h3>${query}</h3><div class="options">${options.map((option,index)=>action(option,'argument',index,'option')).join('')}</div>` : ''}
    ${training && trained.has(i) ? `<p class="feedback ${trained.get(i)?'is-success':'is-retry'}">${response!==null ? (state?'Удачный аргумент. ':'Подходящий аргумент: «'+options[key]+'». ') : ''}${reason}</p>` : ''}
  </section>`;
}

root.addEventListener('click',event=>{
  if(!event.target.closest('.secret-board')||event.target.closest('[data-action]')||found.size===places.length)return;
  root.querySelector('.secrets-layout .map-note').textContent='Здесь секрета нет. Осмотрите другую часть рисунка или включите подсветку областей.';
});

Game.init({modes:true,restart,onAction(name,value){
  if (name==='areas') {
    revealed=!revealed;
    render('[data-action="areas"]');
  }
  if(name==='discover'||name==='journal') {
    const i=Number(value);
    notice=found.has(i)?places[i][1]:'+20 · '+places[i][1];
    found.add(i);
    active=i;
    response=null;
    if(mode==='buyer'&&found.size===places.length)notice='Все секреты найдены.';
    else notice+=mode==='agent'&&!trained.has(i)?' · Ответьте на вопрос об этом месте.':' · Осмотрите другую часть карты.';
    render(mode==='buyer'&&found.size===places.length?'.reward .btn':`[data-action="${name}"][data-value="${value}"]`);
  }
  if(name==='argument'&&active!==null&&!trained.has(active)) {
    response=Number(value);
    const right=response===places[active][5];
    trained.set(active,right);
    notice=trained.size===places.length?'Все аргументы собраны.':right?'+10 · Удачный аргумент. Выберите другое место.':'Подходящий аргумент показан в карточке. Выберите другое место.';
    render(trained.size===places.length?'.reward .btn':'[data-action="discover"][data-value="'+active+'"]');
  }
}});
