'use strict';

const ApartmentNavigation=(()=>{
  const radius=.21;
  function canStand(point,state){
    const plan=ApartmentRoom.floorPlan(state),[x,z]=point;
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      if(!ApartmentPlans.contains([x+Math.cos(a)*radius,z+Math.sin(a)*radius],plan.outline))return false;
    }
    // Some glazed openings are also balcony doors in the source geometry.
    const windows=plan.windows.filter(w=>!plan.doors.some(d=>d.horizontal===w.horizontal&&Math.abs(d.at-w.at)<.01&&d.from<=w.from+.01&&d.to>=w.to-.01))
      .map(w=>w.horizontal?[(w.from+w.to)/2,w.at,w.to-w.from,.16]:[w.at,(w.from+w.to)/2,.16,w.to-w.from]);
    const occupied=[...plan.walls,...plan.perimeter,...windows,...plan.fixtures.map(f=>f.bounds),
      ...Object.entries(state.placed).map(([key,p])=>[...p,...ApartmentRoom.footprint(key,state.rotations[key]||0)])];
    return occupied.every(([cx,cz,w,d])=>{
      const dx=Math.max(Math.abs(x-cx)-w/2,0),dz=Math.max(Math.abs(z-cz)-d/2,0);
      return Math.hypot(dx,dz)>=radius;
    });
  }
  function spawn(state){
    const plan=ApartmentRoom.floorPlan(state);
    if(state.walker?.plan===state.plan&&canStand(state.walker.position,state))return state.walker;
    const e=plan.entry,mid=(e.from+e.to)/2;
    const origin=e.horizontal?[mid,e.at]:[e.at,mid];
    let point=null,best=Infinity;
    for(let x=-plan.width/2+radius;x<plan.width/2;x+=.15)for(let z=-plan.depth/2+radius;z<plan.depth/2;z+=.15){
      const distance=Math.hypot(x-origin[0],z-origin[1]);
      if(distance<best&&canStand([x,z],state)){point=[x,z];best=distance;}
    }
    const main=plan.zones.find(zone=>zone.id==='living')||plan.zones.find(zone=>zone.id==='bedroom');
    const facing=point&&main?Math.atan2(main.label[0]-point[0],main.label[1]-point[1]):Math.PI;
    state.walker=point?{position:point,facing,phase:0,plan:state.plan}:null;
    return state.walker;
  }
  function move(state,side,forward,angle,seconds){
    if(!state.walker)return false;
    const length=Math.hypot(side,forward);
    if(!length)return false;
    const speed=1.65*Math.max(0,Math.min(seconds,.1))/length;
    const dx=(side*Math.cos(angle)-forward*Math.sin(angle))*speed;
    const dz=(-side*Math.sin(angle)-forward*Math.cos(angle))*speed;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));
    const before=[...state.walker.position],p=state.walker.position;
    for(let i=0;i<steps;i++){
      if(canStand([p[0]+dx/steps,p[1]],state))p[0]+=dx/steps;
      if(canStand([p[0],p[1]+dz/steps],state))p[1]+=dz/steps;
    }
    const distance=Math.hypot(p[0]-before[0],p[1]-before[1]);
    if(distance>.00001){state.walker.facing=Math.atan2(dx,dz);state.walker.phase+=distance*8;return true;}
    return false;
  }
  return {radius,canStand,spawn,move};
})();
