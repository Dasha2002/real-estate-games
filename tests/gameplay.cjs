const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const storage=new Map();
const node={classList:{add(){},contains(){return false}},prepend(){},append(){},dispatchEvent(){},addEventListener(){},querySelectorAll(){return []},querySelector(){return {}}};
const document={...node,body:node,createElement(){return {...node}},querySelector(){return {}}};
const env={document,window:node,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Game:{root:{},modal(){}},setTimeout(){},clearTimeout(){},Event:class{}};
vm.createContext(env);vm.runInContext(fs.readFileSync('assets/js/loyalty.js','utf8')+'\nthis.wallet=Loyalty;',env);
const wallet=env.wallet;
assert.equal(wallet.award('one',20),20);assert.equal(wallet.award('one',20),0);assert.equal(wallet.read().balance,20);
assert.equal(wallet.spend(21),false);assert.equal(wallet.spend(5),true);assert.equal(wallet.read().balance,15);
wallet.award('wrong',0);assert.equal(wallet.award('wrong',40),0);assert.equal(wallet.read().balance,15);
assert.equal(wallet.day(new Date(2026,10,19)),'2026-11-19');
vm.runInContext(fs.readFileSync('assets/js/town-core.js','utf8')+';this.townCore=TownCore;',env);
let source=fs.readFileSync('02-find-advantages/script.js','utf8');
source=source.slice(0,source.indexOf('  load();mount();daily();'))+`this.park={setup(day,open=[]){state={day,open,completed:[],talked:[]};player=center(24,27);generate();},get objects(){return objects},get trees(){return trees},get gates(){return gates},get blocked(){return blocked},route,center,onGrass,treeOnGrass,objectAt,interactionRoute,awardMission,talk,get completed(){return state.completed}};})();`;
vm.runInContext(source,env,{timeout:3000});
const park=env.park;const treeCounts=[];
for(let day=1;day<=90;day++){
  const date=wallet.day(new Date(2026,9,day));
  park.setup(date);assert.equal(park.objects.length,27);treeCounts.push(park.trees.length);
  if(day===1)for(const o of park.objects){const path=park.interactionRoute(o);assert.ok(path);const end=path.at(-1)||park.center(24,27);assert.equal(Math.round(Math.hypot(end.x-o.x,end.y-o.y)),68,'Interactions stop beside the place or neighbor');}
  for(const [x,y,w,h] of env.townCore.buildings)for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)assert.ok(park.blocked.has(yy*72+xx),'Building footprints stay solid');
  for(const o of park.objects){assert.equal(park.objectAt({x:o.x,y:o.y-(o.kind==='neighbor'?82:125)+12})?.id,o.id,'Visible signs are interactive');assert.equal(park.objectAt({x:o.x,y:o.y-(o.kind==='neighbor'?82:125)-19})?.id,o.id,'Interaction badges are clickable');}
  for(const t of park.trees)assert.ok(park.onGrass(t.x,t.y,35),'Trees only on grass');
  for(const t of park.trees)assert.ok(park.treeOnGrass(t),'Canopies do not cover paths or playgrounds');
  for(let i=0;i<park.trees.length;i++)for(let j=i+1;j<park.trees.length;j++){const a=park.trees[i],b=park.trees[j];assert.ok(a.x+a.size*1.3<=b.x-b.size*1.3||b.x+b.size*1.3<=a.x-a.size*1.3||a.y+18<=b.y-b.size*3.2||b.y+18<=a.y-a.size*3.2,'Actual tree canopy bounds never overlap');}
  for(const t of park.objects.filter(o=>o.type==='tree'))assert.ok(park.onGrass(t.x,t.y,35),'Collectible trees only on grass');
  const before=JSON.stringify(park.objects);park.setup(date);assert.equal(JSON.stringify(park.objects),before);
  for(const o of park.objects)assert.ok(park.route(o),'All public places and neighbors reachable '+date+' '+o.id);
}
park.setup('2026-11-19');const today=JSON.stringify(park.trees);park.setup('2026-11-20');assert.notEqual(JSON.stringify(park.trees),today);
console.log('Trees per courtyard:',Math.min(...treeCounts),'-',Math.max(...treeCounts));
console.log('PASS: wallet deduplication, zero-score claims, spending, local dates; 90 daily maps, deterministic layouts, 2,430 reachable places and neighbors; trees and canopies stay on grass.');

