'use strict';

// Simplified, hand-traced game geometry from the linked published plans.
// Areas come from the apartment cards. The linked drawings sometimes carry a different
// area, so these reconstructed dimensions are estimates for gameplay.
const ApartmentPlans = (() => {
  const definitions = [
    {
      id:'compact',title:'1-комнатная',area:31.3,source:'https://ingroupp.ru/flat/flat-6698885/',
      outline:[[0,0],[8,0],[8,4.8],[4.6,4.8],[4.6,6.9],[0,6.9]],
      zones:[
        ['bedroom','Спальня',[0,3.5,4.6,6.9]],
        ['kitchen','Кухня',[1.6,0,5.6,3.5]],
        ['bath','Ванная',[5.6,0,8,2.8]],
        ['hall','Прихожая',[4.6,2.8,8,4.8]],
        ['balcony','Лоджия',[0,0,1.6,3.5]]
      ],
      walls:[
        [1.6,0,1.6,3.5,[.35,2.55]],
        [0,3.5,4.6,3.5],
        [4.6,3.5,4.6,6.9,[3.67,4.65]],
        [5.6,0,5.6,2.8],
        [5.6,2.8,8,2.8,[6.05,7.25]]
      ],
      windows:[['left',0,.5,2.6,'balcony'],['left',0,4.05,5.9,'bedroom'],['left',1.6,.35,1.35,'kitchen']],
      entry:['right',8,3.25,4.45],
      fixtures:[
        ['kitchen',[3.63,.48,3.8,.7]],['shower',[6.73,.6,1.72,.85]],
        ['vanity',[7.45,1.48,.62,.43],'right'],['toilet',[7.29,2.19,.56,.62],'right']
      ]
    },
    {
      id:'family',title:'Евро 3-комнатная',area:63.1,source:'https://ingroupp.ru/flat/flat-6693284/',
      outline:[[0,0],[4.5,0],[4.5,2],[9.5,2],[9.5,9.8],[0,9.8]],
      zones:[
        ['bath-small','Санузел',[0,0,2,2]],['hall','Прихожая',[2,0,4.5,4.6]],
        ['bath','Ванная',[0,2,2,4.6]],['bedroom-child','Детская',[0,4.6,3.2,8.7]],
        ['balcony','Лоджия',[0,8.7,3.2,9.8]],
        ['living','Гостиная',[3.2,4.6,6.35,9.8]],
        ['bedroom','Спальня',[6.35,4.6,9.5,9.8]],
        ['kitchen','Кухня-ниша',[3.2,2,6.95,4.6]],
        ['wardrobe','Гардероб',[6.95,2,9.5,4.6]]
      ],
      walls:[
        [2,0,2,2,[1.02,1.96]],[0,2,2,2],
        [2,2,2,4.6,[2.9,3.95]],
        [0,4.6,3.2,4.6,[2.1,3.14]],
        [3.2,4.6,3.2,9.8],
        [0,8.7,3.2,8.7,[1.52,2.65]],
        [6.35,4.6,6.35,9.8,[4.86,5.96]],
        [6.95,2,6.95,4.6],
        [6.35,4.6,9.5,4.6,[7.45,8.6]]
      ],
      windows:[
        ['bottom',9.8,.38,2.85,'balcony'],['bottom',9.8,3.92,5.7,'living'],
        ['bottom',9.8,7.1,8.95,'bedroom'],['bottom',8.7,1.52,2.65,'bedroom-child']
      ],
      entry:['right',4.5,.95,1.95],
      fixtures:[
        ['shower',[.94,4.03,1.48,.78]],['vanity',[1.35,2.61,.72,.42],'top'],
        ['toilet',[.65,3.09,.54,.65],'left'],
        ['vanity',[.65,.43,.64,.44],'top'],['toilet',[.65,1.45,.55,.63],'left']
      ]
    },
    {
      id:'classic',title:'3-комнатная',area:64.4,source:'https://ingroupp.ru/flat/flat-6691768/',
      outline:[[0,0],[11.5,0],[11.5,8],[9,8],[9,9.3],[6.5,9.3],[6.5,8],[0,8]],
      zones:[
        ['bedroom','Спальня',[0,0,4.8,4.5]],
        ['bedroom-child','Детская 1',[4.8,0,8,4.5]],
        ['bedroom-second','Детская 2',[0,4.5,4.4,8]],
        ['balcony','Лоджия',[8,0,11.5,1.25]],
        ['kitchen','Кухня',[8,1.25,11.5,6]],
        ['bath-small','Санузел',[4.4,5.8,6.5,8]],
        ['bath','Ванная',[6.5,7,9,9.3]],
        ['hall','Прихожая',[9,6,11.5,8]]
      ],
      walls:[
        [4.8,0,4.8,4.5],[8,0,8,4.5],
        [0,4.5,4.8,4.5,[3.4,4.4]],
        [4.8,4.5,8,4.5,[6.64,7.8]],
        [4.4,4.5,4.4,8,[4.65,5.7]],
        [4.4,5.8,6.5,5.8,[4.55,5.65]],
        [6.5,5.8,6.5,9.3],
        [6.5,7,9,7,[6.8,7.95]],[9,7,9,9.3],
        [8,4.5,8,6,[4.76,5.85]],[8,6,11.5,6],
        [8,1.25,11.5,1.25,[8.42,9.64]]
      ],
      windows:[
        ['left',0,1.05,2.75,'bedroom'],['left',0,5.12,6.92,'bedroom-second'],
        ['top',0,5.75,7.52,'bedroom-child'],['top',0,8.3,11.19,'balcony'],['top',1.25,8.42,9.64,'kitchen']
      ],
      entry:['bottom',8,9.12,10.4],
      fixtures:[
        ['kitchen',[11.04,3.68,.72,4.22]],
        ['shower',[8.3,8.16,.91,1.77]],['vanity',[7.2,8.91,.66,.43],'bottom'],
        ['toilet',[7.17,7.85,.61,.76],'left'],['vanity',[5.87,6.3,.58,.44],'right'],
        ['toilet',[5.91,7.35,.54,.67],'right']
      ]
    }
  ];

  function polygonArea(points){
    return Math.abs(points.reduce((sum,p,i)=>{
      const next=points[(i+1)%points.length];
      return sum+p[0]*next[1]-next[0]*p[1];
    },0))/2;
  }

  function build(source){
    const xs=source.outline.map(p=>p[0]),zs=source.outline.map(p=>p[1]);
    const center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...zs)+Math.max(...zs))/2];
    const scale=Math.sqrt(source.area/polygonArea(source.outline));
    const point=([x,z])=>[(x-center[0])*scale,(z-center[1])*scale];
    const rect=([x,z,w,d])=>[...point([x,z]),w*scale,d*scale];
    const walls=[],doors=[];
    function addWall(x1,z1,x2,z2,gap){
      const horizontal=z1===z2;
      const [start,end,at]=horizontal?[x1,x2,z1]:[z1,z2,x1];
      const segment=(a,b)=>rect(horizontal?[(a+b)/2,at,b-a,.16]:[at,(a+b)/2,.16,b-a]);
      if(gap){
        if(gap[0]>start)walls.push(segment(start,gap[0]));
        if(gap[1]<end)walls.push(segment(gap[1],end));
        doors.push({horizontal,at:(at-center[horizontal?1:0])*scale,from:(gap[0]-center[horizontal?0:1])*scale,to:(gap[1]-center[horizontal?0:1])*scale});
      }else walls.push(segment(start,end));
    }
    source.walls.forEach(args=>addWall(...args));
    const openings=[...source.windows,source.entry];
    const perimeter=[];
    for(let i=0;i<source.outline.length;i++){
      const [x1,z1]=source.outline[i], [x2,z2]=source.outline[(i+1)%source.outline.length];
      const horizontal=z1===z2,at=horizontal?z1:x1;
      const start=Math.min(horizontal?x1:z1,horizontal?x2:z2),end=Math.max(horizontal?x1:z1,horizontal?x2:z2);
      const cuts=openings.filter(([side,line,a,b])=>line===at&&a>=start&&b<=end&&horizontal===(side==='top'||side==='bottom'));
      let cursor=start;
      for(const opening of cuts.sort((a,b)=>a[2]-b[2])){
        if(opening[2]>cursor)perimeter.push(rect(horizontal?[(cursor+opening[2])/2,at,opening[2]-cursor,.2]:[at,(cursor+opening[2])/2,.2,opening[2]-cursor]));
        cursor=opening[3];
      }
      if(cursor<end)perimeter.push(rect(horizontal?[(cursor+end)/2,at,end-cursor,.2]:[at,(cursor+end)/2,.2,end-cursor]));
    }
    const aperture=([side,at,from,to,zone])=>{
      const horizontal=side==='top'||side==='bottom';
      return {side,horizontal,at:(at-center[horizontal?1:0])*scale,from:(from-center[horizontal?0:1])*scale,to:(to-center[horizontal?0:1])*scale,zone};
    };
    const windows=source.windows.map(aperture);
    const entry=aperture(source.entry);
    doors.push(entry);
    const zones=source.zones.map(([id,name,bounds])=>{
      const [x1,z1]=point(bounds.slice(0,2)),[x2,z2]=point(bounds.slice(2));
      return {id,name,bounds:[x1,z1,x2,z2],label:[(x1+x2)/2,(z1+z2)/2],area:(x2-x1)*(z2-z1)};
    });
    const fixtures=source.fixtures.map(([type,bounds,back])=>{
      const fixture={type,bounds:rect(bounds)};
      if(!back)return fixture;
      const original=point(bounds.slice(0,2)),zone=zones.find(z=>z.id.startsWith('bath')&&original[0]>=z.bounds[0]&&original[0]<=z.bounds[2]&&original[1]>=z.bounds[1]&&original[1]<=z.bounds[3]);
      const rotation={top:0,right:1,bottom:2,left:3}[back],horizontal=back==='top'||back==='bottom',axis=horizontal?1:0;
      const at=zone.bounds[{left:0,top:1,right:2,bottom:3}[back]],inward=back==='top'||back==='left'?1:-1;
      const modelSize=bounds.slice(2).map(v=>v*scale),p=[...original];
      const backing=[...walls,...perimeter].filter(([x,z,w,d])=>(w>d)===horizontal&&Math.abs((horizontal?z:x)-at)<1e-6&&Math.abs(original[horizontal?0:1]-(horizontal?x:z))<=((horizontal?w:d)+modelSize[0])/2);
      const thickness=backing.length?Math.max(...backing.map(r=>r[horizontal?3:2])):.2*scale;
      p[axis]=at+inward*(thickness/2+modelSize[1]/2+.012);
      fixture.bounds=[...p,...(rotation%2?[modelSize[1],modelSize[0]]:modelSize)];
      fixture.modelSize=modelSize;fixture.rotation=rotation;fixture.backWall={axis,at,thickness,inward};
      return fixture;
    });
    return {
      id:source.id,title:source.title,area:source.area,source:source.source,
      outline:source.outline.map(point),width:(Math.max(...xs)-Math.min(...xs))*scale,depth:(Math.max(...zs)-Math.min(...zs))*scale,
      walls,doors,entry,windows,perimeter,zones,
      fixtures
    };
  }

  const plans=definitions.map(build);
  function contains([x,z],outline){
    let inside=false;
    for(let i=0,j=outline.length-1;i<outline.length;j=i++){
      const [ax,az]=outline[i],[bx,bz]=outline[j];
      if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
    }
    return inside;
  }
  return {plans,contains};
})();
