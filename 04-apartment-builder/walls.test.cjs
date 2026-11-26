const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});
for(const file of ['plans','room'])vm.runInContext(fs.readFileSync(__dirname+'/assets/'+file+'.js','utf8'),context);
const R=vm.runInContext('ApartmentRoom',context),P=vm.runInContext('ApartmentPlans',context);
const inside=(volumes,[x,y,z])=>volumes.some(v=>y>v.low&&y<v.high&&Math.abs(x-v.rect[0])<v.rect[2]/2&&Math.abs(z-v.rect[1])<v.rect[3]/2);
function checkMesh(mesh){
  const seen=new Set();
  for(const f of mesh.faces){
    const center=[0,1,2].map(axis=>f.points.reduce((sum,p)=>sum+p[axis],0)/4);
    const axis=[0,1,2].find(axis=>f.points.every(p=>p[axis]===f.points[0][axis]));
    assert.notEqual(axis,undefined);
    const a=[...center],b=[...center];a[axis]-=1e-5;b[axis]+=1e-5;
    assert.notEqual(inside(mesh.volumes,a),inside(mesh.volumes,b),'each face separates solid wall from empty space');
    const signature=f.points.map(p=>p.join(',')).sort().join('|');assert.ok(!seen.has(signature),'no duplicate coplanar faces');seen.add(signature);
    assert.ok(f.points.every(p=>p[1]<=mesh.height+1e-6));
  }
}
for(const shape of [
  [[1,0,2,.2],[0,1,.2,2]],
  [[0,0,4,.2],[0,1,.2,2]],
  [[0,0,4,.2],[0,0,.2,4]]
])test('Union produces closed L/T/X junctions without internal faces: '+JSON.stringify(shape),()=>{
  const plan={perimeter:shape,walls:[],windows:[],doors:[]};
  const mesh=R.wallGeometry(plan);assert.equal(mesh.height,1.35);checkMesh(mesh);
  assert.ok(inside(mesh.volumes,[0,.5,0]));
});
for(const plan of P.plans)test('Wall geometry and openings stay valid for '+plan.id,()=>{
  const mesh=R.wallGeometry(plan);checkMesh(mesh);checkMesh(R.wallGeometry(plan,true));checkMesh(R.wallGeometry(plan,false,true));
  assert.equal(mesh,R.wallGeometry(plan),'geometry is cached across camera changes');
  for(const d of plan.doors){
    const mid=(d.from+d.to)/2;
    assert.equal(inside(mesh.volumes,[d.horizontal?mid:d.at,.5,d.horizontal?d.at:mid]),false,'doorway remains open');
  }
  for(const w of plan.windows){
    const mid=(w.from+w.to)/2;
    assert.equal(inside(mesh.volumes,[w.horizontal?mid:w.at,1.2,w.horizontal?w.at:mid]),false,'glass opening remains open');
  }
});

test('Plan slices real-height openings; full interior restores lintels at 2.1 and 2.3 metres',()=>{
  const plan={perimeter:[[0,0,2,.2],[4,0,2,.2],[8,0,2,.2]],walls:[],
    doors:[{horizontal:true,at:0,from:1,to:3}],windows:[{horizontal:true,at:0,from:5,to:7}]};
  const cut=R.wallGeometry(plan),full=R.wallGeometry(plan,false,true);
  assert.equal(cut.height,1.35);assert.equal(full.height,2.7);
  checkMesh(cut);checkMesh(full);
  for(const y of [.9,1.1,1.349]){
    assert.equal(inside(cut.volumes,[2,y,0]),false,'cut door has no lintel');
    assert.equal(inside(cut.volumes,[6,y,0]),false,'cut window stays open to the cut plane');
  }
  assert.equal(inside(cut.volumes,[6,.79,0]),true,'sill keeps its real height');
  assert.equal(inside(full.volumes,[2,2.09,0]),false);
  assert.equal(inside(full.volumes,[2,2.11,0]),true);
  assert.equal(inside(full.volumes,[6,2.29,0]),false);
  assert.equal(inside(full.volumes,[6,2.31,0]),true);
  assert.equal(full,R.wallGeometry(plan,false,true),'full height mesh is cached separately');
});

test('Every apartment has an entrance leaf, interior handle and peephole at the original doorway',()=>{
  for(const plan of P.plans){
    for(const walking of [false,true]){
      const parts=R.entranceGeometry(plan,false,walking),leaf=parts[0],e=plan.entry;
      assert.equal(leaf.height,walking?2.06:1.35);
      assert.ok(Math.abs(leaf.rect[e.horizontal?0:1]-(e.from+e.to)/2)<1e-8);
      assert.ok(parts.some(p=>p.y===1.02),'handle remains visible in both views');
      assert.ok(parts.every(p=>p.y+p.height<=(walking?2.1:1.35)));
    }
    assert.ok(R.entranceGeometry(plan,false,true).some(p=>p.y===1.53),'full-height door has a peephole');
  }
});