vm.runInContext(fs.readFileSync('assets/js/maze-core.js','utf8')+'\nthis.mazes=MazeWorld;',env);
const mazes=env.mazes;let previousSize=0,previousPath=0;const taskKinds=new Set();
for(let level=1;level<=10;level++){
  const m=mazes.generate(level);assert.ok(m.n>previousSize);previousSize=m.n;
  assert.equal(m.gates.length,3);assert.ok(m.path.length>previousPath);previousPath=m.path.length;assert.ok(mazes.solve(m.grid,m.start,m.goal));
  assert.equal(JSON.stringify(mazes.generate(level)),JSON.stringify(m),'Deterministic maze');
  const floor=m.grid.flat().filter(v=>v===0).length;
  let edges=0;for(let y=1;y<m.n-1;y++)for(let x=1;x<m.n-1;x++)if(!m.grid[y][x]){if(m.grid[y][x+1]===0)edges++;if(m.grid[y+1][x]===0)edges++;}
  assert.equal(edges,floor-1,'Perfect maze has no bypass cycles');
  for(const gate of m.gates){taskKinds.add(gate.type);assert.equal(mazes.solve(m.grid,m.start,m.goal,new Set([gate.y*m.n+gate.x])),null,'Each task blocks the way home');}
}
assert.equal(taskKinds.size,30,'Every gate in the campaign uses a different activity');
env.Game={root:{...node,focus(){}},dialog:node,close(){},modal(){}};
vm.runInContext(fs.readFileSync('assets/js/activity-variants.js','utf8')+'\nthis.variants=ActivityVariants;',env);
vm.runInContext(fs.readFileSync('assets/js/game-art.js','utf8')+'\nthis.art=GameArt;',env);
vm.runInContext(fs.readFileSync('assets/js/activity-kit.js','utf8'),env);
vm.runInContext(fs.readFileSync('assets/js/arcade-core.js','utf8'),env);
vm.runInContext(fs.readFileSync('assets/js/arcade-kit.js','utf8'),env);
vm.runInContext(fs.readFileSync('assets/js/minigames.js','utf8')+'\nthis.minis=MiniGames;',env);
assert.equal(env.minis.canPlace(Array(9).fill(0),3,3,{w:2,h:2},2,1),false,'Furniture stays inside board');
assert.equal(env.minis.canPlace([0,0,0,0,1,0,0,0,0],3,3,{w:2,h:2},0,0),false,'Furniture cannot overlap');
assert.equal(env.minis.canPlace(Array(9).fill(0),3,3,{w:2,h:2},1,1),true);
for(let seed=1;seed<=30;seed++){const a=env.minis.makePuzzle(seed);assert.equal(new Set(a).size,9);assert.ok(a.some((v,i)=>v!==i));}
for(let seed=1;seed<=12;seed++)for(let wave=0;wave<9;wave++){
  const p=env.minis.blockLayout(seed,wave);let shape=p.shape;let aligned=false;
  for(let r=0;r<4;r++){if(JSON.stringify(shape)===JSON.stringify(p.solution))aligned=true;shape=env.minis.rotateShape(shape);}
  assert.ok(aligned,'Every tetromino can rotate into the target');
  let y=0;const valid=y=>p.solution.every((row,dy)=>row.every((v,dx)=>!v||(y+dy<12&&!p.board[(y+dy)*8+p.gap+dx])));
  while(valid(y+1))y++;
  const b=[...p.board];p.solution.forEach((row,dy)=>row.forEach((v,dx)=>{if(v)b[(y+dy)*8+p.gap+dx]=1;}));
  assert.ok(b.slice((12-p.solution.length)*8).every(Boolean),'Every block layout is solvable by a drop');
}
for(const kind of taskKinds)assert.ok(env.minis.names[kind],'Registered activity '+kind);assert.equal(Object.keys(env.minis.names).length,32);console.log('PASS: ten growing mazes; 30 unique activities; 108 solvable block layouts; placement and puzzle checks.');

