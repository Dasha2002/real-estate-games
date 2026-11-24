const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={};vm.createContext(env);for(const name of ['town-core','cozy-town-art','cozy-town-scene'])vm.runInContext(fs.readFileSync('assets/js/'+name+'.js','utf8'),env);const T=vm.runInContext('TownCore',env),A=vm.runInContext('CozyTownArt',env),S=vm.runInContext('CozyTownScene',env);
const tile=68,cols=72,rows=54,blocked=new Set([1,cols]);
assert.equal(T.step({x:34,y:34},-1,0,blocked),null);
assert.equal(T.step({x:34,y:34},0,-1,blocked),null);
assert.equal(T.step({x:34,y:34},1,0,blocked),null);
assert.equal(T.step({x:34,y:34},0,1,blocked),null);
assert.equal(T.step({x:34,y:34},1,1,new Set()),null);
let player={x:34,y:34};for(let i=0;i<100;i++)player=T.step(player,1,0,new Set())||player;assert.equal(player.x,(cols-.5)*tile,'Holding a direction stops at the edge');
for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const p=T.step({x:(x+.5)*tile,y:(y+.5)*tile},dx,dy,blocked);if(p){assert.ok(p.x>0&&p.y>0&&p.x<cols*tile&&p.y<rows*tile);assert.ok(!blocked.has(Math.floor(p.y/tile)*cols+Math.floor(p.x/tile)));assert.equal(Math.abs(p.x-(x+.5)*tile)+Math.abs(p.y-(y+.5)*tile),tile);}}
let calls=0;const c=new Proxy({measureText:s=>({width:s.length*7}),createLinearGradient:()=>({addColorStop(){}})},{get(o,k){if(k in o)return o[k];return (...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),k+' coordinates must be finite');calls++;};}});
for(let v=0;v<4;v++){A.tree(c,200,200,40,v,1234);A.cat(c,200,200,{walk:true,variant:v,time:1234});A.building(c,200,200,400,200,v);}
const objects=[...T.missions.map(m=>({...m,x:(m.x+.5)*tile,y:(m.y+.5)*tile,kind:'place'})),...T.neighbors.map(n=>({...n,x:(n.x+.5)*tile,y:(n.y+.5)*tile,kind:'neighbor'}))];
for(let y=0;y<rows*tile;y+=700)for(let x=0;x<cols*tile;x+=700)S.render(c,{T:tile,W:cols*tile,H:rows*tile,view:{w:800,h:700},camera:{x,y},player:{x:x+300,y:y+400},objects,trees:[],path:[],state:{talked:[],completed:[]},avatarId:'mira',hover:null,time:1234});
assert.ok(calls>10000);console.log('PASS: all courtyard grid steps, held movement boundaries, rounded drawing coordinates, four tree/cat/building styles and full-world rendering.');
