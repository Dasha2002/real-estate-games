const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context=vm.createContext({});
for(const file of ['plans.js','room.js','scenarios.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'assets',file),'utf8'),context);
const {ApartmentPlans:Plans,ApartmentRoom:Room,ApartmentScenarios:Scenarios}=vm.runInContext('({ApartmentPlans,ApartmentRoom,ApartmentScenarios})',context);
const fresh=(plan='family',scenario='work')=>({plan,scenario,placed:{},rotations:{},earned:{}});
function complete(state,copies=false){
  const scenario=Scenarios.current(state);
  for(const task of scenario.tasks){
    const key=task.piece+(copies?'#2':'');
    const point=Scenarios.suggestion(key,state);
    assert.ok(point,`${state.plan}/${scenario.id}/${key} has a suggestion`);
    assert.ok(Room.fits(key,point,state),`${key} fits`);
    state.placed[key]=point;
    assert.equal(Scenarios.evaluate(state)[task.id],true,task.id);
    if(task!==scenario.tasks.at(-1))assert.equal(Scenarios.award(state).length,0,'no partial awards');
  }
}
test('Exactly three scenarios require four, five and six distinct items',()=>{
  assert.equal(Scenarios.scenarios.length,3);
  assert.deepEqual(Array.from(Scenarios.scenarios,s=>s.tasks.length),[4,5,6]);
  for(const s of Scenarios.scenarios){
    assert.ok(s.points>0);
    assert.equal(new Set(s.tasks.flatMap(t=>Array.from(t.types))).size,s.tasks.reduce((n,t)=>n+t.types.length,0));
  }
});
for(const plan of Plans.plans)for(const scenario of Scenarios.scenarios)test(`Legal completion: ${plan.id}/${scenario.id}`,()=>{
  const state=fresh(plan.id,scenario.id);
  complete(state);
  assert.ok(Object.values(Scenarios.evaluate(state)).every(Boolean));
  assert.equal(Scenarios.award(state).length,1);
  assert.equal(Scenarios.score(state),scenario.points);
  assert.equal(Scenarios.award(state).length,0);
});
test('Removal, replacement, plan changes and scenario switches cannot farm points',()=>{
  const state=fresh();complete(state);Scenarios.award(state);
  const point=state.placed.desk;delete state.placed.desk;
  assert.equal(Scenarios.evaluate(state).desk,false);
  assert.equal(Scenarios.score(state),500);
  state.placed.desk=point;assert.equal(Scenarios.award(state).length,0);
  state.plan='compact';state.placed={};complete(state);
  assert.equal(Scenarios.award(state).length,0);
  state.scenario='free';assert.equal(Scenarios.award(state).length,0);
  assert.equal(Object.keys(Scenarios.evaluate(state)).length,0);
  state.scenario='sleep';state.placed={};complete(state);Scenarios.award(state);
  state.scenario='relax';state.placed={};complete(state);Scenarios.award(state);
  assert.equal(Scenarios.score(state),1500);
  assert.equal(Scenarios.score(fresh()),0);
});
test('Numbered copies also satisfy the scenario',()=>{
  const state=fresh();complete(state,true);
  assert.equal(Scenarios.award(state).length,1);
  assert.equal(Scenarios.score(state),500);
});
test('Wrong room and distant desk do not count',()=>{
  const state=fresh();state.placed.desk=Scenarios.suggestion('desk',state);
  assert.equal(Scenarios.evaluate(state).desk,true);
  state.placed.desk=[100,100];assert.equal(Scenarios.evaluate(state).desk,false);
  const room=Room.floorPlan(state).zones.find(z=>z.id==='bedroom-child');
  state.placed.desk=[room.label[0],room.bounds[1]+.6];
  assert.equal(Scenarios.evaluate(state).desk,false);
  state.placed.armchair=Room.floorPlan(state).zones.find(z=>z.id==='living').label;
  assert.equal(Scenarios.evaluate(state).chair,false);
});
test('Repeated furniture does not replace missing task types',()=>{
  const state=fresh();
  for(let i=0;i<5;i++)state.placed['armchair#'+i]=Room.floorPlan(state).zones.find(z=>z.id==='bedroom-child').label;
  assert.equal(Object.values(Scenarios.evaluate(state)).filter(Boolean).length,1);
  assert.equal(Scenarios.award(state).length,0);
});

test('Studio renders each scenario, updates progress and preserves rewards when switching',()=>{
  const nodes=new Map();
  const element=()=>({style:{},classList:{toggle(){},contains(){return false;}},setAttribute(){},addEventListener(){},focus(){},scrollIntoView(){},querySelector(selector){return node(selector);},querySelectorAll(){return [];}});
  const node=selector=>{
    if(selector==='.furniture-context')return null;
    if(selector==='#room-suggestion'&&!root.innerHTML.includes('id="room-suggestion"'))return null;
    if(!nodes.has(selector))nodes.set(selector,element());
    return nodes.get(selector);
  };
  const root=element();
  const config={};
  const ui=vm.createContext({document:{addEventListener(){}},Game:{root,dialog:{open:false},close(){},action:(label,name,value,classes,attributes='')=>`<button data-action="${name}" data-value="${value}" ${attributes}>${label}</button>`,init(c){Object.assign(config,c);}}});
  for(const file of ['plans.js','room.js','scenarios.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'assets',file),'utf8'),ui);
  vm.runInContext('ApartmentRoom.mount=()=>({schedule(){},destroy(){}})',ui);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'script.js'),'utf8'),ui);
  config.restart();
  for(const scenario of Scenarios.scenarios){
    assert.ok(root.innerHTML.includes(`data-value="${scenario.id}"`));
  }
  let total=0;
  for(const scenario of Scenarios.scenarios){
    config.onAction('scenario',scenario.id);
    assert.doesNotMatch(root.innerHTML,/camera-help|plan-caption|ИНГРУПП|Поставить сюда/);
    assert.match(root.innerHTML,new RegExp(`max="${scenario.tasks.length}"`));
    for(const task of scenario.tasks)assert.ok(root.innerHTML.includes(`id="task-${task.id}"`));
    assert.equal(node('#room-progress').value,0);
    assert.ok(node('#task-room').textContent.includes(scenario.id==='work'?'Детская':scenario.id==='relax'?'Гостиная':'Спальня'));
    assert.equal(node('#scenario-tasks').hidden,false);
    assert.equal(node('#studio-furniture').hidden,true);
    config.onAction('panel','finishes');
    assert.equal(node('#studio-finishes').hidden,false);
    assert.equal(node('#scenario-tasks').hidden,true);
    config.onAction('task',scenario.tasks[0].id);
    assert.equal(vm.runInContext('selected',ui),scenario.tasks[0].piece);
    assert.equal(node('#studio-furniture').hidden,false);
    assert.equal(node('#studio-finishes').hidden,true);
    const state=vm.runInContext('state',ui);
    complete(state);
    vm.runInContext('refresh()',ui);
    total+=scenario.points;
    assert.equal(node('#scenario-score').textContent,total+' баллов');
    assert.equal(node('#room-progress').value,scenario.tasks.length);
    assert.match(node('#task-notice').textContent,new RegExp('\\+'+scenario.points));
    state.placed={};
    vm.runInContext('refresh()',ui);
    assert.equal(node('#room-progress').value,0);
    assert.equal(node('#scenario-score').textContent,total+' баллов');
  }
  config.onAction('scenario','free');
  assert.match(root.innerHTML,/id="room-suggestion"/);
  assert.equal(node('#scenario-tasks').hidden,true);
  assert.equal(node('#studio-furniture').hidden,false);
  assert.equal(node('#placed-count').textContent,'0 предметов');
  assert.equal(node('#scenario-score').textContent,'1500 баллов');
});