for(let seed=1;seed<=160;seed++){
  const c=env.variants.build('shopping',seed,1+seed%10,'ice');
  assert.ok(env.variants.path(c.parking,40,7),'Parking has a route');
  assert.ok(env.variants.path(Array.from({length:5},(_,y)=>Array.from({length:5},(_,x)=>c.reef.includes(y*5+x)?1:0)),0,24),'Aquarium has a route');
  assert.ok(c.budget>=c.cost);assert.equal(c.cost,c.shoppingList.reduce((n,l)=>n+c.groceries.find(p=>p.id===l.id).price*l.qty,0));
  let circuitSolvable=false;for(let bits=0;bits<16;bits++)if(c.circuitEdges.every(([a,b])=>((bits>>a)&1)!==((bits>>b)&1)))circuitSolvable=true;assert.ok(circuitSolvable,'Random circuit is solvable');
  assert.equal(new Set(c.plantKinds).size,c.plantCount);assert.equal(new Set(c.stars.map(p=>p[0])).size,8);
}
const canonical=src=>decodeURIComponent(src).replace(/toy-\d+/g,'toy');
assert.equal(canonical(env.art.puzzleImage('garden',17)),canonical(env.art.puzzleImage('garden',17)),'Puzzle artwork is reproducible for the same seed');
assert.notEqual(canonical(env.art.puzzleImage('garden',17)),canonical(env.art.puzzleImage('garden',18)));
assert.equal(new Set(Array.from({length:6},(_,seed)=>canonical(env.art.puzzleImage('courtyard',seed)))).size,6,'Six different picture compositions');
assert.notEqual(JSON.stringify(env.variants.build('plant',111)),JSON.stringify(env.variants.build('plant',112)));
assert.notEqual(env.variants.freshSeed(),env.variants.freshSeed());
console.log('PASS: 160 random scenarios: reachable parking/aquarium, solvable circuits, balanced shopping lists, distinct seeds and puzzle images.');

// Quiz payouts depend on completed activities, never choosing or skipping.
env.document.querySelector=()=>node;
let quizSource=fs.readFileSync('01-interactive-quiz/script.js','utf8');
quizSource=quizSource.slice(0,quizSource.indexOf('  load();render();'))+`this.living={load,complete,skip,get missions(){return missions},reset(){state=fresh();},get results(){return state.results}};})();`;
env.minis.patch=(element,html)=>element.innerHTML=html;
vm.runInContext(quizSource,env);const living=env.living;living.load();
assert.equal(living.missions.length,9);const initial=wallet.read().balance;
assert.equal(new Set(living.missions.map(m=>m.type)).size,9,'Each level has three distinct tasks; no mechanic repeats');
living.skip(0);assert.equal(wallet.read().balance,initial);
for(let i=1;i<9;i++){living.complete(i,0);living.complete(i,0);}
assert.equal(wallet.read().balance,initial+400,'20+20+3*40+3*80, no payment for skip or duplicate');
living.reset();for(let i=0;i<9;i++)living.complete(i,1);
assert.equal(wallet.read().balance,initial+420,'Replay only pays for previously skipped activity');
console.log('PASS: nine quiz stages; skip earns zero, rewards 20/40/80, duplicate callbacks and replays cannot double-pay.');

