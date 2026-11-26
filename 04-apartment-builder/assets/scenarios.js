'use strict';

const ApartmentScenarios = (() => {
  const task=(id,title,detail,types,nearWindow=false)=>({id,title,detail,types,piece:types[0],nearWindow});
  const scenarios=[
    {id:'relax',title:'Уютный вечер',symbol:'☕',description:'Обустройте гостиную для отдыха. Если гостиной нет, используйте спальню.',points:400,tasks:[
      task('seat','Место для отдыха','Поставьте кресло или диван в гостиной. Если гостиной нет — в спальне.',['armchair','loveseat','sofa']),
      task('coffee','Журнальный столик','Поставьте журнальный столик в той же комнате.',['coffee']),
      task('tv','Телевизор','Разместите тумбу с телевизором в комнате отдыха.',['tvStand']),
      task('rug','Мягкий акцент','Добавьте ковёр в комнату отдыха. Его можно положить под мебель.',['rug'])
    ]},
    {id:'work',title:'Работаю из дома',symbol:'⌨',description:'Создайте кабинет в детской, а в однокомнатной квартире — в спальне.',points:500,tasks:[
      task('desk','Стол у окна','Поставьте рабочий стол в детской (в однокомнатной — в спальне), не дальше 1,8 м от окна.',['desk'],true),
      task('books','Книги под рукой','Поставьте книжный стеллаж в той же комнате.',['bookcase']),
      task('chair','Кресло для перерыва','Добавьте кресло в домашний кабинет.',['armchair']),
      task('coffee','Место для чашки','Добавьте журнальный столик в домашний кабинет.',['coffee']),
      task('plant','Немного зелени','Поставьте растение в домашнем кабинете.',['plant'])
    ]},
    {id:'sleep',title:'Спальня для отдыха',symbol:'☾',description:'Соберите удобную спальню с хранением и спокойными деталями.',points:600,tasks:[
      task('bed','Кровать','Поставьте односпальную или двуспальную кровать в спальне.',['singleBed','bed']),
      task('nightstand','Прикроватная тумба','Добавьте прикроватную тумбу в спальню.',['nightstand']),
      task('wardrobe','Шкаф для одежды','Поставьте шкаф в спальне.',['wardrobe']),
      task('dresser','Комод','Добавьте комод в спальню.',['dresser']),
      task('plant','Зелёный уголок','Поставьте растение в спальне.',['plant']),
      task('rug','Уютный ковёр','Положите ковёр в спальне. Его можно разместить под мебелью.',['rug'])
    ]}
  ];
  const current=state=>scenarios.find(s=>s.id===state.scenario)||null;
  function targetZone(state){
    const zones=ApartmentRoom.floorPlan(state).zones;
    const preferred=state.scenario==='relax'?'living':state.scenario==='work'?'bedroom-child':'bedroom';
    return zones.find(z=>z.id===preferred)||zones.find(z=>z.id==='bedroom');
  }
  function matches(key,task,state){
    if(!task.types.includes(ApartmentRoom.pieceType(key)))return false;
    const point=state.placed[key],zone=targetZone(state);
    if(!point||!zone)return false;
    const [w,d]=ApartmentRoom.footprint(key,state.rotations[key]||0),[x1,z1,x2,z2]=zone.bounds;
    if(point[0]-w/2<x1||point[0]+w/2>x2||point[1]-d/2<z1||point[1]+d/2>z2)return false;
    if(!task.nearWindow)return true;
    return ApartmentRoom.floorPlan(state).windows.some(window=>{
      if(window.zone!==zone.id)return false;
      const along=point[window.horizontal?0:1],across=point[window.horizontal?1:0];
      return Math.hypot(across-window.at,along-Math.max(window.from,Math.min(window.to,along)))<=1.8;
    });
  }
  function evaluate(state){
    return Object.fromEntries((current(state)?.tasks||[]).map(task=>[task.id,Object.keys(state.placed).some(key=>matches(key,task,state))]));
  }
  // Awards belong to complete scenarios and persist for this playthrough.
  function award(state){
    const scenario=current(state);
    if(!scenario||state.earned[scenario.id]||!Object.values(evaluate(state)).every(Boolean))return [];
    state.earned[scenario.id]=true;
    return [scenario];
  }
  function score(state){return scenarios.reduce((sum,s)=>sum+(state.earned[s.id]?s.points:0),0);}
  function suggestion(key,state){
    const task=current(state)?.tasks.find(t=>t.types.includes(ApartmentRoom.pieceType(key)));
    if(!task)return ApartmentRoom.suggest(key,state);
    const zone=targetZone(state),[x1,z1,x2,z2]=zone.bounds;
    let best=null,distance=Infinity;
    for(let x=x1+.1;x<x2;x+=.1)for(let z=z1+.1;z<z2;z+=.1){
      const point=[x,z],next={...state,placed:{...state.placed,[key]:point}};
      // Keep large furniture near walls, preserving the centre for the remaining tasks.
      const edge=Math.min(x-x1,x2-x,z-z1,z2-z),centre=Math.hypot(x-zone.label[0],z-zone.label[1]);
      const rank=ApartmentRoom.pieceType(key)==='rug'?centre:edge+centre*.01;
      if(rank<distance&&matches(key,task,next)&&ApartmentRoom.fits(key,point,state)){best=point;distance=rank;}
    }
    return best;
  }
  return {scenarios,current,targetZone,evaluate,award,score,suggestion};
})();
