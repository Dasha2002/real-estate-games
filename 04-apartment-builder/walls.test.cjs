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
  const mesh=R.wallGeometry(plan);checkMesh(mesh);checkMesh(R.wallGeometry(plan,true));
  assert.equal(mesh,R.wallGeometry(plan),'geometry is cached across camera changes');
  for(const d of plan.doors){
    const mid=(d.from+d.to)/2;
    assert.equal(inside(mesh.volumes,[d.horizontal?mid:d.at,.5,d.horizontal?d.at:mid]),false,'doorway remains open');
  }
  for(const w of plan.windows){
    const mid=(w.from+w.to)/2;
    assert.equal(inside(mesh.volumes,[w.horizontal?mid:w.at,.7,w.horizontal?w.at:mid]),false,'glass opening remains open');
  }
});
