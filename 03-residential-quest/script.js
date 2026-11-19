'use strict';

const locations = [
  ['Двор',48,86,'Пешеходная калитка ведёт к дорожкам, площадкам и входам в корпуса.'],
  ['Детская площадка',25,55,'Игровая площадка внутри двора. Рядом места для родителей.'],
  ['Спортивная зона',75,56,'Для игр с мячом предусмотрена отдельная площадка.'],
  ['Лобби',23,29,'Остеклённый вход соединяет корпус с пешеходным двором.'],
  ['Парковка',89,80,'У подземного паркинга свой въезд с внешнего проезда.'],
  ['Квартира',77,19,'В проекте предусмотрены квартиры с разным количеством комнат и кухнями-гостиными.'],
  ['Зона отдыха',50,28,'Под перголой можно отдохнуть в окружении зелени.']
];

const buyer = [
  ['Проложите путь из калитки','Ведите персонажа от калитки к лобби. На каждой развилке выбирайте пешеходную дорожку.'],
  ['Найдите три места для досуга','На карте найдите горку, баскетбольную площадку и перголу со скамейками.'],
  ['Забросьте мяч','Настройте угол и силу броска. Пунктир показывает, куда полетит мяч.'],
  ['Соберите вид из лобби','Нажмите на два фрагмента, чтобы поменять их местами. Соберите фотографию целиком.'],
  ['Поставьте машину на место','Проведите автомобиль от рампы до места P. Ведите по свободным клеткам через стрелки или нажатием на соседнюю клетку.'],
  ['Распределите комнаты','Выберите помещение и укажите, что разместить. Стол родителей нужен рядом с входом, детям — комнаты с окнами, общий ужин — рядом с кухней.'],
  ['Поставьте скамейку в тень','Выберите место для скамейки. Переведите время с полудня на 16:00 и проверьте, останется ли место в тени.']
];

const agent = [
  ['Объясните устройство двора','В чём практический смысл закрытого двора?',['Двор заменяет улицу для машин','Жители могут гулять по двору без автомобильного потока','В каждом дворе гарантирована абсолютная тишина'],1,'Покажите пешеходные маршруты по двору.'],
  ['Покажите маршрут семье','Как связать площадку с потребностью семьи?',['Показать путь от лобби до площадки и места для родителей','Обещать услуги няни','Описать только материалы оборудования'],0,'Маршрут даёт семье возможность оценить ежедневное использование.'],
  ['Свяжите площадку с привычками','Клиент говорит, что тренируется после работы. Что уточнить?',['Его зарплату','Сколько парковочных мест в доме','Каким спортом он занимается и как часто'],2,'Сначала уточните запрос, затем покажите подходящее место.'],
  ['Продемонстрируйте вход','Как показать ценность современной входной группы?',['Пообещать круглосуточного консьержа','Провести покупателя от входа к лифту и во двор','Обсудить только цвет стен'],1,'Повседневный маршрут понятнее описания отделки.'],
  ['Ответьте на возражение','«Если двор закрыт для машин, где я буду парковаться?»',['Покажу внешний въезд в подземный паркинг','Можно припарковаться у детской площадки','Машины оставляют у входа во двор'],0,'Покажите отдельный въезд и расскажите об условиях покупки места, когда они известны.'],
  ['Подберите аргументы для показа','Семье важны отдельные комнаты и место для общих ужинов. Что сравнить?',['Только этажи','Только площадь остекления','Планировки с отдельными комнатами и кухней-гостиной'],2,'Сценарий семьи определяет, какие планы стоит показать первыми.'],
  ['Пройдите финальный тест','Как подвести итог экскурсии клиенту, который любит гулять и отдыхать на свежем воздухе?',['Пообещать рост цены','Напомнить про двор без машин, зелёные дорожки и зону отдыха','Перечислить цвета фасада'],1,'Итог запоминается, когда преимущества отвечают потребностям этого покупателя.']
].map(([title,prompt,options,key,hint])=>({title,prompt,options,key,hint}));