// The courtyard uses the same one-claim-per-place and daily reward rules.
const townBalance=wallet.read().balance;park.setup('2090-01-01');for(const id of env.townCore.missions.map(m=>m.id)){park.awardMission(id);park.awardMission(id);}assert.equal(wallet.read().balance,townBalance+1200);assert.equal(park.completed.length,23);
park.setup('2090-01-01');for(const id of env.townCore.missions.map(m=>m.id))park.awardMission(id);assert.equal(wallet.read().balance,townBalance+1200,'Daily reload cannot pay twice');
park.setup('2090-01-02');for(const id of env.townCore.missions.map(m=>m.id))park.awardMission(id);assert.equal(wallet.read().balance,townBalance+2400,'New day unlocks new courtyard rewards');console.log('PASS: 23 courtyard missions and completion bonus (1200/day), duplicate claims, reloads and next-day rewards.');
park.setup('2090-01-03');const dialogueBalance=wallet.read().balance;for(const n of env.townCore.neighbors){park.talk(n,'start');park.talk(n,'start');assert.equal(wallet.read().balance,dialogueBalance+env.townCore.neighbors.indexOf(n)*20,'Opening a conversation cannot immediately pay');for(const topic of Object.keys(env.townCore.dialogues[n.id]))park.talk(n,topic);}assert.equal(wallet.read().balance,dialogueBalance+120,'Four full conversations pay 80 plus 40 for all neighbors');for(const n of env.townCore.neighbors)for(const topic of Object.keys(env.townCore.dialogues[n.id]))park.talk(n,topic);assert.equal(wallet.read().balance,dialogueBalance+120,'Reopening read conversations cannot pay twice');console.log('PASS: complete conversation rewards, incomplete topic guards and repeated reads.');

// Test the actual first-person game's task/finish payout callbacks at all levels.
let activity;env.minis.open=options=>activity=options;node.focus=()=>{};env.Game.modal=()=>{};
let mazeSource=fs.readFileSync('03-residential-quest/script.js','utf8');
mazeSource=mazeSource.slice(0,mazeSource.indexOf('  load(clamp('))+`this.mazeGame={prepare(level){world=MazeWorld.generate(level);progress=store.levels[level-1]||{solved:[],finished:false,visited:[]};player={x:1.5,y:1.5,angle:0};canvas=document.body;winning=false;},task(id){near=world.gates[id];interact();},finish,get unlocked(){return store.unlocked}};})();`;
vm.runInContext(mazeSource,env);const game=env.mazeGame,mazeBalance=wallet.read().balance;
for(let level=1;level<=10;level++){game.prepare(level);game.finish();for(let id=0;id<3;id++){game.task(id);assert.ok(activity.type);assert.equal(activity.context,'maze');assert.ok(activity.theme);assert.equal(activity.subtitle,'');activity.onComplete();activity.onComplete();}game.finish();game.finish();}
assert.equal(wallet.read().balance,mazeBalance+1840,'30 tasks and 10 home bonuses');assert.equal(game.unlocked,10);
for(let level=1;level<=10;level++){game.prepare(level);for(let id=0;id<3;id++){game.task(id);activity.onComplete();}game.finish();}
assert.equal(wallet.read().balance,mazeBalance+1840,'Replaying any labyrinth never double-pays');
console.log('PASS: all 30 task rewards and 10 home bonuses, sequential unlocks, completion guards and replay protection (1,840 total).');
// Exercise the same reset operation used by both replay buttons, preserving wallet claims.
vm.runInContext(mazeSource.replace('task(id){near=', 'reset:resetRun,task(id){near='),env);
const replay=env.mazeGame,balanceBeforeReset=wallet.read().balance;replay.reset();assert.equal(replay.unlocked,1);assert.equal(wallet.read().balance,balanceBeforeReset);
for(let level=1;level<=10;level++){replay.prepare(level);for(let id=0;id<3;id++){replay.task(id);assert.equal(activity.reward,0);activity.onComplete();}replay.finish();}
assert.equal(wallet.read().balance,balanceBeforeReset,'Full restart preserves earned coins and cannot repeat claims');console.log('PASS: full maze replay resets levels and preserves wallet without duplicate rewards.');
