const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});
for(const n of ['plans','room'])vm.runInContext(fs.readFileSync(__dirname+'/assets/'+n+'.js','utf8'),context);
const {Plans,Room}=vm.runInContext('({Plans:ApartmentPlans,Room:ApartmentRoom})',context);
test('Initial wall palette is green',()=>{
  const hex=Room.colors[0].wall,r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  assert.ok(g>r&&g>b);
});
function onFloor(p,plan){
  if(Plans.contains(p,plan.outline))return true;
  return plan.outline.some((a,i)=>{
    const b=plan.outline[(i+1)%plan.outline.length],cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);
    return Math.abs(cross)<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7;
  });
}
for(const plan of Plans.plans){
  test('Laminate is clipped to the floor outline without gaps or boards outside: '+plan.id,()=>{
    const boards=Room.floorBoards(plan);assert.equal(boards,Room.floorBoards(plan));
    let area=0;
    for(const b of boards){
      const points=b.points.map(([x,,z])=>[x,z]);
      for(const p of points)assert.ok(onFloor(p,plan),'board corner stays on the apartment floor');
      for(let i=0;i<4;i++){const a=points[i],c=points[(i+1)%4];assert.ok(onFloor([(a[0]+c[0])/2,(a[1]+c[1])/2],plan));}
      area+=(points[1][0]-points[0][0])*(points[2][1]-points[1][1]);
    }
    assert.ok(Math.abs(area-plan.area)<1e-6,`${area} != ${plan.area}`);
  });
  test('Toilets and sinks face into the room and stand against a solid wall: '+plan.id,()=>{
    for(const f of plan.fixtures.filter(f=>['toilet','vanity'].includes(f.type))){
      const {axis,at,thickness,inward}=f.backWall,[x,z,w,d]=f.bounds,front=[-Math.sin(f.rotation*Math.PI/2),Math.cos(f.rotation*Math.PI/2)];
      assert.ok(Math.abs(front[axis]-inward)<1e-9,'front faces away from its backing wall');
      const edge=f.bounds[axis]-inward*f.modelSize[1]/2;
      assert.ok(Math.abs((edge-at-inward*thickness/2)*inward-.012)<1e-9,'rear has only a 12 mm installation gap');
      for(const wall of [...plan.walls,...plan.perimeter]){
        assert.ok(Math.abs(x-wall[0])>=(w+wall[2])/2-1e-7||Math.abs(z-wall[1])>=(d+wall[3])/2-1e-7,'fixture does not intersect its wall');
      }
      for(const other of plan.fixtures.filter(other=>other!==f)){
        assert.ok(Math.abs(x-other.bounds[0])>=(w+other.bounds[2])/2-1e-7||Math.abs(z-other.bounds[1])>=(d+other.bounds[3])/2-1e-7,'fixture does not intersect another bathroom asset');
      }
    }
  });
}
test('Duplicate instances collide independently and curtains choose separate windows',()=>{
  const state={plan:'family',placed:{},rotations:{}};
  state.placed.desk=Room.suggest('desk',state);
  const p=Room.suggest('desk#2',state);assert.ok(p);assert.ok(Room.fits('desk#2',p,state));
  assert.equal(Room.fits('desk#2',state.placed.desk,state),false,'copy cannot overlap original');
  state.placed['desk#2']=p;state.rotations['desk#2']=1;
  assert.equal(Room.pieceFor('desk#2'),Room.pieces.desk);
  assert.equal(Room.footprint('desk#2',1)[0],Room.pieces.desk.size[1]);
  state.placed.curtain=Room.suggest('curtain',state);
  const curtain=Room.suggest('curtain#2',state);assert.ok(curtain);
  assert.equal(Room.fits('curtain#2',state.placed.curtain,state),false,'a window accepts only one curtain assembly');
  assert.ok(Room.fits('curtain#2',curtain,state));
});