const {root, action, modal, dialog, close, progress, reward} = Game;
const pathNodes = [[48,86],[40,73],[46,54],[34,40],[23,29],[87,81],[73,59]];
const safeRoute = [0,1,2,3,4];
const routeNames = ['Калитка','Дорожка у клумбы','По двору','Поворот к лобби','Лобби','К паркингу','На спортплощадку'];
const searchSpots = [0,1,2,4,6];
const searchTargets = [1,2,6];
const parkingLane = ['0,4','1,4','1,3','1,2','2,2','3,2','3,1','3,0','4,0'];
const rooms = ['Детская 1','Детская 2','Рабочий стол','Обеденный стол'];
const floorSpots = ['Окно на восток','Окно во двор','У входа','У кухни'];
const restSpots = [['Открытая дорожка',.03,.16],['Под перголой',.9,.82],['У дерева',.83,.22]];
let mode, next, selected, playing, complete, feedback, pathStep, findings, shot, pieces, tile, car, arrangement, spot, bench, clock;
let avatarPoint, avatarFacingRight, motion, routeError, feedbackTone, walkVersion = 0;
const betweenLocations = [[],[[47,45],[41,50]],[[46,48],[62,49]],[[56,46],[38,39]],[[48,54],[62,67],[73,73]],[[79,69],[80,44],[78,27]],[[71,24],[58,32]]];

function restart(nextMode) {
  walkVersion++;
  motion?.cancel();
  motion = null;
  avatarPoint = [...pathNodes[0]];
  avatarFacingRight = false;
  mode = nextMode;
  next = 0;
  selected = 0;
  playing = false;
  complete = false;
  render();
}

function begin() {
  playing = true;
  complete = false;
  report('');
  routeError = null;
  pathStep = 0;
  findings = new Set();
  shot = null;
  pieces = [1,0,2,3,4,7,6,5,8];
  tile = null;
  car = [0,4];
  arrangement = new Array(4).fill(null);
  spot = 0;
  bench = null;
  clock = 12;
  render(null,true);
}

function walk(points, arrived) {
  const token = ++walkVersion;
  const reducesMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const destination = points.at(-1);
  avatarFacingRight = destination[0]>avatarPoint[0];
  const path = [avatarPoint,...points];
  const legs = path.slice(1).map(([x,y],i)=>Math.hypot(x-path[i][0],y-path[i][1]));
  const length = legs.reduce((total,leg)=>total+leg,0);
  if (reducesMotion || length < .1) {
    avatarPoint = destination;
    arrived();
    return;
  }
  const sprite = (dialog.open ? dialog : root).querySelector('.quest-person');
  let walked = 0;
  const frames = path.map(([x,y],i)=>{
    if(i>0) walked+=legs[i-1];
    return {left:x+'%',top:y+'%',transform:'translate(-50%,-100%) scale('+(.68+y*.005)+')',offset:Math.min(1,walked/length)};
  });
  sprite.classList.add('walking');
  sprite.classList.toggle('face-right',avatarFacingRight);
  motion = sprite.animate(frames,{duration:Math.max(360,length*24),easing:'ease-in-out',fill:'forwards'});
  motion.finished.then(()=>{
    if(token!==walkVersion)return;
    avatarPoint = destination;
    motion=null;
    arrived();
  },()=>{});
}

function route(points) {
  return points.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ');
}

function curvedRoute(points) {
  if(points.length<3)return route(points);
  const commands=['M'+points[0].join(' ')];
  for(let i=1;i<points.length-1;i++){
    const prev=points[i-1],current=points[i],next=points[i+1];
    const enter=current.map((value,k)=>.82*value+.18*prev[k]);
    const exit=current.map((value,k)=>.82*value+.18*next[k]);
    commands.push('L'+enter.join(' ')+'Q'+current.join(' ')+' '+exit.join(' '));
  }
  return commands.join(' ')+' L'+points.at(-1).join(' ');
}

