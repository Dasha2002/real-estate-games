'use strict';

const buyer = [
  ['Что важнее в новом доме?', ['Тишина и зелень','Всё нужное рядом','Простор для семьи'], [0,1,2], ['♧','⌂','◇']],
  ['Как вы проводите выходные?', ['Гуляю и читаю','Встречаюсь с друзьями','Устраиваю семейные обеды'], [0,1,2], ['☼','✳','◈']],
  ['Как часто вы пользуетесь машиной?', ['Редко, люблю ходить пешком','По необходимости','Почти каждый день'], [0,1,2], ['↝','↔','≋']],
  ['Чего ждёте от двора?', ['Тихой зоны отдыха','Места для спорта','Детской площадки'], [0,1,2], ['♧','↗','☆']],
  ['Какая планировка удобнее?', ['Отдельная спальня','Кухня-гостиная для встреч','Несколько отдельных комнат'], [0,1,2], ['▤','◫','⊞']],
  ['Как обычно начинается ваше утро?', ['Кофе и тишина','Забегаю в кофейню по пути','Собираемся всей семьёй'], [0,1,2], ['☕','▰','☼']]
];

const agent = [
  ['Где размещают автомобили жителей?', ['Во дворе','В подземном паркинге','На детской площадке'], 1, 'Подземный паркинг помогает освободить двор для пешеходов.'],
  ['Что доступно на первых этажах?', ['Коммерческие помещения','Только кладовые','Спортивные трибуны'], 0, 'Коммерческие помещения дают место для повседневных сервисов.'],
  ['Что показать семье с ребёнком?', ['Только фасад','Только парковку','Двор и детскую площадку'], 2, 'Покажите реальный маршрут из лобби к площадке через двор без машин.'],
  ['Как помочь сравнить планировки?', ['Обсудить привычки и показать несколько схем','Советовать самую дорогую','Сравнить только площадь'], 0, 'Спросите про сценарии жизни, количество отдельных комнат и общую зону.'],
  ['Что пояснить на входе в дом?', ['Что двор открыт автомобилям','Как устроен вход и путь во двор','Что входная группа заменяет двор'], 1, 'Современное лобби удобно показать через повседневный маршрут.'],
  ['Как показать озеленение?', ['Пообещать тишину в любой квартире','Рассказать только о фасаде','Пройти по дорожкам до зоны отдыха'], 2, 'Маршрут помогает связать озеленение с прогулками и отдыхом.']
];

const profiles = [
  ['Тихая квартира с отдельной спальней','Начните с вариантов, окна которых выходят в озеленённый двор. Отдельная спальня позволит уединиться, а зона отдыха будет рядом.'],
  ['Евродвушка с кухней-гостиной','Открытая общая зона удобна для встреч. Спортивная площадка и сервисы на первом этаже помогут встроить квартал в ваш ритм.'],
  ['Семейная квартира с тремя комнатами','Отдельные комнаты дают семье больше личного пространства. На просмотре сравните дорогу от лобби до детской площадки и входа в паркинг.']
];

let mode, step, answers, picked;
const {root, action, progress, reward} = Game;
const art = '<div class="quiz-art"><img src="../assets/images/quiz-terrace.webp" alt="Терраса жилого комплекса «Горизонт» на закате" width="1200" height="960"></div>';

function restart(nextMode) {
  mode = nextMode;
  step = -1;
  picked = null;
  answers = [];
  render();
}

function render() {
  const training = mode === 'agent';
  const questions = training ? agent : buyer;
  const earned = training ? answers.filter((choice, i) => choice === agent[i][2]).length * 20 : answers.length * 20;

  if (step === questions.length) {
    const totals = [0,0,0];
    answers.forEach((choice, i) => { if (!training) totals[buyer[i][2][choice]] += i === 4 ? 2 : 1; });
    const profile = profiles[totals.indexOf(Math.max(...totals))];
    root.innerHTML = reward({
      title: training ? 'Квиз завершён' : profile[0], score: earned + 50,
      badge: training && earned < 80 ? 'Квиз пройден' : 'Знаток Горизонта',
      detail: training ? `Верных ответов: ${earned / 20} из ${agent.length}. ${earned >= 80 ? 'Вы готовы вести экскурсию по кварталу.' : 'На повторе обратите внимание на пояснения к ответам.'}` : profile[1],
      cta: training ? '' : 'Получить подборку квартир'
    });
    return;
  }

  if (step < 0) {
    root.innerHTML = `<section class="quiz-layout"><div class="panel quiz-intro stack"><h2>${training ? 'Проверьте знание квартала' : 'Какая квартира вам подойдёт?'}</h2><p>${training ? 'Шесть вопросов о ЖК с пояснениями к каждому ответу.' : 'Ответьте на шесть вопросов о жизни, семье и привычках. В конце получите рекомендацию.'}</p><div class="actions">${action('Начать игру','start')}</div></div>${art}</section>`;
    return;
  }

  const [prompt, options, key, hint] = questions[step];
  const score = earned + (picked !== null && (!training || picked === key) ? 20 : 0);
  root.innerHTML = `<section class="quiz-layout"><div class="panel stack">${progress(step + (picked !== null), questions.length, score, 'Ответы', score - earned)}<h2>${prompt}</h2><div class="options quiz-options">${options.map((label,i) => {
    const state = picked === null ? '' : training && i === key ? ' correct' : training && picked === i ? ' wrong' : '';
    const icon = training ? String.fromCharCode(1040 + i) : hint[i];
    return action(`<span class="quiz-icon" aria-hidden="true">${icon}</span><span>${label}</span>`, 'answer', i, 'option quiz-option' + state, `aria-pressed="${picked === i}" ${picked !== null ? 'disabled' : ''}`);
  }).join('')}</div>${picked !== null ? `<p class="feedback ${training&&picked!==key?'is-retry':'is-success'}" role="status">${training ? (picked === key ? 'Верно. ' : 'Ответ неверный. Правильный вариант отмечен. ') + hint : 'Ответ учтён в вашей рекомендации.'}</p>` : ''}<div class="actions">${action(step === questions.length-1 ? 'Узнать результат' : 'Следующий вопрос', 'next', '', 'btn', picked === null ? 'disabled' : '')}</div></div>${art}</section>`;
}

Game.init({modes:true, restart, onAction(name, value) {
  if (name === 'start') step = 0;
  if (name === 'answer') picked = Number(value);
  if (name === 'next' && picked !== null) {
    answers.push(picked);
    picked = null;
    step++;
  }
  render();
  if (name === 'answer') root.querySelector('[data-action="next"]')?.focus();
  if (step === (mode==='agent'?agent:buyer).length) root.querySelector('.reward .btn')?.focus();
}});
