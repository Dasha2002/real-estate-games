'use strict';

const ConstructionJump=(()=>{
  const width=400,height=640,base=70,floorHeight=180;
  const gravity=1700,jumpSpeed=710,moveSpeed=255,playerRadius=15;
  const platformWidth=88;
  const springSpeed=jumpSpeed*Math.sqrt(2.25);
  const boosts={propeller:{name:'Каска с пропеллером',duration:1.6,speed:390},jetpack:{name:'Джетпак',duration:2.1,speed:510},crane:{name:'Подъёмник крана',duration:1.8,speed:430}};
  const tiers=[{at:0,name:'Разминка'},{at:1200,name:'Рабочий ритм'},{at:3000,name:'Высотные работы'},{at:5500,name:'Экстрим'},{at:100*floorHeight,name:'За облаками'}];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const difficulty=altitude=>clamp((altitude-base)/7000,0,1);
  const tier=altitude=>tiers.reduce((current,item,index)=>altitude-base>=item.at?index:current,0);
  const travel=platform=>platform.type==='moving'?platform.amplitude:0;

  // Check actual jump arcs, rather than excluding cargo from every platform.
  // The landing strip remains valid over the platform's full horizontal motion.
  function landingPoints(p){
    const edge=Math.max(0,Math.min(32,p.w/2+playerRadius*.7-travel(p)-8));
    return [-edge,0,edge].map(offset=>({x:p.anchor+offset,y:p.y,speed:p.type==='spring'?springSpeed:jumpSpeed,platform:p.id}));
  }
  function clearJump(a,b,obstacles,canWrap){
    const dy=b.y-a.y,discriminant=a.speed*a.speed-2*gravity*dy;
    if(dy<=0||discriminant<0)return false;
    const duration=(a.speed+Math.sqrt(discriminant))/gravity;
    let dx=b.x-a.x;
    const period=width+2*playerRadius;
    if(canWrap&&Math.abs(dx)>period/2)dx-=Math.sign(dx)*period;
    // Leave enough steering authority to counter the strongest wind.
    if(Math.abs(dx)>duration*(moveSpeed-72))return false;
    for(let i=0;i<=64;i++){
      const t=duration*i/64,y=a.y+a.speed*t-gravity*t*t/2;
      let x=a.x+dx*i/64;
      if(canWrap)x=((x+playerRadius)%period+period)%period-playerRadius;
      for(const o of obstacles)if(Math.abs(x-o.anchor)<55&&y<o.baseY+28&&y+58>o.baseY-28)return false;
    }
    return true;
  }
  function bypassPath(platforms,start,end,obstacles,canWrap){
    const nodes=platforms.filter(p=>!p.broken&&p.y>=start.y&&p.y<=end.y).sort((a,b)=>a.y-b.y).flatMap(landingPoints);
    const paths=new Map();
    for(const node of nodes){
      if(node.platform===start.id){paths.set(node,[node]);continue;}
      for(const [from,path] of paths){
        if(clearJump(from,node,obstacles,canWrap)){paths.set(node,[...path,node]);break;}
      }
      if(node.platform===end.id&&paths.has(node))return paths.get(node);
    }
    return null;
  }
  function resolveObstacles(state){
    for(const item of state.obstacles){
      if(!item.pending||state.nextY<item.baseY+200)continue;
      const route=state.platforms.filter(p=>p.route!==null).sort((a,b)=>a.y-b.y);
      let index=route.length-1;while(index>=0&&route[index].y>=item.baseY-23)index--;
      const support=route[index],start=route[Math.max(0,index-2)],end=route[index+2];
      if(!support||!start||!end){item.destroyed=true;continue;}
      const canWrap=support.y>=base+50*floorHeight;
      const others=state.obstacles.filter(o=>o!==item&&!o.pending&&!o.destroyed);
      // Alternate which part of the nearby route is threatened. Never scan
      // from the left edge: that biased every accepted load toward one side.
      const sign=item.anchor<support.anchor?-1:1;
      const candidates=[support.anchor+sign*24,support.anchor-sign*24,
        support.anchor+sign*52,support.anchor-sign*52,route[index+1].anchor];
      let accepted=false;
      for(const candidate of candidates){
        item.x=item.anchor=clamp(candidate,50,width-50);
        const hazards=[...others,item];
        let path=bypassPath(state.platforms,start,end,hazards,canWrap);
        if(!path){
          const xs=[60,110,160,200,240,290,340].sort((a,b)=>
            Math.abs(b-item.anchor)-Math.abs(a-item.anchor));
          for(const x of xs){
            const detour={id:state.nextId+1,route:null,x,anchor:x,y:support.y,w:platformWidth,
              type:support.hard?'moving':'normal',hard:support.hard,amplitude:14,
              speed:support.speed,phase:support.phase,broken:false,detour:true};
            const clear=state.platforms.every(p=>Math.abs(p.y-detour.y)>=48||
              Math.abs(p.anchor-x)>=platformWidth+12+travel(p)+travel(detour));
            if(!clear)continue;
            path=bypassPath([...state.platforms,detour],start,end,hazards,canWrap);
            if(path){state.nextId++;state.platforms.push(detour);break;}
          }
        }
        if(path){item.safeRoute=path;item.supportId=support.id;item.pending=false;accepted=true;break;}
      }
      if(!accepted)item.destroyed=true;
    }
    state.obstacles=state.obstacles.filter(item=>!item.destroyed);
  }
  function routeX(state,hard){
    const random=state.random,canWrap=state.nextY>=base+50*floorHeight;
    if(!state.routePlan || state.routePlan.left===0){
      const choices=canWrap?(hard?['scatter','zigzag','climb','tight','edge','edge']:['scatter','zigzag','climb','tight','edge']):['scatter','zigzag','climb','tight'];
      const available=choices.filter(mode=>mode!==state.routePlan?.mode);
      const mode=available[Math.floor(random()*available.length)];
      state.routePlan={mode,left:mode==='edge'?5+Math.floor(random()*5):3+Math.floor(random()*5),
        direction:random()<.5?-1:1,target:random()<.5?28:width-28};
    }
    const plan=state.routePlan;plan.left--;
    const x=state.nextX;
    if(plan.mode==='edge'){
      if((x<=40 || x>=width-40) && random()<.8)return x<width/2?width-24-random()*8:24+random()*8;
      return x+clamp(plan.target-x,-75,75);
    }
    if(plan.mode==='tight')return clamp(x+(random()*2-1)*28,36,width-36);
    if(plan.mode==='scatter')return clamp(x+(random()*2-1)*78,36,width-36);
    if(plan.mode==='zigzag' && random()<.65)plan.direction*=-1;
    const step=(35+random()*42)*plan.direction;
    if(x+step<36 || x+step>width-36)plan.direction*=-1;
    return clamp(x+Math.abs(step)*plan.direction,36,width-36);
  }

  function addRoute(state){
    const id=++state.nextRoute,t=difficulty(state.nextY),random=state.random;
    const gap=78+30*t+random()*16;
    state.nextY+=gap;
    const hard=state.nextY>=base+100*floorHeight;
    const pressure=clamp((state.nextY-base-100*floorHeight)/(100*floorHeight),0,1);
    const previousX=state.nextX;
    state.nextX=routeX(state,hard);
    const wrapSection=state.routePlan.mode==='edge';
    const roll=random(),type=hard?'moving':wrapSection?'normal':id<3?'normal':id%11===0?'spring':roll<.09+.25*t?'fragile':roll<.18+.55*t?'moving':'normal';
    const platform={id:++state.nextId,route:id,x:state.nextX,anchor:state.nextX,y:state.nextY,
      w:platformWidth,type,hard,wrap:wrapSection&&Math.abs(state.nextX-previousX)>width/2,broken:false,
      pattern:state.routePlan.mode,phase:random()*Math.PI*2,
      speed:hard?5.8+2*pressure+random()*.5:1.6+2.5*t,amplitude:hard?14+random()*8:18+20*t};
    state.platforms.push(platform);
    state.materials.push({id,x:state.nextX,y:state.nextY+48,collected:false});
    // Extra footholds are frequent near the ground and become rare at altitude.
    if(random()<.72-.59*t && !wrapSection && t<.6){
      const offset=(random()<.5?-1:1)*(95+random()*25);
      const x=clamp(state.nextX+offset,45,width-45);
      const extra={id:state.nextId+1,route:null,x,anchor:x,y:state.nextY-12+random()*25,w:platformWidth,type:'normal',broken:false};
      // Reserve the full travel envelope, so nearby platforms never intersect
      // later when a moving scaffold changes direction.
      const clear=state.platforms.every(other=>Math.abs(extra.y-other.y)>=48 ||
        Math.abs(extra.anchor-other.anchor)>=(extra.w+other.w)/2+12+(other.type==='moving'?other.amplitude:0));
      if(clear){state.nextId++;state.platforms.push(extra);}
    }
    if(!wrapSection && id>4 && id%27===0){
      const kind=['propeller','jetpack','crane'][Math.floor(id/27)%3];
      state.powerups.push({id,kind,x:state.nextX,y:state.nextY+55,collected:false});
    }
    if(id>=state.nextObstacle){
      const x=clamp(state.nextX+(random()<.5?-1:1)*(80+random()*65),55,width-55);
      const y=state.nextY+48+random()*34;
      state.obstacles.push({id,x,y,anchor:x,baseY:y,phase:random()*Math.PI*2,destroyed:false,pending:true});
      state.nextObstacle=id+(hard?7:10)+Math.floor(random()*(hard?8:10));
    }
  }

  function fillAhead(state){while(state.nextY<state.camera+height+260)addRoute(state);resolveObstacles(state);}
  function pruneBehind(state){
    const below=state.camera-170;
    state.platforms=state.platforms.filter(item=>item.y>=below);
    state.materials=state.materials.filter(item=>item.y>=below);
    state.powerups=state.powerups.filter(item=>item.y>=below);
    state.obstacles=state.obstacles.filter(item=>!item.destroyed && item.y>=below);
    state.shots=state.shots.filter(item=>!item.done && item.y>=below && item.y<state.camera+height+300);
    state.effects=state.effects.filter(item=>state.time-item.at<.45);
  }

  function create(random=Math.random){
    const first={id:0,route:0,x:width/2,anchor:width/2,y:base,w:platformWidth,type:'base',broken:false};
    const state={phase:'ready',time:0,random,player:{x:width/2,y:base,vy:0,facing:1},camera:0,maxHeight:base,
      platforms:[first],materials:[],powerups:[],obstacles:[],shots:[],effects:[],destroyed:0,shootAt:0,
      boost:null,boostsUsed:0,collected:0,bounces:0,lastRoute:0,nextRoute:0,nextId:0,
      nextY:base,nextX:width/2,routePlan:null,nextObstacle:12+Math.floor(random()*7),lastLandingY:base,tier:0,
      notice:'Поднимайтесь по лесам. Касание платформы автоматически подбрасывает строителя.'};
    fillAhead(state);return state;
  }

  function start(state){if(state.phase==='ready'){state.phase='running';state.player.vy=jumpSpeed;}}
  function pause(state){if(state.phase==='running')state.phase='paused';}
  function resume(state){if(state.phase==='paused')state.phase='running';}
  function shoot(state){
    if(state.phase!=='running' || state.time<state.shootAt)return false;
    state.shots.push({x:state.player.x,y:state.player.y+64,done:false});
    state.shootAt=state.time+.26;return true;
  }
  function destroy(state,item){
    item.destroyed=true;state.destroyed++;
    state.effects.push({x:item.x,y:item.y,at:state.time});
  }
  function floors(state){return Math.max(0,Math.floor((state.maxHeight-base)/floorHeight));}
  function score(state){return Math.floor((state.maxHeight-base)/10)+state.collected*15+state.destroyed*50;}
  function wind(state){
    if(state.maxHeight<1400)return 0;
    const band=Math.floor((state.player.y-base)/720);
    if(band%3===0)return 0;
    return (band%2?1:-1)*(30+42*difficulty(state.maxHeight));
  }

  function tick(state,dt,direction){
    state.time+=dt;
    const p=state.player,previousY=p.y;
    if(direction)p.facing=Math.sign(direction);
    p.x+=(clamp(direction,-1,1)*moveSpeed+wind(state)*(state.boost ? .25 : 1))*dt;
    if(p.x<-playerRadius)p.x=width+playerRadius;
    if(p.x>width+playerRadius)p.x=-playerRadius;
    if(state.boost && state.time<state.boost.until)p.vy=boosts[state.boost.kind].speed;
    else {state.boost=null;p.vy-=gravity*dt;}
    p.y+=p.vy*dt;
    for(const platform of state.platforms){
      if(platform.type==='moving')platform.x=clamp(platform.anchor+Math.sin(state.time*platform.speed+platform.phase)*platform.amplitude,platform.hard?22:45,width-(platform.hard?22:45));
    }
    for(const item of state.obstacles){
      if(item.pending)continue;
      const previousTop=item.y+19;
      item.x=item.anchor+Math.sin(state.time*3+item.phase)*9;
      item.y=item.baseY+Math.sin(state.time*2.4+item.phase)*4;
      for(const shot of state.shots){
        if(shot.done || item.destroyed)continue;
        if(Math.abs(shot.x-item.x)<=31 && shot.y<=item.y+23 && shot.y+900*dt>=item.y-23){
          shot.done=true;destroy(state,item);state.notice='Груз разрушен выстрелом! +50 очков';
        }
      }
      if(item.destroyed || state.boost)continue;
      const aligned=Math.abs(p.x-item.x)<38,top=item.y+19;
      if(aligned && p.vy<0 && previousY>=previousTop && p.y<=top){
        p.y=top;p.vy=springSpeed;state.boost=null;state.bounces++;state.lastLandingY=top;
        destroy(state,item);state.notice='Прыжок на груз! Отскок как от пружины. +50 очков';
      }else if(aligned && p.y<top && p.y+58>item.y-19){
        state.phase='failed';state.notice='Столкновение с грузом. Стреляйте или прыгайте на него сверху!';return;
      }
    }
    for(const shot of state.shots)shot.y+=900*dt;
    if(p.vy<0){
      for(const platform of state.platforms){
        if(platform.broken||previousY<platform.y||p.y>platform.y)continue;
        if(Math.abs(p.x-platform.x)>platform.w/2+playerRadius*.7)continue;
        p.y=platform.y;p.vy=platform.type==='spring'?springSpeed:jumpSpeed;state.bounces++;state.lastLandingY=platform.y;
        if(platform.route!==null)state.lastRoute=Math.max(state.lastRoute,platform.route);
        if(platform.type==='fragile')platform.broken=true;
        if(platform.type==='spring'){platform.bounceAt=state.time;state.notice='Пружина! Высота прыжка ×2,25.';}
        break;
      }
    }
    for(const item of state.materials){
      if(item.collected)continue;
      if(Math.abs(p.x-item.x)<26&&Math.abs((p.y-20)-item.y)<30){
        item.collected=true;state.collected++;state.notice='Материал доставлен! +15 очков';
      }
    }
    for(const item of state.powerups){
      if(item.collected)continue;
      if(Math.abs(p.x-item.x)<29 && Math.abs((p.y-27)-item.y)<38){
        item.collected=true;state.boost={kind:item.kind,until:state.time+boosts[item.kind].duration};
        p.vy=boosts[item.kind].speed;state.boostsUsed++;
        state.notice=boosts[item.kind].name+'! Подъём включён — управляйте направлением.';
      }
    }
    state.maxHeight=Math.max(state.maxHeight,p.y);
    state.camera=Math.max(state.camera,p.y-(height-280));
    const nextTier=tier(state.maxHeight);
    if(nextTier>state.tier){state.tier=nextTier;state.notice=`Новый этап: ${tiers[nextTier].name.toLowerCase()}. Лесов меньше, движение быстрее.`;}
    fillAhead(state);pruneBehind(state);
    if(p.y<state.camera-65){state.phase='failed';state.notice='Строитель сорвался. Попробуйте ещё раз.';}
  }

  function advance(state,seconds,direction=0){
    if(state.phase!=='running'||!Number.isFinite(seconds)||seconds<=0)return;
    let remaining=Math.min(seconds,.12);
    while(remaining>1e-8&&state.phase==='running'){
      const dt=Math.min(1/120,remaining);tick(state,dt,direction);remaining-=dt;
    }
  }
  return {width,height,base,floorHeight,platformWidth,gravity,jumpSpeed,springSpeed,boosts,moveSpeed,tiers,difficulty,tier,wind,
    create,start,pause,resume,shoot,advance,floors,score};
})();
if(typeof module!=='undefined')module.exports=ConstructionJump;