function routeMarkers() {
  const nextNode = safeRoute[pathStep+1];
  const guide = pathStep===0||routeError!==null;
  const position = i => `style="left:${pathNodes[i][0]}%;top:${pathNodes[i][1]}%"`;
  const arrow = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const cross = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const flag = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 17V3h10l-2 3 2 3H5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const marker = (i,label,classes,icon) => action(`${icon}<span class="route-label">${label}</span>`,'route',i,'pin route-node '+classes,`${position(i)} aria-label="${label}"`);
  const choices = complete?'':[
    marker(nextNode,guide&&pathStep===0?'Первый шаг':routeNames[nextNode],guide?'route-guide':'route-option',nextNode===4?flag:arrow),
    marker(pathStep%2===0?5:6,routeNames[pathStep%2===0?5:6],routeError!==null?'route-detour route-error':'route-detour',routeError!==null?cross:arrow)
  ].join('');
  return `${nextNode!==4&&!complete?`<span class="route-destination" ${position(4)}>${flag} Лобби</span>`:''}
    <span class="route-origin" ${position(pathStep)}>${pathStep===0?'Старт':complete?'Лобби':'Вы здесь'}</span>${choices}`;
}

function map(task = false) {
  const active = task && mode==='buyer' ? selected : -1;
  const isRoute = active===0;
  const isSearch = active===1;
  const tour = [[48,86],[48,72],[48,63],[25,55],[47,44],[75,56],[63,48],[47,43],[23,29],[55,65],[89,80],[82,59],[77,19],[50,28]];
  const trail = isRoute ? pathNodes.slice(pathStep,pathStep+2) : tour;
  const walked = isRoute ? pathNodes.slice(0,pathStep+1) : tour.slice(0,Math.max(1,Math.round(next/7*tour.length)));
  return `<div class="quest-map${isRoute?' quest-route-map':''}"><img src="../assets/images/quest.webp" alt="Двор «Горизонта» с площадками, лобби, парковкой и перголой" width="1440" height="1080">
  ${isSearch?'':`<svg class="route-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${curvedRoute(trail)}"/><path class="route-progress" d="${curvedRoute(walked)}"/></svg>`}
  ${isRoute ? routeMarkers()
    : isSearch ? searchSpots.map(i=>{
      const [,x,y] = locations[i];
      const done = findings.has(i);
      return action(done?'✓':'✧','find',i,'pin search-node'+(done?' done':''),`style="left:${x}%;top:${y}%" aria-label="Осмотреть точку ${i+1}" ${done?'disabled':''}`);
    }).join('')
    : locations.map(([name,x,y],i)=>action(i<next?'✓':i+1,'map-pin',i,'pin'+(i<next?' done':'')+(i===selected?' active':''),`style="left:${x}%;top:${y}%" aria-label="${name}${i>next?' (закрыто)':''}" ${i>next?'disabled':''}`)).join('')}
  <div class="quest-person${avatarFacingRight?' face-right':''}" style="left:${avatarPoint[0]}%;top:${avatarPoint[1]}%;--person-scale:${.68+avatarPoint[1]*.005}" aria-hidden="true"><i class="person-shadow"></i><img class="person-body" src="assets/quest-resident.webp" alt="" width="120" height="180"></div>
  </div>`;
}

function locator() {
  return `<details><summary>Маршрут дня</summary><div class="location-list">${locations.map(([label],i)=>action(`<span>${i<next?'✓':i+1}</span><span>${label}</span>${i>next?'<small>Закрыто</small>':''}`,'map-pin',i,'location',i>next?'disabled':'')).join('')}</div></details>`;
}

