'use strict';
const ActivityKit=(()=>{
  const names={memory:'Найдите пары соседей',shopping:'Соберите покупки'};
  function launch(type,a){const {stage,status,win,s,bind,button,icon}=a,c=s.config;let locked=false;
    const later=(fn,ms)=>{const timer=setTimeout(()=>{if(a.alive())fn();},ms);s.cleanup.push(()=>clearTimeout(timer));};
    const shell=content=>stage('<div class="arcade-topline"><p>'+(type==='shopping'?'Купите точное количество товаров из списка.':'Найдите одинаковые пары.')+'</p></div>'+content);
    if(type==='memory'){
      let cards=a.shuffle(c.icons.flatMap((_,i)=>[i,i])),open=[],found=new Set();
      function render(){shell(`<div class="memory-grid">${cards.map((v,i)=>button(found.has(i)||open.includes(i)?icon(c.icons[v],v%6):'?',`card:${i}`,`memory-card ${found.has(i)?'matched':open.includes(i)?'face-up':''}`,`aria-label="Карточка ${i+1}${found.has(i)?', пара найдена':''}"`)).join('')}</div>`, `Откройте две карточки. Найдите ${c.pairCount} одинаковых пар.`);bind('card',i=>{i=+i;if(locked||found.has(i)||open.includes(i))return;open.push(i);render();if(open.length===2){if(cards[open[0]]===cards[open[1]]){open.forEach(n=>found.add(n));open=[];status('Пар найдено: '+found.size/2+' / '+c.pairCount);render();if(found.size===cards.length)win();}else{locked=true;later(()=>{open=[];locked=false;render();},750);}}});}render();
    }else if(type==='shopping'){InteractiveGames.shopping(a);
    }else throw new Error('Unknown activity: '+type);
  }
  return {names,launch};
})();
