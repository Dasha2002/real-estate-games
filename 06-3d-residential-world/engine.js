'use strict';

const MoveInArcade=(()=>{
  const duration=90,capacity=12,windowCount=48,windowCost=1000;
  const dropHeight=5.6,bedHeight=1.05,fallSpeed=2.5,crateSize=.62,fieldWidth=9.5;
  const minX=.1,maxX=.88;
  const lanes={blue:{title:'Дальний план',z:-1.8},brown:{title:'Ближний план',z:1.5}};
  const shapes={
    single:{title:'Блок',value:100,height:1,width:1,cells:[[0,0]]},
    wide:{title:'Панель',value:150,height:1,width:2,cells:[[0,0],[1,0]]},
    corner:{title:'Уголок',value:200,height:2,width:2,cells:[[0,0],[0,1],[1,1]]}
  };
  const levels={
    easy:{title:'Лёгкий',interval:1.18,hazard:0,description:'Для знакомства с игрой: редкие грузы, без опасных баллонов.'},
    normal:{title:'В темпе',interval:.88,hazard:.14,description:'Грузы чаще. После 12 секунд появляются опасные баллоны.'},
    hard:{title:'Час пик',interval:.65,hazard:.22,description:'Плотный поток и больше опасностей. Скорость падения прежняя.'}
  };
  function create(level='normal',random=Math.random){
    if(!levels[level])level='normal';
    return {level,random,phase:'ready',elapsed:0,player:.5,lane:'brown',moving:0,cargo:[],falling:[],loading:[],deliveries:[],materials:0,submitted:0,lit:0,litAt:[],missed:0,caught:0,crashes:0,dodged:0,spawnIn:.8,sequence:0,deck:[],hazardIntroduced:false,stunnedUntil:0,invulnerableUntil:0,notice:{id:0,text:'↑ — синий план, ↓ — коричневый. Пробел — сдать всю стопку.',at:0},lastBatch:null,effect:null,impact:null};
  }
  function notify(s,text){s.notice={id:s.notice.id+1,text,at:s.elapsed};}
  function cargoCount(s){return s.cargo.reduce((sum,item)=>sum+(item.count??shapes[item.shape].cells.length),0);}
  function multiplier(s){const count=cargoCount(s);return count>=7?3:count>=4?2:1;}
  function start(s){if(s.phase==='ready')s.phase='running';}
  function pause(s){if(s.phase==='running')s.phase='paused';}
  function resume(s){if(s.phase==='paused')s.phase='running';}
  function switchLane(s,lane){
    if(s.phase!=='running'||!lanes[lane]||s.elapsed<s.stunnedUntil)return false;
    s.lane=lane;return true;
  }
  function submit(s){
    if(s.phase!=='running'||!s.cargo.length||s.elapsed<s.stunnedUntil)return null;
    const raw=Math.round(s.cargo.reduce((sum,item)=>sum+(item.value??shapes[item.shape].value),0)),factor=multiplier(s),count=cargoCount(s);
    const amount=raw*factor,before=s.lit;
    s.deliveries.push({at:s.elapsed,x:(s.player-.5)*fieldWidth,lane:s.lane,
      boxes:s.cargo.flatMap(item=>Array.from({length:item.count??shapes[item.shape].cells.length},()=>({lane:item.lane,shape:'single'})))});
    s.materials+=amount;s.submitted+=count;s.cargo=[];s.loading=[];
    const lit=Math.min(windowCount,Math.floor(s.materials/windowCost));
    while(s.lit<lit){s.litAt.push(s.elapsed);s.lit++;}
    s.lastBatch={raw,factor,amount,count,windows:s.lit-before,at:s.elapsed};
    s.effect={type:'submit',at:s.elapsed};
    notify(s,`Грузов на стройку: ${count}. ${raw} × ${factor} = ${amount} ед. материалов.${lit>before?' Зажглось окон: +'+(lit-before)+'.':' До следующего окна: '+(windowCost-s.materials%windowCost)+' ед.'}`);
    return s.lastBatch;
  }
  function spawn(s,settings){
    const hazard=settings.hazard>0&&s.elapsed>=12&&(!s.hazardIntroduced||s.random()<settings.hazard);
    let lane;
    if(hazard){s.hazardIntroduced=true;lane=s.random()<.5?'blue':'brown';}
    else{
      if(!s.deck.length)s.deck=s.random()<.5?['blue','brown']:['brown','blue'];
      lane=s.deck.shift();
    }
    const names=Object.keys(shapes),shape=names[Math.min(2,Math.floor(s.random()*3))];
    s.falling.push({id:++s.sequence,type:hazard?'hazard':'material',lane,shape,x:.12+s.random()*.76,progress:0});
  }
  function tick(s,dt,input){
    const settings=levels[s.level],before=s.player;
    s.elapsed+=dt;
    s.loading=s.loading.filter(part=>s.elapsed-part.at<.32);
    s.deliveries=s.deliveries.filter(batch=>s.elapsed-batch.at<1.6);
    if(s.elapsed>=s.stunnedUntil){
      if(input.direction)s.player+=Math.sign(input.direction)*1.02*dt;
      else if(Number.isFinite(input.target)){
        const delta=input.target-s.player;s.player+=Math.sign(delta)*Math.min(Math.abs(delta),1.02*dt);
      }
    }
    s.player=Math.max(minX,Math.min(maxX,s.player));s.moving=Math.sign(s.player-before);
    s.spawnIn-=dt;
    if(s.spawnIn<=0){spawn(s,settings);s.spawnIn+=settings.interval*(1-.18*s.elapsed/duration);}
    for(const box of s.falling){
      const previous=box.progress;
      // Both depth planes share a world-space drop height, loading height and
      // constant velocity. Perspective never changes the simulation or airtime.
      box.progress+=dt*fallSpeed/(dropHeight-bedHeight);
      const crossing=previous<1&&box.progress>=1;
      const halfCrate=box.type==='hazard'?crateSize*.55:shapes[box.shape].width*crateSize/2;
      const aligned=box.lane===s.lane&&Math.abs(box.x-s.player)<=(.72+halfCrate)/fieldWidth;
      if(crossing&&aligned&&s.elapsed>=s.stunnedUntil){
        if(box.type==='hazard'&&s.elapsed>=s.invulnerableUntil){
          s.cargo=[];s.loading=[];s.crashes++;s.stunnedUntil=s.elapsed+.65;s.invulnerableUntil=s.elapsed+1.2;box.done=true;
          s.impact={at:s.elapsed,x:box.x,lane:box.lane};
          s.effect={type:'impact',at:s.elapsed};notify(s,'Опасный баллон! Несданная стопка потеряна. Готовые окна остались гореть.');
        }else if(box.type==='material'){
          const shape=shapes[box.shape],size=shape.cells.length,occupied=cargoCount(s),take=Math.min(size,capacity-occupied);
          if(take>0){
            s.cargo.push({lane:box.lane,shape:box.shape,count:take,value:shape.value*take/size});s.caught+=take;
            box.done=take===size;
            if(take<size){
              // Detach the lowest boxes first; the uncollected cells keep falling.
              const cells=[...shape.cells].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
              for(let i=0;i<take;i++){
                const [cx,cy]=cells[i];
                s.loading.push({at:s.elapsed,slot:occupied+i,lane:box.lane,x:(box.x-.5)*fieldWidth+(cx-shape.width/2+.5)*crateSize,y:dropHeight-box.progress*(dropHeight-bedHeight)+(shape.height-1-cy)*crateSize});
              }
              box.cells=cells.slice(take);
            }
            const count=cargoCount(s);
            notify(s,take<size?`Из связки загружено ${take} из ${size} коробок. Кузов полон: 12 из 12. Пробел — сдать.`:count===capacity?'Кузов полон: 12 из 12. Сдайте груз пробелом, чтобы ловить новые коробки.':`Поймано коробок: ${take}. В кузове ${count}/${capacity}, множитель ×${multiplier(s)}. Пробел — сдать.`);
          }else notify(s,'Кузов полон: 12 из 12. Сдайте груз пробелом.');
        }
      }
      const groundProgress=dropHeight/(dropHeight-bedHeight);
      if(!box.done&&box.progress>=groundProgress){
        if(box.type==='hazard')s.dodged++;else s.missed++;
        box.done=true;
      }
    }
    s.falling=s.falling.filter(box=>!box.done);
  }
  function advance(s,seconds,input={}){
    if(s.phase!=='running'||!Number.isFinite(seconds)||seconds<=0)return;
    let remaining=Math.min(seconds,duration-s.elapsed);
    while(remaining>1e-8){const dt=Math.min(.02,remaining);tick(s,dt,input);remaining-=dt;}
    if(s.elapsed>=duration-1e-7){s.elapsed=duration;s.phase='finished';s.moving=0;}
  }
  return {duration,capacity,windowCount,windowCost,dropHeight,bedHeight,fallSpeed,crateSize,fieldWidth,minX,maxX,lanes,shapes,levels,create,start,pause,resume,switchLane,submit,cargoCount,multiplier,advance};
})();
if(typeof module!=='undefined')module.exports=MoveInArcade;