function render(focus, openTask = playing && dialog.open) {
  const [name,,,description] = locations[selected];
  const [title,prompt] = mode==='buyer'?buyer[selected]:[agent[selected].title,agent[selected].prompt];
  let side;
  if (next===locations.length) {
    side = reward({title:'День в Горизонте прожит',score:260,detail:'Семь локаций пройдены. Карточки объектов доступны на карте.',cta:mode==='buyer'?'Записаться на экскурсию':''});
  } else {
    side = `<section class="panel quest-side stack">${progress(next,locations.length,next*30,'Прогресс дня',next && !playing ? 30 : 0)}
      <div><p class="eyebrow">Локация ${next+1} · ${name}</p><h2>${title}</h2><p>${prompt}</p></div>
      <p class="quest-feature">${description}</p>
      ${action(playing?'Продолжить задание':'Начать задание','mission')}
      <div class="actions">${action('Карточка объекта','card',next,'quiet')}</div>${locator()}
    </section>`;
  }
  root.innerHTML = `<div class="map-layout quest-layout"><div>${map()}<p class="map-note">${next===0?'Начните с метки у калитки.':next<locations.length?`Следующая локация · ${locations[next][0]}. Нажмите на выделенную метку.`:'Нажмите на пройденную метку, чтобы открыть карточку места.'}</p></div>${side}</div>`;
  if (openTask) {
    const scroll = dialog.open ? (dialog.querySelector('.quest-task-content')?.scrollTop ?? 0) : 0;
    const mapTask = mode==='buyer'&&selected<2;
    dialog.classList.add('quest-task-dialog');
    dialog.classList.toggle('quest-map-dialog',mapTask);
    modal(title,`<div class="quest-task-content stack"><p>${prompt}</p>${mapTask?map(true):''}
      ${challenge()}</div>${taskFooter()}`);
    const body = dialog.querySelector('.quest-task-content');
    body.scrollTop = scroll;
    const focusTarget = routeError!==null&&selected===0&&mode==='buyer'?'.route-guide':focus || (mapTask&&selected===0?'.route-guide':null);
    if (focusTarget) {
      const button = dialog.querySelector(focusTarget);
      (button&&!button.disabled?button:dialog.querySelector('[data-close]'))?.focus({preventScroll:true});
    }
  } else if (focus) root.querySelector(focus)?.focus({preventScroll:true});
}

function taskFooter() {
  const tone = complete?'success':feedback?feedbackTone:'guide';
  const message = feedback || (mode==='agent'?'Выберите ответ.':[
    pathStep===0?'Нажмите пульсирующую метку «Первый шаг».':'Выберите дорожку к лобби на следующей развилке.',
    'Нажмите на точки на карте. Нужны три места.',
    'Выставьте угол и силу, затем нажмите «Бросить мяч».',
    'Выберите фрагмент, затем нажмите на место для обмена.',
    'Нажмите стрелку или свободную клетку рядом с машиной.',
    'Выберите свободное место на плане, затем предмет.',
    'Выберите место для скамейки и проверьте его в два времени дня.'
  ][selected]);
  const label = {success:'Задание выполнено · +30 баллов',retry:'Попробуйте ещё раз',progress:'На верном пути',guide:'Следующий шаг'}[tone];
  return `<div class="quest-task-footer ${tone}"><div class="quest-task-status" role="status"><strong>${label}</strong><p>${message}</p></div>
    ${complete?action(next===locations.length-1?'Посмотреть награду':'Продолжить маршрут','complete'):''}</div>`;
}

function challenge() {
  if (mode==='agent') return complete?'':`<div class="options">${agent[selected].options.map((option,i)=>action(option,'argument',i,'option')).join('')}</div>`;
  if (selected===0) return `<p class="quest-feature">Путь к лобби · ${pathStep} / ${safeRoute.length-1} участков</p>`;
  if (selected===1) return `<ul class="find-checklist">${searchTargets.map(i=>`<li>${findings.has(i)?'✓':'○'} ${locations[i][0]}</li>`).join('')}</ul>`;
  if (selected===2) return court();
  if (selected===3) return `<div class="tile-board">${pieces.map((part,i)=>action('', 'tile',i,'puzzle-tile',`style="--piece-x:${part%3*50}%;--piece-y:${Math.floor(part/3)*50}%" aria-label="Фрагмент ${part+1}, позиция ${i+1}" aria-pressed="${tile===i}" ${complete?'disabled':''}`)).join('')}</div>`;
  if (selected===4) return garage();
  if (selected===5) return apartment();
  return garden();
}

