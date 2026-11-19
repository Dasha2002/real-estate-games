const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context=vm.createContext({});
for(const file of ['plans','room','navigation'])vm.runInContext(fs.readFileSync(path.join(__dirname,'assets',file+'.js'),'utf8'),context);
const {ApartmentRoom:Room,ApartmentPlans:Plans,ApartmentNavigation:Nav}=vm.runInContext('({ApartmentRoom,ApartmentPlans,ApartmentNavigation})',context);
const fresh=plan=>({plan,placed:{},rotations:{},walking:true,walker:null});

for(const plan of Plans.plans)test(`Character spawns in free space and cannot leave the apartment: ${plan.id}`,()=>{
  const state=fresh(plan.id);
  assert.ok(Nav.spawn(state));
  assert.ok(Nav.canStand(state.walker.position,state));
  for(let i=0;i<180;i++)Nav.move(state,1,0,0,.05);
  assert.ok(Nav.canStand(state.walker.position,state));
  assert.ok(Plans.contains(state.walker.position,plan.outline));
  state.plan=plan.id==='compact'?'family':'compact';
  Nav.spawn(state);
  assert.equal(state.walker.plan,state.plan);
  assert.ok(Nav.canStand(state.walker.position,state));
});

test('Walls, windows, fixtures and placed furniture block the character',()=>{
  const state=fresh('family'),plan=Room.floorPlan(state);
  assert.equal(Nav.canStand(plan.walls[0].slice(0,2),state),false);
  assert.equal(Nav.canStand(plan.fixtures[0].bounds.slice(0,2),state),false);
  state.placed.desk=Room.suggest('desk',state);
  assert.equal(Nav.canStand(state.placed.desk,state),false);
  const w=plan.windows[0];
  assert.equal(Nav.canStand(w.horizontal?[(w.from+w.to)/2,w.at]:[w.at,(w.from+w.to)/2],state),false);
});

test('Interior doorways allow passage between rooms',()=>{
  const state=fresh('family'),plan=Room.floorPlan(state);
  const door=plan.doors.find(d=>d.horizontal&&d.at>0);
  assert.ok(door);
  const mid=(door.from+door.to)/2;
  state.walker={position:[mid,door.at+.6],phase:0,facing:0,plan:state.plan};
  assert.ok(Nav.canStand(state.walker.position,state));
  for(let i=0;i<16;i++)Nav.move(state,0,1,0,.05);
  assert.ok(state.walker.position[1]<door.at-.3);
});

test('Furniture cannot be placed on the character; diagonal speed is normalized',()=>{
  const state=fresh('family');
  const desk=Room.suggest('desk',state);
  state.walker={position:[...desk],phase:0,facing:0,plan:state.plan};
  assert.equal(Room.fits('desk',desk,state),false);
  state.walking=false;
  assert.equal(Room.fits('desk',desk,state),true);
  state.walking=true;
  const before=[...state.walker.position];
  Nav.move(state,1,1,0,.01);
  const distance=Math.hypot(state.walker.position[0]-before[0],state.walker.position[1]-before[1]);
  assert.ok(distance<=1.65*.01+1e-9);
});
