'use strict';
const ActivityKit=(()=>{
  const names={memory:'Найдите пары соседей',shopping:'Соберите покупки'};
  function launch(type,a){const {stage,status,win,s,bind,button,icon}=a,c=s.config;let locked=false;
    const later=(fn,ms)=>{const timer=setTimeout(()=>{if(a.alive())fn();},ms);s.cleanup.push(()=>clearTimeout(timer));};
    const shell=content=>stage('<div class="arcade-topline"><p>'+(type==='shopping'?'Купите точное количество товаров из списка.':'Найдите одинаковые пары.')+'</p></div>'+content);
    if(type==='memory'){
      let cards=a.shuffle(c.icons.flatMap((_,i)=>[i,i])),open=[],found=new Set();
      function render(){shell(`<div class="memory-grid">${cards.map((v,i)=>button(found.has(i)||open.includes(i)?icon(c.icons[v],v%6):'?',`card:${i}`,`memory-card ${found.has(i)?'matched':open.includes(i)?'face-up':''}`,`aria-label="Карточка ${i+1}${found.has(i)?', пара найдена':''}"`)).join('')}</div>`, `Откройте две карточки. Найдите ${c.pairCount} одинаковых пар.`);bind('card',i=>{i=+i;if(locked||found.has(i)||open.includes(i))return;open.push(i);render();if(open.length===2){if(cards[open[0]]===cards[open[1]]){open.forEach(n=>found.add(n));open=[];status('Пар найдено: '+found.size/2+' / '+c.pairCount);render();if(found.size===cards.length)win();}else{locked=true;later(()=>{open=[];locked=false;render();},750);}}});}render();
    }else if(type==='shopping'){
      let round=0,goods,list,budget,basket;
      function begin(){const cfg=ActivityVariants.build('shopping',s.seed+round*977,round*2+1,s.theme);goods=cfg.groceries.slice(0,round?8:6);list=a.shuffle(goods).slice(0,3+round).map((p,i)=>({id:p.id,qty:1+(round?((s.seed+i+round)%(round+1)):0)}));budget=list.reduce((sum,l)=>sum+goods.find(p=>p.id===l.id).price*l.qty,0)+15;basket=Object.fromEntries(goods.map(p=>[p.id,0]));render();}
      function render(){const cost=goods.reduce((sum,p)=>sum+p.price*basket[p.id],0);shell(`<div class="shopping-receipt"><b>Заказ ${round+1} / 3</b><ul>${list.map(l=>'<li class="'+(basket[l.id]===l.qty?'complete':'')+'">'+goods.find(p=>p.id===l.id).name+' × '+l.qty+(basket[l.id]===l.qty?' ✓':'')+'</li>').join('')}</ul><span>Бюджет ${budget} монет · Корзина ${cost}</span></div><div class="shopping-shelf">${goods.map(p=>'<article class="shelf-item '+(basket[p.id]?'selected':'')+'">'+icon(p.icon)+'<b>'+p.name+'</b><span>'+p.price+' монет / шт.</span><div class="cart-quantity">'+button('−','remove:'+p.id,'quiet','aria-label="Убрать '+p.name+'"')+'<strong>'+basket[p.id]+'</strong>'+button('+','buy:'+p.id,'toon-button','aria-label="Добавить '+p.name+'"')+'</div></article>').join('')}</div>${button('Оплатить покупки','check','btn')}`);bind('buy',id=>{basket[id]=Math.min(9,basket[id]+1);render();});bind('remove',id=>{basket[id]=Math.max(0,basket[id]-1);render();});bind('check',()=>{if(goods.every(p=>basket[p.id]===(list.find(l=>l.id===p.id)?.qty||0))&&cost<=budget){round++;if(round===3)win();else{status('Заказ собран. Следующий список!');begin();}}else status(cost>budget?'Превышен бюджет.':'Сверьте количество со списком.',true);});}begin();
    }else throw new Error('Unknown activity: '+type);
  }
  return {names,launch};
})();
