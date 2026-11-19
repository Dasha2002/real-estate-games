'use strict';
// Shared browser-local economy. Award IDs prevent repeated payouts after restarts.
const Loyalty = (() => {
  const key = 'horizon-play-wallet-v1';
  let memory = {balance:0, earned:0, claims:{}, rewards:[]};
  function read() { try { const v=JSON.parse(localStorage.getItem(key)); if(v && Number.isFinite(v.balance)&&v.balance>=0&&v.claims&&Array.isArray(v.rewards)) memory=v; } catch {} return memory; }
  function save(v) { memory=v; try {localStorage.setItem(key,JSON.stringify(v));} catch {} window.dispatchEvent(new Event('wallet-change')); }
  function day(date=new Date()) { return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-'); }
  function award(id,amount) { const v=read(); if(v.claims[id]||amount<0)return 0; v.claims[id]=true; v.balance+=amount; v.earned+=amount; save(v); return amount; }
  function spend(amount) { const v=read(); if(amount<0||v.balance<amount)return false; v.balance-=amount; save(v); return true; }
  const offers=[['coffee','Кофе на прогулке',100,'Демокупон на напиток в кофейне квартала.'],['tour','Семейный выходной',250,'Демокупон на мастер-класс для двоих.'],['home','Подарок для нового дома',500,'Демокупон на набор для новосёла.']];
  function shop() {
    const v=read();
    const coupons=v.rewards.map(r=>`<p class="coupon">${offers.find(o=>o[0]===r.id)?.[1]||'Награда'} · ${r.code}</p>`).join('');
    Game.modal('Магазин наград',`<p>Ваш баланс: <strong>${v.balance} баллов</strong>. Награды демонстрационные, условия для клиентов определяет девелопер.</p><div class="shop-offers">${offers.map(([id,title,cost,desc])=>`<article class="shop-offer"><h3>${title}</h3><p>${desc}</p><button class="btn" data-buy="${id}" ${v.balance<cost?'disabled':''}>Обменять · ${cost} Б</button></article>`).join('')}</div>${coupons?'<h3>Ваши купоны</h3>'+coupons:''}`);
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-shop]'))shop();
    const b=e.target.closest('[data-buy]'); if(!b)return;
    const offer=offers.find(o=>o[0]===b.dataset.buy); const v=read(); if(!offer||v.balance<offer[2])return;
    v.balance-=offer[2]; v.rewards.push({id:offer[0],code:'DEMO-'+Date.now().toString(36).toUpperCase()+'-'+(v.rewards.length+1)}); save(v); shop();
  });
  function update() {document.querySelectorAll('[data-balance]').forEach(n=>n.textContent=read().balance+' Б');}
  window.addEventListener('wallet-change',update); window.addEventListener('storage',update);
  document.body.classList.add('play-universe');
  const bar=document.createElement('div');bar.className='playbar';bar.innerHTML='<a href="../index.html#games" class="play-home">ГОРИЗОНТ <b>/ PLAY</b></a><span class="play-season">Сезон добрососедства</span><button class="quiet" data-rules>Как играть</button><button class="wallet-button" data-shop><span data-balance>0 Б</span><span>Награды</span></button>';document.body.prepend(bar);update();
  document.querySelector('[data-rules]').onclick=()=>Game.modal('Горизонт / Play','<p>Выполняйте задания в играх и обменивайте общие баллы на демонаграды.</p><button class="btn" data-close>Понятно</button>');
  // Each game owns its opening instructions and reward schedule.
  return {read,award,spend,day,shop};
})();
