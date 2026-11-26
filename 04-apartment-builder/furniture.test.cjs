const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});
for(const name of ['plans','furniture','room'])vm.runInContext(fs.readFileSync(__dirname+'/assets/'+name+'.js','utf8'),context);
const {Room,Assets}=vm.runInContext('({Room:ApartmentRoom,Assets:ApartmentFurniture})',context);
test('Every furniture asset is finite, pickable geometry inside its placement footprint',()=>{
  for(const [key,item] of Object.entries(Room.pieces)){
    const mesh=Assets.model(key,item,Room.colors[0]);
    assert.ok(mesh.length>50,key+' has detailed geometry');
    assert.equal(mesh,Assets.model(key,item,Room.colors[0]),'asset is cached');
    const points=mesh.flatMap(f=>f.points);
    for(const axis of [0,2]){
      const extent=item.size[axis===0?0:1]/2;
      assert.ok(Math.abs(Math.min(...points.map(p=>p[axis]))+extent)<1e-8,key+' lower visual edge equals footprint');
      assert.ok(Math.abs(Math.max(...points.map(p=>p[axis]))-extent)<1e-8,key+' upper visual edge equals footprint');
    }
    for(const face of mesh){
      assert.match(face.color,/^#[\da-f]{6}([\da-f]{2})?$/i);
      assert.ok(face.points.length>=3);
      assert.equal(face.normals.length,face.points.length);
      assert.ok(face.normals.every(n=>n.every(Number.isFinite)&&Math.hypot(...n)>.9),'smooth normals remain finite');
      assert.equal(face.uv.length,face.points.length);
      for(const [x,y,z] of face.points){
        assert.ok([x,y,z].every(Number.isFinite),key);
        assert.ok(Math.abs(x)<=item.size[0]/2+.04,key+' width');
        assert.ok(Math.abs(z)<=item.size[1]/2+.04,key+' depth');
        assert.ok(y>=0&&y<=item.height+.12,key+' height');
      }
    }
  }
});

test('Bathroom assets have curved porcelain bowls, faucets, detailed tanks and finite geometry',()=>{
  for(const type of ['toilet','vanity','bath','shower'])for(const size of [[.7,1.6],[1.6,.7]]){
    const h=type==='shower'?2:1,mesh=Assets.model('bathroom-test:'+type+size,{size,height:h,type},Room.colors[0]);
    assert.ok(mesh.length>150,type+' has detailed geometry');
    for(const f of mesh){
      assert.ok(f.points.every(p=>p.every(Number.isFinite)));
      assert.ok(f.normals.every(p=>p.every(Number.isFinite)));
      assert.ok(f.points.every(([x,y,z])=>Math.abs(x)<=size[0]/2+1e-8&&Math.abs(z)<=size[1]/2+1e-8&&y>=0&&y<=h+.01),type);
    }
  }
});

test('Rug can go under furniture and furniture can be put on an existing rug',()=>{
  const plan=vm.runInContext('ApartmentPlans.plans.find(p=>p.id==="family")',context);
  const state={plan:plan.id,placed:{},rotations:{}};
  const point=Room.suggest('rug',state);assert.ok(point);
  state.placed.coffee=[...point];
  assert.equal(Room.fits('rug',point,state),true,'furniture does not block laying a rug');
  delete state.placed.coffee;state.placed.rug=[...point];
  assert.equal(Room.fits('coffee',point,state),true,'rug does not reserve furniture clearance');
  state.walking=true;state.walker={position:[...point]};
  assert.equal(Room.fits('rug',point,state),true,'rug can be laid beneath the player');
  const navContext=vm.createContext({});
  for(const name of ['plans','room','navigation'])vm.runInContext(fs.readFileSync(__dirname+'/assets/'+name+'.js','utf8'),navContext);
  const Nav=vm.runInContext('ApartmentNavigation',navContext);
  assert.equal(Nav.canStand(point,state),true,'rug is walkable');
});

test('Furniture can touch walls and neighbors exactly, while genuine overlap is rejected',()=>{
  const Plans=vm.runInContext('ApartmentPlans',context);
  Plans.plans.push({id:'contact-test',width:6,depth:6,outline:[[-3,-3],[3,-3],[3,3],[-3,3]],
    walls:[],perimeter:[[-3,0,.2,6],[3,0,.2,6],[0,-3,6,.2],[0,3,6,.2]],doors:[],windows:[],fixtures:[],zones:[]});
  const state={plan:'contact-test',placed:{},rotations:{}};
  const [w,d]=Room.footprint('sofa'),x=-2.9+w/2,z=2.9-d/2;
  assert.equal(Room.fits('sofa',[x,0],state),true);
  assert.equal(Room.fits('sofa',[x-.001,0],state),false);
  const snapped=Room.snapPoint('sofa',[x+.04,z-.04],state);
  assert.ok(Math.abs(snapped[0]-x)<1e-8&&Math.abs(snapped[1]-z)<1e-8,'drag snaps flush into a corner');
  state.rotations.sofa=1;
  const rotated=Room.snapPoint('sofa',[-2.9+d/2+.03,0],state);
  assert.ok(Math.abs(rotated[0]-(-2.9+d/2))<1e-8);
  state.rotations.sofa=0;state.placed.plant=[0,0];
  const touch=(w+Room.pieces.plant.size[0])/2;
  assert.equal(Room.fits('sofa',[touch,0],state),true);
  assert.equal(Room.fits('sofa',[touch-.001,0],state),false);
  assert.ok(Math.abs(Room.snapPoint('sofa',[touch+.03,0],state)[0]-touch)<1e-8);
});