const courtLaunch = [34,153];
const courtRim = [264,65];

function court() {
  const angle = shot?.angle ?? 34;
  const power = shot?.power ?? 165;
  const path = shot?.path ?? shotTrajectory(angle,power).path;
  return `<div class="court">
    <div class="court-stage">
    <img src="assets/basketball-court.webp" alt="" width="960" height="540">
    <svg viewBox="0 0 320 180" role="img" aria-label="Траектория мяча на баскетбольной площадке">
      <defs>
        <radialGradient id="court-ball-light" cx="32%" cy="25%" r="75%">
          <stop stop-color="#ffca77"/><stop offset=".57" stop-color="#d97636"/><stop offset="1" stop-color="#77351c"/>
        </radialGradient>
        <g id="court-ball">
          <circle r="6" fill="url(#court-ball-light)" stroke="#572713" stroke-width=".55"/>
          <path d="M-5.95.7Q-.1-3.6 5.55 2.25M-2.7-5.35Q2.25-.65 1.75 5.73M-5.2-3Q-2 0-3.75 4.65" fill="none" stroke="#512411" stroke-width=".63"/>
        </g>
      </defs>
      <path data-trajectory d="${path}" fill="none" stroke="#fff0d0" stroke-width="1.65" stroke-linecap="round" stroke-dasharray="3 4.5"/>
      <use data-aim-ball href="#court-ball" x="${courtLaunch[0]}" y="${courtLaunch[1]}"${shot?' display="none"':''}/>
      ${shot?`<g data-shot-ball><animateMotion dur=".65s" path="${path}" fill="freeze"/><use href="#court-ball"/></g>`:''}
    </svg>
    </div>
    ${complete?'':`<form class="shot-form"><label>Угол <input id="aim" type="range" min="20" max="65" value="${angle}"><output for="aim">${angle}°</output></label><label>Сила <input id="power" type="range" min="145" max="235" value="${power}"><output for="power">${power}</output></label>${action('Бросить мяч','shoot')}</form>`}</div>`;
}

function shotTrajectory(angle,power) {
  const radians = angle*Math.PI/180;
  const flight = distance=>distance/(power*Math.cos(radians));
  const height = x=>153-power*Math.sin(radians)*flight(x)+51*flight(x)**2;
  const mouth = height(243);
  const basket = Math.abs(mouth-74)<=11 && height(250)>mouth;
  const points = [];
  const limit = basket ? 243 : 275;
  // Map the shot simulation to the launch point and rim in the court artwork.
  const [launchX,launchY] = courtLaunch;
  const [rimX,rimY] = courtRim;
  for(let x=0;;x=Math.min(x+5,limit)) {
    const t = basket ? Math.max(0,(x-168)/75) : 0;
    const y = height(x)+(74-mouth)*t*t*(3-2*t);
    points.push([launchX+(rimX-launchX)*x/243, rimY+(launchY-rimY)*(Math.min(161,y)-74)/79]);
    if(x===limit||(y>160&&x>10)) break;
  }
  return {path:route(points),basket,mouth};
}

function shotSettings() {
  return [Number(dialog.querySelector('#aim').value),Number(dialog.querySelector('#power').value)];
}

function shoot() {
  const [angle,power] = shotSettings();
  const {path,basket,mouth} = shotTrajectory(angle,power);
  shot = {angle,power,path};
  if (basket) win('Мяч в корзине. Для игр с мячом есть отдельная площадка.');
  else report(mouth>85?'Мяч не долетел до кольца. Увеличьте силу и бросьте снова.':'Мяч прошёл выше кольца. Уменьшите силу или измените угол, затем бросьте снова.');
}

