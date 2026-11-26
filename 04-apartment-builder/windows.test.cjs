const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});
for(const name of ['plans','furniture','room','navigation'])vm.runInContext(fs.readFileSync(__dirname+'/assets/'+name+'.js','utf8'),context);
const {Room,Plans,Assets,Nav}=vm.runInContext('({Room:ApartmentRoom,Plans:ApartmentPlans,Assets:ApartmentFurniture,Nav:ApartmentNavigation})',context);
const inside=(volumes,[x,y,z])=>volumes.some(v=>y>v.low&&y<v.high&&Math.abs(x-v.rect[0])<v.rect[2]/2&&Math.abs(z-v.rect[1])<v.rect[3]/2);
test('Window walls have the same full thickness above and below the opening',()=>{
  for(const plan of Plans.plans)for(const w of plan.windows){
    if(plan.doors.some(d=>d.horizontal===w.horizontal&&Math.abs(d.at-w.at)<.01&&d.from<=w.from+.01&&d.to>=w.to-.01))continue;
    const t=Room.windowThickness(plan,w),mid=(w.from+w.to)/2,mesh=Room.wallGeometry(plan,false,true);
    for(const y of [.4,2.5])for(const side of [-1,1]){
      const at=w.at+side*(t/2-.001);
      assert.equal(inside(mesh.volumes,w.horizontal?[mid,y,at]:[at,y,mid]),true,plan.id+' wall face stays flush');
    }
  }
});
test('Curtains mount only at windows and snap to the matching wall orientation',()=>{
  for(const plan of Plans.plans){
    const state={plan:plan.id,placed:{},rotations:{}};
    const suggestion=Room.suggest('curtain',state),mount=Room.curtainMount(suggestion,state);
    assert.ok(mount);assert.equal(Room.fits('curtain',suggestion,state),true);
    assert.ok(Math.abs(mount.width-(mount.window.to-mount.window.from+.28))<1e-9);
    assert.equal(mount.rotation,{top:0,bottom:2,left:3,right:1}[mount.window.side]);
    assert.equal(Room.fits('curtain',[50,50],state),false);
    const moved=[suggestion[0]+.02,suggestion[1]+.02];
    const snapped=Room.snapPoint('curtain',moved,state);
    assert.ok(Math.hypot(snapped[0]-suggestion[0],snapped[1]-suggestion[1])<1e-9);
    state.placed.sofa=[...suggestion];assert.equal(Room.fits('curtain',suggestion,state),true,'hanging fabric can overlap furniture');
  }
});
test('Curtain cloth is translucent; each ordinary window has a fixed radiator',()=>{
  const cloth=Assets.model('curtain',Room.pieces.curtain,Room.colors[0]).filter(f=>f.material==='tulle');
  assert.ok(cloth.length>100);assert.ok(cloth.every(f=>f.color.slice(0,7)==='#ffffff'&&f.color.length===9&&parseInt(f.color.slice(7),16)>0&&parseInt(f.color.slice(7),16)<180),'white, translucent tulle has no beige or red tint');
  assert.equal(Room.pieces.radiator,undefined,'radiator is not in the editable furniture inventory');
  for(const plan of Plans.plans){
    const heaters=Room.radiators(plan);assert.ok(heaters.length>0);assert.equal(heaters,Room.radiators(plan));
    for(const r of heaters){
      assert.equal(Nav.canStand(r.point,{plan:plan.id,placed:{},rotations:{}}),false,'heater is a physical fixture');
      assert.equal(Room.fits('plant',r.point,{plan:plan.id,placed:{},rotations:{}}),false);
    }
  }
});
test('A cabinet fits flush in a corner beside a window without an invented window clearance',()=>{
  const plan={id:'window-corner-test',width:6,depth:6,outline:[[-3,-3],[3,-3],[3,3],[-3,3]],
    walls:[],perimeter:[[-3,0,.2,6],[3,0,.2,6],[0,3,6,.2],[-2.3,-3,1.4,.2],[1.7,-3,2.6,.2]],
    windows:[{side:'top',horizontal:true,at:-3,from:-1.6,to:.4}],doors:[],fixtures:[],zones:[]};
  Plans.plans.push(plan);
  const state={plan:plan.id,placed:{},rotations:{}};
  const [w,d]=Room.footprint('wardrobe'),point=[-2.9+w/2,-2.9+d/2];
  assert.equal(Room.fits('wardrobe',point,state),true,'corner beside the opening accepts a tall cabinet');
  const curtain=Room.suggest('curtain',state);state.placed.curtain=curtain;
  assert.equal(Room.fits('wardrobe',point,state),true,'fabric does not reserve floor area');
});
