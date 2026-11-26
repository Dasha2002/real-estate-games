'use strict';

const Game = (() => {
  const root = document.querySelector('#game');
  const modeRoot = document.querySelector('#mode');
  const dialog = document.querySelector('#dialog');
  let scrollLock=null;

  function action(label, name, value = '', classes = 'btn', attributes = '') {
    return `<button type="button" class="${classes}" data-action="${name}" data-value="${value}" ${attributes}>${label}</button>`;
  }

  function progress(current, total, score, label = 'Прогресс', gained = 0) {
    return `<div><div class="stats"><span>${label} · ${current} / ${total}</span><span class="score" role="status">${score} баллов ${gained ? `<span class="gain">+${gained}</span>` : ''}</span></div><progress class="meter" value="${current}" max="${total}" aria-label="${label}"></progress></div>`;
  }

  function modal(title, content, kind='plain') {
    dialog.dispatchEvent(new CustomEvent('modal-replace',{detail:{kind}}));
    dialog.classList.add('game-modal');
    if(!scrollLock){scrollLock={y:window.scrollY,position:document.body.style.position,top:document.body.style.top,width:document.body.style.width};document.body.style.position='fixed';document.body.style.top=-scrollLock.y+'px';document.body.style.width='100%';document.body.classList.add('modal-open');}
    dialog.setAttribute('aria-label', title);
    dialog.innerHTML = `<div class="dialog-inner"><div class="dialog-top"><h2>${title}</h2><button class="icon-btn" aria-label="Закрыть" type="button" data-close>×</button></div>${content}</div>`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop=0;
  }

  dialog.addEventListener('close',()=>{if(dialog.open||!scrollLock)return;const lock=scrollLock;scrollLock=null;document.body.style.position=lock.position;document.body.style.top=lock.top;document.body.style.width=lock.width;document.body.classList.remove('modal-open');window.scrollTo(0,lock.y);});

  function close() {
    if (dialog.open) dialog.close();
  }

  function lead(title) {
    modal(title, `<p>Демонстрационная заявка. Достаточно выбрать удобное время.</p><form class="stack" id="demo-lead"><fieldset><legend>Удобное время</legend><label><input type="radio" name="time" value="Утро" required> Утро</label><label><input type="radio" name="time" value="День"> День</label><label><input type="radio" name="time" value="Вечер"> Вечер</label></fieldset><button class="btn" type="submit">Подтвердить демозаявку</button></form>`);
    dialog.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const time = new FormData(event.currentTarget).get('time');
      modal('Демозаявка принята', `<p>Вы выбрали время «${time.toLowerCase()}». Подтверждение сформировано на этом устройстве.</p><button class="btn" data-close type="button">Готово</button>`);
      dialog.querySelector('[data-close].btn').focus();
    });
  }

  function reward({ title, score, detail, badge = 'Знаток Горизонта', cta, extra = '' }) {
    return `<section class="panel reward stack"><div class="medal" aria-hidden="true">✦</div><h2>${title}</h2><p class="reward-score">${score} баллов · ${badge}</p><p>${detail}</p><div class="actions">${cta ? action(cta, 'lead', cta) : ''}${action('Пройти ещё раз', 'restart', '', cta ? 'btn secondary' : 'btn')}<a class="btn secondary" href="../index.html#games">К списку игр</a></div>${extra}</section>`;
  }

  function init({ modes = false, restart, onAction }) {
    let mode = 'buyer';

    function renderModes() {
      if (!modes) return;
      modeRoot.innerHTML = `<div class="mode" role="group" aria-label="Режим игры">${['buyer', 'agent'].map((key, i) => action(['Покупатель', 'Риэлтор'][i], 'mode', key, 'mode-btn', `aria-pressed="${key === mode}"`)).join('')}</div>`;
    }

    function handle(event) {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const {action: name, value} = button.dataset;
      if (name === 'mode') {
        if (value === mode) return;
        mode = value;
        close();
        renderModes();
        restart(mode);
        modeRoot.querySelector('[aria-pressed="true"]').focus();
      } else if (name === 'restart') {
        close();
        restart(mode);
        root.focus({preventScroll:true});
        root.scrollIntoView({block:'nearest'});
      } else if (name === 'lead') {
        lead(value);
      } else {
        onAction(name, value);
        if (!dialog.open && !button.isConnected && document.activeElement === document.body) {
          root.focus({preventScroll:true});
        }
      }
    }

    root.addEventListener('click', handle);
    modeRoot?.addEventListener('click', handle);
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('[data-close]')) close();
      else handle(event);
    });
    document.querySelector('#restart')?.addEventListener('click', () => {
      close();
      restart(mode);
      root.focus({preventScroll:true});
      root.scrollIntoView({block:'nearest'});
    });

    renderModes();
    restart(mode);
  }

  return {root, dialog, action, progress, modal, close, reward, init};
})();
