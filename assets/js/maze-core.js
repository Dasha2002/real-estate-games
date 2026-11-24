'use strict';
const MazeWorld = (() => {
  const taskTypes=['math','memory','route','sort','pipes','puzzle','blocks','balance','clean','colors','clock','football','rhythm','circuit','wind','constellation','shopping','delivery','plant','silhouette','safe','aquarium','stack','solar','order','services','mosaic','furniture','differences','signal'];
  function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function solve(grid,start,goal,closed=new Set()){
    const n=grid.length,idx=(x,y)=>y*n+x,begin=idx(start.x,start.y),end=idx(goal.x,goal.y),queue=[begin],prev=new Map([[begin,-1]]);let head=0;
    while(head<queue.length){const c=queue[head++];if(c===end)break;const x=c%n,y=Math.floor(c/n);for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy,k=idx(nx,ny);if(!grid[ny]||grid[ny][nx]!==0||closed.has(k)||prev.has(k))continue;prev.set(k,c);queue.push(k);}}
    if(!prev.has(end))return null;const path=[];for(let k=end;k!==-1;k=prev.get(k))path.push({x:k%n,y:Math.floor(k/n)});return path.reverse();
  }
  function generate(level){
    const size=7+2*level,n=size,grid=Array.from({length:n},()=>Array(n).fill(1)),rng=random(5873+level*771+(level===10?1:0)),stack=[{x:1,y:1}];grid[1][1]=0;
    while(stack.length){const p=stack.at(-1),dirs=[[2,0],[0,2],[-2,0],[0,-2]].filter(([dx,dy])=>p.x+dx>0&&p.y+dy>0&&p.x+dx<n-1&&p.y+dy<n-1&&grid[p.y+dy][p.x+dx]===1);if(!dirs.length){stack.pop();continue;}const [dx,dy]=dirs[Math.floor(rng()*dirs.length)];grid[p.y+dy/2][p.x+dx/2]=0;grid[p.y+dy][p.x+dx]=0;stack.push({x:p.x+dx,y:p.y+dy});}
    const start={x:1,y:1},queue=[{...start,dist:0}],seen=new Set(['1,1']);let head=0,goal=start;
    while(head<queue.length){const p=queue[head++];goal=p;for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){const x=p.x+dx,y=p.y+dy,k=x+','+y;if(grid[y]?.[x]===0&&!seen.has(k)){seen.add(k);queue.push({x,y,dist:p.dist+1});}}}
    goal={x:goal.x,y:goal.y};const path=solve(grid,start,goal);
    const gates=[.25,.5,.75].map((f,i)=>({...path[Math.max(2,Math.floor((path.length-1)*f))],id:i,type:taskTypes[(level-1)*3+i]}));
    return {grid,n,start,goal,gates,path,level,reward:level<=3?20:level<=7?40:80};
  }
  function visible(grid,from,to){const distance=Math.hypot(to.x-from.x,to.y-from.y);for(let t=.08;t<distance-.25;t+=.08){const x=Math.floor(from.x+(to.x-from.x)*t/distance),y=Math.floor(from.y+(to.y-from.y)*t/distance);if(grid[y]?.[x]!==0)return false;}return true;}
  return {generate,solve,visible};
})();
