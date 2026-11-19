const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const storage=new Map();
const node={classList:{add(){},contains(){return false}},prepend(){},append(){},dispatchEvent(){},addEventListener(){},querySelectorAll(){return []},querySelector(){return {}}};
const document={...node,body:node,createElement(){return {...node}},querySelector(){return {}}};
const env={document,window:node,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Game:{root:{},modal(){}},setTimeout(){},Event:class{}};
vm.createContext(env);vm.runInContext(fs.readFileSync('assets/js/loyalty.js','utf8')+'\nthis.wallet=Loyalty;',env);
const wallet=env.wallet;
assert.equal(wallet.award('one',20),20);assert.equal(wallet.award('one',20),0);assert.equal(wallet.read().balance,20);
assert.equal(wallet.spend(21),false);assert.equal(wallet.spend(5),true);assert.equal(wallet.read().balance,15);
wallet.award('wrong',0);assert.equal(wallet.award('wrong',40),0);assert.equal(wallet.read().balance,15);
assert.equal(wallet.day(new Date(2026,10,19)),'2026-11-19');
let source=fs.readFileSync('02-find-advantages/script.js','utf8');
source=source.slice(0,source.indexOf('  load();mount();daily();'))+`this.park={setup(day,open=[]){state={day,open,found:[]};player=center(24,27);generate();},get objects(){return objects},get trees(){return trees},get gates(){return gates},get blocked(){return blocked},route,center,onGrass,treeOnGrass};})();`;
vm.runInContext(source,env,{timeout:3000});
const park=env.park;
for(let day=1;day<=90;day++){
  const date=wallet.day(new Date(2026,9,day));
  park.setup(date);assert.equal(park.objects.length,28);
  for(const t of park.trees)assert.ok(park.onGrass(t.x,t.y,35),'Trees only on grass');
  for(const t of park.trees)assert.ok(park.treeOnGrass(t),'Canopies do not cover paths or playgrounds');
  for(const t of park.objects.filter(o=>o.type==='tree'))assert.ok(park.onGrass(t.x,t.y,35),'Collectible trees only on grass');
  const before=JSON.stringify(park.objects);park.setup(date);assert.equal(JSON.stringify(park.objects),before);
  for(const o of park.objects){const enclosed=[2,3,5].includes(o.region);assert.equal(!!park.route(o),!enclosed,'Access before opening '+date+' object '+o.id);}
  for(const g of park.gates)assert.ok(park.route(park.center(g.x,g.y-1)),'Gate approach '+g.id);
  park.setup(date,['wicket','garden','bridge']);
  for(const o of park.objects)assert.ok(park.route(o),'All objects reachable '+date+' object '+o.id);
}
park.setup('2026-11-19');const today=JSON.stringify(park.objects);park.setup('2026-11-20');assert.notEqual(JSON.stringify(park.objects),today);
console.log('PASS: wallet deduplication, zero-score claims, spending, local dates; 90 daily maps, deterministic layouts, 2,520 reachable targets, closed gates and all gate approaches.');

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
env.Game={root:{...node,focus(){}},dialog:node,close(){}};
vm.runInContext(fs.readFileSync('assets/js/game-art.js','utf8'),env);
vm.runInContext(fs.readFileSync('assets/js/activity-kit.js','utf8'),env);
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
for(const kind of taskKinds)assert.ok(env.minis.names[kind],'Registered activity '+kind);assert.equal(Object.keys(env.minis.names).length,30);console.log('PASS: ten growing mazes; 30 unique activities; 108 solvable block layouts; placement and puzzle checks.');

// Quiz payouts depend on completed activities, never choosing or skipping.
env.document.querySelector=()=>node;
let quizSource=fs.readFileSync('01-interactive-quiz/script.js','utf8');
quizSource=quizSource.slice(0,quizSource.indexOf('  load();render();'))+`this.living={load,complete,skip,get questions(){return questions},reset(){state=fresh();},get results(){return state.results}};})();`;
vm.runInContext(quizSource,env);const living=env.living;living.load();
assert.equal(living.questions.length,9);const initial=wallet.read().balance;
assert.equal(new Set(living.questions.flatMap(q=>q.choices.map(c=>c[1]))).size,27,'All question choices offer distinct activities');
living.skip();assert.equal(wallet.read().balance,initial);
for(let i=1;i<9;i++){living.complete(i,0);living.complete(i,0);}
assert.equal(wallet.read().balance,initial+400,'20+20+3*40+3*80, no payment for skip or duplicate');
living.reset();for(let i=0;i<9;i++)living.complete(i,1);
assert.equal(wallet.read().balance,initial+420,'Replay only pays for previously skipped activity');
console.log('PASS: nine quiz stages; skip earns zero, rewards 20/40/80, duplicate callbacks and replays cannot double-pay.');

// Test the actual first-person game's task/finish payout callbacks at all levels.
let activity;env.minis.open=options=>activity=options;node.focus=()=>{};env.Game.modal=()=>{};
let mazeSource=fs.readFileSync('03-residential-quest/script.js','utf8');
mazeSource=mazeSource.slice(0,mazeSource.indexOf('  load(clamp('))+`this.mazeGame={prepare(level){world=MazeWorld.generate(level);progress=store.levels[level-1]||{solved:[],finished:false,visited:[]};player={x:1.5,y:1.5,angle:0};canvas=document.body;winning=false;},task(id){near=world.gates[id];interact();},finish,get unlocked(){return store.unlocked}};})();`;
vm.runInContext(mazeSource,env);const game=env.mazeGame,mazeBalance=wallet.read().balance;
for(let level=1;level<=10;level++){game.prepare(level);game.finish();for(let id=0;id<3;id++){game.task(id);assert.ok(activity.type);activity.onComplete();activity.onComplete();}game.finish();game.finish();}
assert.equal(wallet.read().balance,mazeBalance+1840,'30 tasks and 10 home bonuses');assert.equal(game.unlocked,10);
for(let level=1;level<=10;level++){game.prepare(level);for(let id=0;id<3;id++){game.task(id);activity.onComplete();}game.finish();}
assert.equal(wallet.read().balance,mazeBalance+1840,'Replaying any labyrinth never double-pays');
console.log('PASS: all 30 task rewards and 10 home bonuses, sequential unlocks, completion guards and replay protection (1,840 total).');