function garage() {
  return `<div class="parking-board" aria-label="Парковка">${Array.from({length:25},(_,i)=>{
    const x=i%5,y=Math.floor(i/5),key=x+','+y;
    const free=parkingLane.includes(key);
    return action(car[0]===x&&car[1]===y?'▰':key==='4,0'?'P':key==='0,4'?'↱':'', 'drive-cell',key,'parking-cell'+(free?' lane':'')+(car.join(',')===key?' car':''),`aria-label="${free?'Проезд':'Стена'} ${x+1}, ${y+1}" ${free&&!complete?'':'disabled'}`);
  }).join('')}</div>${complete?'':`<div class="drive-tools" role="group" aria-label="Руль">${[['↑','0,-1','Вверх'],['←','-1,0','Влево'],['↓','0,1','Вниз'],['→','1,0','Вправо']].map(([glyph,offset,label])=>action(glyph,'drive',offset,'quiet',`aria-label="${label}"`)).join('')}</div>`}`;
}

function drive(x,y) {
  if (Math.abs(x-car[0])+Math.abs(y-car[1])!==1 || !parkingLane.includes(x+','+y)) {
    report('Туда не проехать. Выберите соседнюю свободную клетку.');
    return;
  }
  car = [x,y];
  report('');
  if (x===4 && y===0) win('Машина на месте. Въезд в паркинг отделён от двора.');
}

function apartment() {
  return `<div class="quest-floor" aria-label="План квартиры">${floorSpots.map((label,i)=>action(`<small>${label}</small><strong>${rooms[arrangement[i]]||'Свободно'}</strong>`,'room-spot',i,'room-spot',`aria-pressed="${i===spot}" ${complete?'disabled':''}`)).join('')}</div>
  ${complete?'':`<div class="room-tools">${rooms.map((label,i)=>action(label,'furnish',i,'quiet')).join('')}</div>${action('Проверить квартиру','check-rooms')}`}`;
}

function garden() {
  return `<div class="garden-model" style="--sun:${clock===12?'20%':'77%'}" aria-label="План зоны отдыха">
    <div class="garden-sun" aria-hidden="true">☀</div>${restSpots.map(([label,noon,later],i)=>action(`<span>${i===bench?'▰':'·'}</span><small>${label}</small>`,'bench',i,'garden-plot',`style="--shade:${clock===12?noon:later}" aria-pressed="${bench===i}" ${complete?'disabled':''}`)).join('')}</div>
    <div class="actions">${[12,16].map(time=>action(time+':00','sun',time,'quiet',`aria-pressed="${clock===time}"`)).join('')}</div>
    ${complete?'':action('Проверить место','check-shade','','btn',bench===null?'disabled':'')}`;
}

function report(message,tone='retry') {
  feedback = message;
  feedbackTone = tone;
}

function win(message) {
  complete = true;
  report(message,'success');
}

dialog.addEventListener('input', event=>{
  if (event.target.id==='aim' || event.target.id==='power') {
    event.target.parentElement.querySelector('output').value = event.target.value+(event.target.id==='aim'?'°':'');
    const {path} = shotTrajectory(...shotSettings());
    dialog.querySelector('[data-trajectory]').setAttribute('d',path);
    dialog.querySelector('[data-shot-ball]')?.remove();
    dialog.querySelector('[data-aim-ball]').removeAttribute('display');
    if(feedback){
      report('');
      dialog.querySelector('.quest-task-footer').outerHTML=taskFooter();
    }
  }
});

dialog.addEventListener('close',()=>{
  if(dialog.open||!dialog.classList.contains('quest-task-dialog'))return;
  dialog.classList.remove('quest-task-dialog','quest-map-dialog');
  walkVersion++;
  motion?.cancel();
  motion=null;
  if(playing)render('[data-action="mission"]',false);
});

