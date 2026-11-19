'use strict';

const ApartmentScenarios = (() => {
  const tasks = [
    {id:'sleep',title:'Спальня для отдыха',detail:'Поставьте двуспальную или односпальную кровать в спальне.',points:100,piece:'bed'},
    {id:'work',title:'Рабочее место у окна',detail:'Поставьте рабочий стол в комнате с окном, не дальше 1,8 м от него.',points:100,piece:'desk'},
    {id:'break',title:'Место для перерыва',detail:'Поставьте диван или кресло и журнальный столик в одной комнате, не дальше 1,8 м друг от друга.',points:100,piece:'armchair'}
  ];

  function zoneOf(key,state) {
    const point=state.placed[key];
    if(!point)return null;
    const [w,d]=ApartmentRoom.footprint(key,state.rotations[key]||0);
    return ApartmentRoom.floorPlan(state).zones.find(({bounds:[x1,z1,x2,z2]})=>
      point[0]-w/2>=x1 && point[0]+w/2<=x2 && point[1]-d/2>=z1 && point[1]+d/2<=z2);
  }

  function evaluate(state) {
    const plan=ApartmentRoom.floorPlan(state);
    const deskZone=zoneOf('desk',state), desk=state.placed.desk;
    const coffeeZone=zoneOf('coffee',state), coffee=state.placed.coffee;
    return {
      sleep:['bed','singleBed'].some(key=>zoneOf(key,state)?.id.startsWith('bedroom')),
      work:Boolean(deskZone && plan.windows.some(window=>{
        if(window.zone!==deskZone.id)return false;
        const along=desk[window.horizontal?0:1],across=desk[window.horizontal?1:0];
        return Math.hypot(across-window.at,along-Math.max(window.from,Math.min(window.to,along)))<=1.8;
      })),
      break:Boolean(coffeeZone && ['sofa','loveseat','armchair'].some(key=>
        zoneOf(key,state)?.id===coffeeZone.id && Math.hypot(state.placed[key][0]-coffee[0],state.placed[key][1]-coffee[1])<=1.8))
    };
  }

  // Earnings are a session ledger. Moving/removing furniture changes live completion,
  // but never awards the same task twice, including after a plan or mode switch.
  function award(state) {
    if(state.scenario!=='work')return [];
    const completed=evaluate(state), gained=[];
    for(const task of tasks)if(completed[task.id]&&!state.earned[task.id]){
      state.earned[task.id]=true;
      gained.push(task);
    }
    return gained;
  }

  function score(state){return tasks.reduce((sum,task)=>sum+(state.earned[task.id]?task.points:0),0);}

  function suggestion(key,state) {
    const task=tasks.find(task=>task.piece===key || (task.id==='sleep'&&key==='singleBed') || (task.id==='break'&&['sofa','loveseat','coffee'].includes(key)));
    if(state.scenario!=='work'||!task||evaluate(state)[task.id])return ApartmentRoom.suggest(key,state);
    const plan=ApartmentRoom.floorPlan(state);
    let best=null, distance=Infinity;
    const origin=state.placed[key]||[0,0];
    for(let x=-plan.width/2+.2;x<plan.width/2;x+=.2)for(let z=-plan.depth/2+.2;z<plan.depth/2;z+=.2){
      const point=[x,z],next={...state,placed:{...state.placed,[key]:point}};
      const delta=Math.hypot(x-origin[0],z-origin[1]);
      if(delta<distance&&ApartmentRoom.fits(key,point,state)&&evaluate(next)[task.id]){best=point;distance=delta;}
    }
    return best||ApartmentRoom.suggest(key,state);
  }

  return {tasks,evaluate,award,score,suggestion};
})();
