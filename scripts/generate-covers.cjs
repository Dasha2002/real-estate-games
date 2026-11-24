'use strict';
// Native vector artwork. Run with node scripts/generate-covers.cjs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const art=vm.runInNewContext(fs.readFileSync(path.join(root,'assets/js/game-art.js'),'utf8')+';GameArt');
const ink='#775047',paper='#fff0ce';
const rect=(x,y,w,h,c,r=6,sw=3)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}" stroke="${ink}" stroke-width="${sw}"/>`;
const p=(d,c,sw=3,stroke=ink)=>`<path d="${d}" fill="${c}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
const ell=(x,y,rx,ry,c,sw=0)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" stroke="${ink}" stroke-width="${sw}"/>`;
const icon=(name,x,y,w,v=0)=>art.icon(name,v).replace('<svg ',`<svg x="${x}" y="${y}" width="${w}" height="${w*1.04}" `);
const g=(x,y,s,content)=>`<g transform="translate(${x} ${y}) scale(${s})">${content}</g>`;
const line=(d,c=ink,w=3)=>p(d,'none',w,c);
// World objects use a ground coordinate, not the outer SVG viewport. GameArt's
// cat paws finish at local y=97, while its viewport continues to y=104.
const contact=(x,y,w)=>ell(x,y+2,w,.14*w,'#77504718')+ell(x,y,w*.68,.055*w,'#7750472b');
function cat(cx,ground,width,variant=0){return contact(cx,ground,width*.33)+icon('cat',cx-width*.52,ground-width*.97,width,variant).replace(/<ellipse cx="52" cy="97"[^>]+\/>/,'');}
function planter(cx,ground,w,h,roses=false){const top=ground-h;return contact(cx,ground,w*.53)+p(`M${cx-w/2} ${top}L${cx-w*.39} ${ground-7}Q${cx} ${ground+5} ${cx+w*.39} ${ground-7}L${cx+w/2} ${top}Z`,'#c49275',4)+ell(cx,top,w*.5,w*.13,'#876e56',3)+(roses?shrub(cx,top-3,w/104,true).replace(/<ellipse[^>]+\/>/,''):'')+flower(cx-w*.25,top-1,w/73,0)+flower(cx+w*.24,top,w/87,1)+flower(cx,top-3,w/67,0)+p(`M${cx-w/2} ${top}Q${cx} ${top+w*.24} ${cx+w/2} ${top}`,'none',4,'#ab795e');}
function flower(x,y,s=1,v=0){return g(x,y,s,line('M0 0V-36','#879764',4)+p('M0-8Q-25-31-21-14Q-18-3 0-3M1-17Q22-39 25-23Q23-12 1-10','#9caf7f',2)+[0,1,2,3,4].map(i=>ell(Math.cos(i*1.256)*10,-43+Math.sin(i*1.256)*10,8,9,['#dba28e','#e8c47e','#e8dec0'][v%3],2)).join('')+ell(0,-43,6,6,'#e4b465',2));}
function shrub(x,y,s=1,pink=false){return g(x,y,s,ell(8,4,54,12,'#77504720')+p('M-52 0Q-65-25-37-31Q-40-60-13-52Q4-77 24-48Q56-55 55-28Q78-2 45 6L-40 7Z',pink?'#d5a59a':'#a5b98a',3)+line('M-38-16l10-5m18-17 10-4m25 20 10-5',pink?'#ebc1af':'#ccd6a4',4));}
function tree(x,y,s=1){return g(x,y,s,ell(10,7,61,16,'#77504720')+rect(-9,-71,18,78,'#bc946e',5)+line('M0-4V-71M0-43l-22-18',ink,3)+ell(-34,-91,35,41,'#9aad7d',3)+ell(30,-95,42,44,'#acbe8a',3)+ell(-3,-131,46,45,'#becb96',3)+line('M-25-143l16-6m22 26 13-5','#e0dfb1',5));}
function building(x,y,w,h,v=0){const c=[['#edc58c','#b99777','#dca178'],['#e1b29c','#b28776','#a6b8a0'],['#e5d2a8','#b5a081','#c0bd97']][v%3]; let a=p(`M0 ${h}H${w}l45-28 31 49-${w+22} 13Z`,'#77504713',0)+line(`M1 ${h+1}H${w}`,'#77504738',5)+rect(0,0,w,h,c[0],3)+p(`M${w} 0l45-28v${h}l-45 28Z`,c[1])+p(`M0 0l45-28h${w}l-45 28Z`,c[2])+line(`M6 6H${w-5}`,'#fff0cc',5);for(let yy=28;yy<h-65;yy+=63)for(let xx=22;xx<w-24;xx+=59){a+=rect(xx,yy,31,37,'#b6caca',3,2)+line(`M${xx+15} ${yy+2}v32M${xx+2} ${yy+18}h27`,'#f7e7bf',2)+line(`M${xx-3} ${yy+40}h37`,ink,3);if((xx+yy+v)%3===0)a+=rect(xx-3,yy+38,37,12,'#c69073',2,2)+ell(xx+7,yy+36,10,6,'#a3b784')+ell(xx+23,yy+36,9,6,'#b9c58d');}a+=rect(w/2-22,h-60,44,60,'#9f8068',3)+rect(w/2-14,h-52,28,31,'#b9ccc2',2,2)+ell(w/2+13,h-16,3,3,paper)+p(`M${w/2-39} ${h-60}l12-16h57l13 16Z`,c[2])+line(`M0 ${h-7}H${w}`,'#b18a69',5);return g(x,y,1,a);}
function bench(x,y,s=1){let a=contact(-51,40,15)+contact(51,40,15)+line('M-51 5v35M51 5v35',ink,6);for(let yy of [-34,-18,-2])a+=rect(-61,yy,122,11,'#d4af7c',3,3);a+=rect(-68,8,136,17,'#e4c18c',4);return g(x,y,s,a);}
function base(title,body){return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${title}"><title>${title}</title><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#d9e4d8"/><stop offset="1" stop-color="#f3e9c9"/></linearGradient><pattern id="paper" width="60" height="60" patternUnits="userSpaceOnUse"><circle cx="7" cy="17" r="1" fill="#91785a" opacity=".10"/><circle cx="39" cy="45" r=".8" fill="#91785a" opacity=".12"/></pattern><pattern id="pavers" width="74" height="42" patternUnits="userSpaceOnUse"><path d="M0 0H74V42H0ZM37 0V42" fill="none" stroke="#b69e7e" stroke-width="2" opacity=".36"/></pattern></defs><g stroke-linejoin="round" stroke-linecap="round">${body}</g><rect width="1280" height="720" fill="url(#paper)" pointer-events="none"/></svg>`;}

// The cards are printed on paper lying in the table's actual top plane. The
// projection also transforms their thickness, icons and small contact shadows.
function taskCard(x,y,type,variant=0){return g(x,y,1,
  rect(3,5,97,132,'#77504726',9,0)+rect(0,2,97,130,'#c8ac85',9,2)+
  rect(0,0,97,128,type?'#fff0ce':'#b2bd97',9,2)+
  (type?icon(type,10,11,77,variant):line('M15 19l67 85M15 104l67-85','#dbe0b9',3)+ell(48,62,17,17,'#e8c887',2)));
}

const living=base('Уютная жизнь дома: котик на табурете и задания на столе',`
  <rect width="1280" height="720" fill="#f2dfb9"/>
  ${line('M0 108H1280M0 526H1280','#d8bd95',3)}
  ${p('M0 533H1280V720H0Z','#d6b58a',0)}
  ${line('M0 597H1280M0 681H1280M150 720 397 533M700 720 667 533M1210 720 939 533','#bd9974',3)}
  ${line('M0 535H1280','#a58668',5)}
  ${rect(81,54,687,452,'#b18c67',20,5)}
  ${rect(99,72,651,413,'url(#sky)',10,4)}
  <svg x="112" y="86" width="625" height="389" viewBox="0 0 625 389">
    <circle cx="505" cy="67" r="46" fill="#f6df9a"/>
    <path d="M0 242Q205 207 625 227V389H0Z" fill="#bbc99d"/>
    ${g(12,83,.74,building(0,0,219,260,0))}
    ${g(210,121,.65,building(0,0,208,250,1))}
    ${g(418,59,.72,building(0,0,220,290,2))}
    ${p('M122 389Q300 283 451 389','#e6d8b0',0)}
    ${tree(75,378,.70)}${tree(558,375,.7)}
  </svg>
  ${line('M422 79V484M105 296H744','#a58262',13)}
  ${line('M429 83V480M111 288H739','#f4e5c2',5)}
  ${rect(62,480,728,29,'#dab181',6,4)}
  ${line('M73 510H780','#b18c6c',4)}
  ${p('M43 32H172Q158 194 139 333L96 361H44Z','#b5bc99',4)}
  ${line('M73 51Q94 183 67 317M116 47Q129 186 108 311','#98a47e',4)}
  ${p('M705 31H803V359L748 335Q715 161 705 31Z','#b5bc99',4)}
  ${line('M741 47Q739 173 776 317','#98a47e',4)}
  ${line('M43 33H802',ink,7)}
  ${line('M838 104 964 72l126 32',ink,3)}
  ${rect(811,104,307,176,'#c6a17b',12,4)}
  ${rect(823,116,283,152,'#fcf0d2',6,2)}
  ${p('M845 241l70-62 42 35 57-66 69 93Z','#b5c39a',2)}
  ${ell(1037,147,18,18,'#e8bc75',2)}
  ${contact(930,642,28)}${contact(1092,642,28)}
  ${line('M933 544l-3 98M1088 544l4 98',ink,13)}
  ${line('M934 544l-3 94M1088 544l4 94','#bc9269',7)}
  ${p('M886 526h211l30 17H916Z','#e8c28c',4)}
  ${p('M886 526v18l30 17h211v-18H916Z','#bd916b',4)}
  ${cat(1006,536,228,2)}
  ${p('M80 558 558 526 800 651 322 684Z','#77504720',0)}
  ${contact(123,714,30)}${contact(747,713,29)}
  ${line('M122 570v144M748 646v67',ink,16)}
  ${line('M122 570v140M748 646v63','#b98e67',9)}
  ${p('M80 540 558 508 800 632 322 664Z','#edc891',4)}
  ${p('M80 540v20l242 124 478-32v-20L322 664Z','#bd946d',4)}
  ${line('M102 546 326 660 778 630','#f9e2b0',3)}
  <g transform="matrix(1 -.066946 1.1 .563636 80 540)">
    ${taskCard(42,24,'flower',1)}${taskCard(194,31,null)}${taskCard(342,23,'house',3)}
  </g>
  ${planter(1180,658,112,103)}
`);

const courtyard=base('Жилой квартал: дома, котики-соседи и занятия во дворе',`
  <rect width="1280" height="720" fill="url(#sky)"/>
  ${ell(1103,86,59,59,'#f4dfa3')}
  ${p('M0 347Q305 298 644 314T1280 311V720H0Z','#bdc99b',0)}
  ${p('M64 373 690 254l533 190-577 276H0V496Z','#e1cfaa',3)}
  <defs><clipPath id="court-ground"><path d="M64 373 690 254l533 190-577 276H0V496Z"/></clipPath></defs>
  <g clip-path="url(#court-ground)">
    ${[350,391,445,514,600,702].map(y=>line(`M0 ${y}H1280`,'#bba58188',2)).join('')}
    ${[-700,-300,80,420,760,1100,1500,1900].map(x=>line(`M640 180 ${x} 720`,'#bba58177',2)).join('')}
  </g>
  ${building(73,105,252,271,0)}${building(489,56,235,249,2)}
  <g transform="translate(2094 0) scale(-1 1)">${building(912,109,248,274,1)}</g>
  ${shrub(350,356,1)}${shrub(801,333,.9)}
  ${tree(35,425,.9)}${tree(1209,414,.91)}
  ${p('M400 412Q571 347 795 403L862 504Q649 570 439 517Z','#8f9f75',4)}
  ${p('M400 405Q571 340 795 396L862 497Q649 563 439 510Z','#acbc8b',3)}
  ${p('M431 420Q590 370 767 416L807 485Q625 528 472 490Z','#e4ce9b',3)}
  ${contact(689,465,23)}${contact(792,465,22)}${contact(886,480,27)}
  ${g(742,421,1.05,
    line('M-50 42l14-118M47 42 34-76',ink,7)+
    rect(-43,-84,88,16,'#d4a46f',5)+p('M-57-85-1-122 57-85Z','#ca9377',4)+
    line('M-28-61v98m0-69h30m-30 27h30m-30 26h30',ink,4)+
    p('M32-59Q100-44 62 6T135 56','none',20,'#dba762')+
    line('M34-66Q111-45 73 9T139 61','#f2cf89',6))}
  <g transform="matrix(1 .08 -.35 .7 174 495)">
    ${rect(0,0,206,136,'#a8aaa0',10,3)}
    ${[0,1,2].map(i=>line(`M${14+i*65} 12v108h54`,'#f4e4bb',3)).join('')}
    ${icon('car',24,14,49,0)}${icon('car',153,14,49,1)}
  </g>
  ${p('M900 470h163l37 17-163 11Z','#77504720',0)}
  ${g(984,452,1,
    rect(-77,-83,158,105,'#e6bf91',5)+
    p('M-88-84-65-112H65L91-84Z','#adb99b',3)+
    rect(-59,-57,70,61,'#b5c9bd',3)+rect(26,-57,37,79,'#94b0a3',3)+
    Array.from({length:10},(_,i)=>rect(-86+i*17,-83,17,27,i%2?'#f8e6bb':'#c48b72',3,2)).join('')+
    icon('apple',-43,-51.2,40,0)+line('M-59-14h70',ink,4)+line('M-77 22H81','#a77f62',4))}
  ${bench(552,558,1.04)}${shrub(421,544,.8)}${shrub(1096,539,.85,true)}
  ${cat(665,552,96,4)}${cat(451,604,115,0)}
  ${cat(948,615,110,1)}${cat(767,690,126,2)}${cat(1087,686,92,5)}
  ${contact(841,659,23)}${ell(841,639,23,20,'#eee2bb',3)}
  ${p('M833 626l15 2 5 13-14 8-11-11Z','#a3b28a',2)}
  ${planter(102,679,122,57)}${shrub(1193,689,1.4)}
  ${line('M0 689l145-37M19 720l154-39',ink,6)}
  ${line('M11 719v-45m52 32v-45m52 33v-45',ink,5)}${tree(19,715,1.1)}
`);

// Every corridor line converges to (640,270). Rear plane x=470..810 has
// ceiling y=198.28125 and floor y=389.53125, as projected from the near plane.
const vanish={x:640,y:270};
const floorBoundary='M0 720 470 389.53125H810L1280 720Z';
const wallY=(x,y)=>270+(y-270)*(640-x)/300;
function wallPanel(x1,x2,y1,y2,color,width=3){return p(`M${x1} ${wallY(x1,y1)}L${x2} ${wallY(x2,y1)}V${wallY(x2,y2)}L${x1} ${wallY(x1,y2)}Z`,color,width);}
const maze=base('Лабиринт розового сада: дверь дома и настенная головоломка',`
  <rect width="1280" height="720" fill="#f1deba"/>
  ${p(floorBoundary,'#e8d1aa',0)}
  ${p('M0 0 470 198.28125V389.53125L0 720Z','#cfad98',4)}
  ${p('M1280 0 810 198.28125V389.53125L1280 720Z','#dfbda3',4)}
  ${p('M470 198.28125H810V389.53125H470Z','#efd2a2',4)}
  ${[120,290,480,600].map(y=>line(`M0 ${y}L470 ${270+(y-270)*170/640}M1280 ${y}L810 ${270+(y-270)*170/640}`,'#b38e79',3)).join('')}
  ${[126,304].map(x=>line(`M${x} ${270*x/640}V${720-450*x/640}M${1280-x} ${270*x/640}V${720-450*x/640}`,'#b38e79',3)).join('')}
  ${line('M0 713 470 387M1280 713 810 387','#a8886e',7)}
  <defs><clipPath id="maze-floor"><path d="${floorBoundary}"/></clipPath></defs>
  <g clip-path="url(#maze-floor)">
    ${[-300,-30,240,510,780,1050,1320,1590].map(x=>line(`M${vanish.x} ${vanish.y}L${x} 720`,'#bda17f',3)).join('')}
    ${[418,460,519,602,712].map(y=>line(`M0 ${y}H1280`,'#bda17f',3)).join('')}
  </g>
  ${wallPanel(36,235,194,480,'#b08d7f',4)}
  ${wallPanel(53,223,210,473,'#a5aa95',4)}
  ${wallPanel(56,218,218,465,'#b9bf9e',2)}
  ${wallPanel(69,206,240,440,'#a3b197',2)}
  ${p('M565 390V259Q565 210 614 210H666Q715 210 715 259V390Z','#ba8d69',5)}
  ${p('M582 390V259Q582 227 614 227H666Q698 227 698 259V390Z','#9baf9b',4)}
  ${rect(603,248,74,68,'#c4d4b7',13,3)}
  ${line('M640 251v61M607 282h66','#efe4bc',4)}
  ${rect(596,336,87,45,'#8fa58d',5,3)}${ell(684,327,6,6,'#e4bf78',3)}
  ${p('M549 390h182l25 15H524Z','#d3ad7f',3)}
  ${p('M524 405h232v7H524Z','#b7926b',2)}
  ${p('M590 430h100l32 28H558Z','#77504720',0)}
  ${p('M590 426h100l32 25H558Z','#bdc698',3)}
  ${line('M585 443h112','#dce1b4',3)}
  ${wallPanel(331,445,212,369,'#a57b63',4)}
  ${wallPanel(338,438,220,360,'#ecdbb3',2)}
  ${wallPanel(347,383,232,281,'#d2a18a',2)}
  ${wallPanel(395,430,232,281,'#a9b999',2)}
  ${wallPanel(347,383,296,346,'#e0bf7a',2)}
  ${wallPanel(395,430,296,346,'#b3c6bb',2)}
  ${line(`M354 ${wallY(354,255)}L377 ${wallY(377,255)}M365 ${wallY(365,243)}V${wallY(365,268)}`,ink,3)}
  ${ell(412,wallY(412,256),7,9,'#f6e7c1',2)}
  ${line(`M355 ${wallY(355,309)}L376 ${wallY(376,334)}M355 ${wallY(355,334)}L376 ${wallY(376,309)}`,ink,3)}
  ${wallPanel(401,424,308,334,'#f4e3b4',2)}
  ${line('M926 261h20v12',ink,4)}
  ${g(946,300,.65,
    rect(-23,-12,50,14,'#ab8469',3,3)+rect(-18,0,40,40,'#e9c67e',8,3)+
    line('M-24-12l25-29 25 29',ink,4)+line('M-7 8v21M12 8v21','#f9eac0',5))}
  ${planter(211,656,156,96,true)}${planter(1121,682,150,92,true)}
  ${cat(916,604,143,5)}
`);

for(const [name,svg] of [['living',living],['courtyard',courtyard],['maze',maze]]){
  const file=path.join(root,'assets/images',`cover-${name}.svg`);
  fs.writeFileSync(file,svg);console.log(path.relative(root,file));
}