Game.init({modes:true,restart,onAction(name,value){
  const i=Number(value);
  if (name==='card' || name==='map-pin'&&i<next) {
    const [label,,,description]=locations[i];
    modal(label,`<p>${description}</p><button data-close type="button" class="btn">Закрыть карточку</button>`);
    return;
  }
  if (motion) return;
  if (name==='mission' || name==='map-pin'&&i===next) {
    if(playing){render(null,true);return;}
    if (matchMedia('(max-width:790px)').matches) root.querySelector('.quest-map').scrollIntoView({block:'nearest'});
    const destination = locations[selected].slice(1,3);
    const points = next===0?[]:[...betweenLocations[selected],destination];
    if(points.length && Math.hypot(avatarPoint[0]-destination[0],avatarPoint[1]-destination[1])>.2) walk(points, begin);
    else begin();
    return;
  }
  if (name==='complete'&&complete) {
    dialog.classList.remove('quest-task-dialog','quest-map-dialog');
    close();
    next++;
    selected=Math.min(next,locations.length-1);
    playing=false;
    complete=false;
    render(next===locations.length?'.reward .btn':'[data-action="mission"]');
    return;
  }
  if (!playing) return;
  if (name==='sun') clock=i;
  if (complete && name!=='sun') return;
  if (name==='argument') {
    if (i===agent[selected].key) win(agent[selected].hint);
    else report(agent[selected].hint+' Выберите другой ответ.');
  }
  if (name==='route') {
    if (i===pathStep) return;
    if (i===safeRoute[pathStep+1]) {
      walk([pathNodes[i]],()=>{
        pathStep++;
        routeError=null;
        report('Путь открыт. Выберите следующий поворот к лобби.','progress');
        if(pathStep===4) win('Вы дошли до лобби по пешеходной дорожке.');
        render(complete?'[data-action="complete"]':'.route-option');
      });
      return;
    } else {
      routeError=i;
      report(i===5?'К паркингу ведёт автомобильный проезд. Нажмите подсвеченную метку во дворе.':'Спортплощадка в стороне от лобби. Нажмите подсвеченную метку на дорожке.');
    }
  }
  if (name==='find') {
    if (searchTargets.includes(i)) {
      findings.add(i);
      report('Открыто '+findings.size+' из 3. Осмотрите другую точку на карте.','progress');
      if (findings.size===3) win('Все три места отмечены на карте.');
    } else report('Здесь нет нужного места. Ищите горку, спортплощадку и перголу.');
  }
  if (name==='shoot') shoot();
  if (name==='tile') {
    if (tile===null) {tile=i;report('Теперь выберите второй фрагмент для обмена.','progress');}
    else {
      [pieces[i],pieces[tile]]=[pieces[tile],pieces[i]];
      tile=null;
      report('Фрагменты поменялись местами. Выберите следующую пару.','progress');
      if (pieces.every((part,pos)=>part===pos)) win('Вид собран. Лобби выходит к центральным дорожкам двора.');
    }
  }
  if (name==='drive') {
    const [dx,dy]=value.split(',').map(Number);
    drive(car[0]+dx,car[1]+dy);
  }
  if (name==='drive-cell') drive(...value.split(',').map(Number));
  if (name==='room-spot') {spot=i;report('Выберите предмет для зоны «'+floorSpots[i].toLowerCase()+'».','progress');}
  if (name==='furnish') {
    const previous=arrangement.indexOf(i);
    if(previous>=0) arrangement[previous]=null;
    arrangement[spot]=i;
    const empty=arrangement.indexOf(null);
    if(empty>=0) spot=empty;
    report(empty>=0?'Предмет размещён. Заполните оставшиеся места.':'Все места заполнены. Нажмите «Проверить квартиру».','progress');
  }
  if (name==='check-rooms') {
    if (arrangement[2]===2&&arrangement[3]===3&&[0,1].includes(arrangement[0])&&[0,1].includes(arrangement[1])) win('У каждого ребёнка своя комната, а рядом с кухней есть место для общих ужинов.');
    else report('Поменяйте расстановку: детские — у окон, рабочий стол — у входа, обеденный — у кухни.');
  }
  if (name==='bench') {bench=i;report('Переключите время или нажмите «Проверить место».','progress');}
  if (name==='check-shade') {
    if (restSpots[bench][1]>=.7&&restSpots[bench][2]>=.7) win('Под перголой скамейка остаётся в тени после обеда.');
    else report('Здесь солнечно в один из часов. Переставьте скамейку и проверьте другое место.');
  }
  render(complete?'[data-action="complete"]':`[data-action="${name}"][data-value="${value}"]`);
}});
