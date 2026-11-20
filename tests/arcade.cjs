const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={};vm.createContext(env);for(const name of ['activity-variants','arcade-core'])vm.runInContext(fs.readFileSync('assets/js/'+name+'.js','utf8'),env);vm.runInContext('this.core=ArcadeCore;this.variants=ActivityVariants',env);const C=env.core,V=env.variants;
assert.deepEqual(Array.from(C.merge2048([2,2,2,2,...Array(12).fill(0)],'left').board).slice(0,4),[4,4,0,0]);
assert.equal(C.merge2048([4,4,8,8,...Array(12).fill(0)],'left').gain,24);
for(let seed=1;seed<=30;seed++){const p=C.waterPuzzle(seed,5);let tubes=p.tubes;for(const [from,to] of p.solution){tubes=C.pour(tubes,from,to);assert.ok(tubes);}assert.ok(C.solvedTubes(tubes));}
function solveSokoban(b){const stamp=(p,boxes)=>p+':'+[...boxes].sort((a,b)=>a-b).join(','),q=[{player:b.player,boxes:[...b.boxes],path:[]}],seen=new Set([stamp(b.player,b.boxes)]);for(let head=0;head<q.length&&head<100000;head++){const state=q[head];if(b.goals.every(i=>state.boxes.includes(i)))return state.path;for(let dir=0;dir<4;dir++){const next=C.sokobanMove(b,state.player,state.boxes,dir);if(!next)continue;const key=stamp(next.player,next.boxes);if(seen.has(key))continue;seen.add(key);q.push({...next,path:[...state.path,dir]});}}return null;}
for(let seed=1;seed<=80;seed++){
  const water=C.waterPuzzle(seed);let tubes=water.tubes;for(const [from,to] of water.solution){tubes=C.pour(tubes,from,to);assert.ok(tubes,'Every reverse-generated pour has a legal solution');}assert.ok(C.solvedTubes(tubes));
  const sudoku=C.sudoku(seed);assert.equal(C.sudokuSolutions(sudoku.board),1);assert.equal(C.sudokuSolutions(sudoku.solution),1);assert.ok(sudoku.board.filter(Boolean).length<12);
  const lights=C.lightPuzzle(seed);let board=lights.board;for(const index of lights.solution)board=C.toggleLights(board,index);assert.ok(board.every(v=>!v));
  const flow=C.flowPuzzle(seed),path=flow.paths.flat();assert.equal(new Set(path).size,25);flow.paths.forEach(p=>p.slice(1).forEach((i,j)=>assert.equal(Math.abs(i%5-p[j]%5)+Math.abs(Math.floor(i/5)-Math.floor(p[j]/5)),1)));
  const pipes=C.pipePuzzle(seed);assert.equal(C.wetPipes(pipes.ports,Array(25).fill(0),pipes.path[0]).size,25);
  const match=C.matchBoard(seed);assert.equal(C.matched(match).size,0);assert.ok(C.hasSwap(match));
  const figures=C.polyomino(seed),covered=figures.flatMap(p=>p.cells.map(([x,y])=>(y+p.y)*5+x+p.x));assert.equal(new Set(covered).size,25);assert.ok(covered.every(i=>i>=0&&i<25));
  const laser=C.laserPuzzle(seed),trace=C.laserTrace(laser,laser.mirrors);assert.equal(trace.lit.size,3);assert.ok(trace.exit);
  const mines=C.mineBoard(seed,19);assert.equal(mines.mines.size,7);assert.ok(!mines.mines.has(19));assert.equal(mines.numbers[19],0);
}
for(let seed=0;seed<8;seed++)for(let round=0;round<3;round++)assert.ok(solveSokoban(C.sokoban(seed,round)),'Sokoban variant '+seed+' / '+round);
for(let seed=0;seed<40;seed++){const b=C.sokoban(seed,0,8);let player=b.player,boxes=Array.from(b.boxes);assert.ok(b.reversals.length>=2);for(const pull of Array.from(b.reversals).reverse()){const q=[player],seen=new Set([player]);for(let head=0;head<q.length;head++)for(const d of [-1,1,-7,7]){const p=q[head]+d;if(!b.walls.includes(p)&&!boxes.includes(p)&&!seen.has(p)){seen.add(p);q.push(p);}}assert.ok(seen.has(pull.behind),'Reverse push has a reachable approach');const delta=pull.box-pull.p,dir={[-7]:0,1:1,7:2,[-1]:3}[delta],next=C.sokobanMove(b,pull.behind,boxes,dir);assert.ok(next);player=next.player;boxes=Array.from(next.boxes);}assert.ok(b.goals.every(i=>boxes.includes(i)),'Advanced room has a legal solution');}
assert.equal(C.mastermind([1,1,2,3],[1,2,1,4]).exact,1);assert.equal(C.mastermind([1,1,2,3],[1,2,1,4]).color,2);assert.equal(C.mastermind([1,1,2,3],[1,1,1,1]).color,0);
const answer=C.bestRoute([[0,0],[1,0],[2,0],[3,0]]);assert.equal(answer.distance,6);
// All dialogue branches resolve. Anna and Max have no links to a task.
vm.runInContext(fs.readFileSync('assets/js/town-core.js','utf8')+';this.town=TownCore',env);for(const [id,tree] of Object.entries(env.town.dialogues)){assert.ok(tree.start);for(const node of Object.values(tree))for(const [,next] of node.choices){if(next.startsWith('@'))assert.ok(env.town.missions.some(m=>m.id===next.slice(1)));else assert.ok(tree[next],id+' missing '+next);if(['anna','max'].includes(id))assert.ok(!next.startsWith('@'));}}
console.log('PASS: 80 seeds across water sort, unique sudoku, lights, flow, pipes, match-3, polyomino, laser and mines; 24 solvable Sokoban rooms; 2048, Mastermind, courier and dialogue graphs.');
