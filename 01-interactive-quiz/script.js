'use strict';
(() => {
  const levels=['Первое знакомство','Соседская жизнь','Мой идеальный дом'];
  const missions=[
    {title:'Сад за окном',type:'plant',desc:'Вскопайте клумбы, подберите семена и отмерьте воду.',icon:'♧',theme:'garden'},
    {title:'Знакомые лица',type:'memory',desc:'Запоминайте карточки и находите одинаковые пары.',icon:'◈',theme:'courtyard'},
    {title:'Открытка нового дома',type:'puzzle',desc:'Восстановите картинку из перемешанных фрагментов.',icon:'▧',theme:'courtyard'},
    {title:'Соседский ужин',type:'shopping',desc:'Купите точное количество продуктов, уложившись в бюджет.',icon:'▣',theme:'city'},
    {title:'Самый короткий путь',type:'route',desc:'Сравните три дороги и пройдите кратчайшую. Три раунда.',icon:'⌁',theme:'garden'},
    {title:'Команда нашего двора',type:'football',desc:'Забейте пять голов, учитывая силу удара, ветер и вратаря.',icon:'⚽',theme:'sports'},
    {title:'Мастерская квартала',type:'blocks',desc:'Заполните линии: три раунда по три разные раскладки.',icon:'▤',theme:'rainbow'},
    {title:'Тихий вечер',type:'circuit',desc:'Погасите фонари и подарите кварталу спокойную ночь.',icon:'☼',theme:'night'},
    {title:'Возвращение домой',type:'parking',desc:'Найдите проезд между машинами и аккуратно припаркуйтесь.',icon:'⌂',theme:'parking'}
  ];
  const key='horizon-living-missions-v1';let state,selectedLevel=0;
  function fresh(){return {day:Loyalty.day(),results:Array(9).fill(null)};}
  function load(){try{const s=JSON.parse(localStorage.getItem(key));state=s?.day===Loyalty.day()&&Array.isArray(s.results)&&s.results.length===9?s:fresh();}catch{state=fresh();}selectedLevel=unlocked();}
  function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
  function unlocked(){return !state.results.slice(0,3).every(Boolean)?0:!state.results.slice(3,6).every(Boolean)?1:2;}
  function amount(step){return [20,40,80][Math.floor(step/3)];}
  function total(){return state.results.reduce((sum,r,i)=>sum+(r?.done?amount(i):0),0);}
  function instructions(){Game.modal('Почувствуйте себя дома','<div class="welcome-cat">'+GameArt.icon('cat',3)+'</div><p>Три уровня, девять дел. Выполняйте задания и собирайте баллы. Любое дело можно пропустить.</p><div class="level-prizes"><span>Уровень 1 <b>20 Б</b></span><span>Уровень 2 <b>40 Б</b></span><span>Уровень 3 <b>80 Б</b></span></div><button class="btn" data-close>Начать приключение</button>');}
  function render(){const finished=state.results.every(Boolean),level=selectedLevel,done=state.results.filter(Boolean).length;document.body.classList.add('living-game','immersive-game');Game.root.innerHTML=`<div class="living-screen">${GameArt.scene()}<div class="living-shade"></div><header class="living-hud"><div><p class="eyebrow">ВАШ НОВЫЙ ДОМ</p><h1>Почувствуйте себя дома</h1></div><div class="living-score"><b>${total()} Б</b><span>За задания</span></div></header><nav class="living-levels" aria-label="Уровни игры">${levels.map((name,i)=>'<button data-level="'+i+'" '+(i>unlocked()?'disabled':'')+' class="living-level '+(i===level?'current':'')+' '+(state.results.slice(i*3,i*3+3).every(Boolean)?'completed':'')+'"><span>'+(i>unlocked()?'⌑':i+1)+'</span><div><b>'+name+'</b><small>'+[20,40,80][i]+' Б за задание</small></div><div class="level-dots">'+[0,1,2].map(j=>'<i class="'+(state.results[i*3+j]?.done?'done':state.results[i*3+j]?'skipped':'')+'"></i>').join('')+'</div></button>').join('')}</nav><section class="living-question"><div class="question-heading"><div><p class="eyebrow">УРОВЕНЬ ${level+1} ИЗ 3 · ${done} / 9 ДЕЛ</p><h2>${levels[level]}</h2></div><span class="question-reward">+${[20,40,80][level]} Б</span></div><p class="question-note">Выберите дело.</p><div class="living-choices">${missions.slice(level*3,level*3+3).map((m,j)=>{const i=level*3+j,r=state.results[i];return '<div class="living-mission-row"><button class="living-choice '+(r?'resolved':'')+'" data-mission="'+i+'"><span class="choice-icon">'+(r?.done?'✓':m.icon)+'</span><span class="choice-copy"><b>'+m.title+'</b></span><span class="choice-action">'+(r?'Ещё раз':'Играть')+'</span></button>'+(!r?'<button class="mission-skip" data-skip="'+i+'" aria-label="Пропустить: '+m.title+'">Пропустить · 0 Б</button>':'<small class="mission-result">'+(r.done?'Выполнено':'Пропущено без баллов')+'</small>')+'</div>';}).join('')}</div><div class="question-bottom"><span>Выполнено ${state.results.filter(r=>r?.done).length} / 9</span>${finished?'<button class="btn" data-shop>Выбрать награду</button>':level<unlocked()?'<button class="btn" id="next-living-level">Следующий уровень →</button>':'<span></span>'}</div>${finished?'<p class="living-final-note">Все дела выполнены. Ваш результат: '+total()+' Б.</p>':''}</section><div class="window-label"></div></div>`;document.querySelectorAll('[data-mission]').forEach(b=>b.onclick=()=>play(+b.dataset.mission));document.querySelectorAll('[data-skip]').forEach(b=>b.onclick=()=>skip(+b.dataset.skip));document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{selectedLevel=+b.dataset.level;render();});document.querySelector('#next-living-level')?.addEventListener('click',()=>{selectedLevel++;render();});}
  function play(step){if(Math.floor(step/3)>unlocked())return;const m=missions[step],practice=!!state.results[step];MiniGames.open({type:m.type,title:m.title,subtitle:m.desc,difficulty:Math.floor(step/3)+1,variant:step,theme:m.theme,context:'living',reward:practice?0:amount(step),onComplete:()=>{if(!practice)complete(step);else render();},onSkip:practice?undefined:()=>skip(step)});}
  function complete(step){if(state.results[step]||step>=9)return;const earned=Loyalty.award('living-missions-v1:'+state.day+':'+step,amount(step));state.results[step]={done:true};save();render();celebrate(earned);}
  function skip(step){if(state.results[step]||step>=9)return;state.results[step]={done:false};save();render();}
  function celebrate(earned){const el=document.createElement('div');el.className='living-celebration';el.innerHTML=`<strong>${earned?'+'+earned+' Б':'Задание выполнено'}</strong>${Array.from({length:18},(_,i)=>`<i style="--i:${i};--hue:${[45,130,180,260][i%4]}"></i>`).join('')}`;document.body.append(el);setTimeout(()=>el.remove(),1600);}
  load();render();document.querySelector('[data-rules]').onclick=instructions;
  Game.dialog.addEventListener('click',e=>{if(e.target===Game.dialog||e.target.closest('[data-close]'))Game.close();});
  document.querySelector('#restart').onclick=()=>{state=fresh();selectedLevel=0;save();render();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.day!==Loyalty.day()){Game.close();load();render();}});
  setInterval(()=>{if(state.day!==Loyalty.day()){Game.close();load();render();}},1000);
  instructions();
})();
