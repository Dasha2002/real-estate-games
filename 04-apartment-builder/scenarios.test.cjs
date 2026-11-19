const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context=vm.createContext({});
for(const file of ['plans.js','room.js','scenarios.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'assets',file),'utf8'),context);
const {ApartmentPlans:Plans,ApartmentRoom:Room,ApartmentScenarios:Scenarios}=vm.runInContext('({ApartmentPlans,ApartmentRoom,ApartmentScenarios})',context);
const fresh=(plan='family')=>({plan,scenario:'work',placed:{},rotations:{},earned:{}});

for(const plan of Plans.plans)test(`All tasks can be completed with legal suggestions: ${plan.id}`,()=>{
  const state=fresh(plan.id);
  for(const key of ['desk','bed','armchair','coffee']){
    const point=Scenarios.suggestion(key,state);
    assert.ok(point,`${key} has a suggestion`);
    assert.ok(Room.fits(key,point,state),`${key} fits`);
    state.placed[key]=point;
    Scenarios.award(state);
  }
  assert.equal(Object.values(Scenarios.evaluate(state)).filter(Boolean).length,3);
  assert.equal(Scenarios.score(state),300);
  assert.equal(Scenarios.award(state).length,0);
});

test('Removing, replacing, changing plan or switching modes does not farm points',()=>{
  const state=fresh();
  state.placed.bed=Scenarios.suggestion('bed',state);
  assert.equal(Scenarios.award(state).length,1);
  const point=state.placed.bed;
  delete state.placed.bed;
  assert.equal(Scenarios.evaluate(state).sleep,false);
  assert.equal(Scenarios.score(state),100);
  state.placed.bed=point;
  assert.equal(Scenarios.award(state).length,0);
  state.plan='classic';state.placed={};
  state.placed.bed=Scenarios.suggestion('bed',state);
  assert.equal(Scenarios.award(state).length,0);
  state.scenario='free';
  state.placed.desk=Scenarios.suggestion('desk',state);
  assert.equal(Scenarios.award(state).length,0);
  assert.equal(Scenarios.score(state),100);
  assert.equal(Scenarios.score(fresh()),0);
});

test('Window task requires the actual window opening and the same room',()=>{
  const state=fresh();
  state.placed.desk=Scenarios.suggestion('desk',state);
  assert.equal(Scenarios.evaluate(state).work,true);
  state.placed.desk=[100,100];
  assert.equal(Scenarios.evaluate(state).work,false);
  const bedroom=Plans.plans[1].zones.find(zone=>zone.id==='bedroom');
  state.placed.desk=bedroom.label;
  assert.equal(Scenarios.evaluate(state).work,false,'middle of a deep room is too far from the window');
});

test('Random furniture and a table without seating do not complete tasks',()=>{
  const state=fresh();
  for(const key of ['plant','wardrobe','coffee'])state.placed[key]=Room.suggest(key,state);
  assert.equal(Object.values(Scenarios.evaluate(state)).filter(Boolean).length,0);
  assert.equal(Scenarios.award(state).length,0);
});
