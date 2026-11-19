'use strict';

// Orthographic renderer. Buildings and props share world coordinates with the HTML markers.
const HorizonScene = (() => {
  const tiles = [];
  const objects = [];
  const clamp = (number, low, high) => Math.min(high, Math.max(low, number));

  function box(x, z, width, length, height, colors, y = 0, type = '') {
    objects.push({x,z,width,length,height,colors,y,type});
  }

  function tile(x, z, width, length, color) {
    tiles.push({x,z,width,length,color});
  }

  function tree(x,z,y = 0, variant = 0) {
    box(x,z,.16,.16,1.15,['#886756','#674a43','#8e745a'],y);
    const greens = [['#91bd71','#467851','#b9d487'],['#6fa580','#37684d','#a2c080'],['#db9c98','#aa6873','#f3babc']][variant % 3];
    objects.push({x,z,y:y+1.43,width:.83,length:.83,height:1.12,colors:greens,type:'tree'});
  }

  const plaster = ['#e9cfb4','#b99178','#f6e5cf'];
  const limestone = ['#d0d7cc','#8aab9d','#eff1dd'];
  const wood = ['#b88057','#7c5138','#e9ae70'];
  const glass = ['#79978f','#536e70','#b1c7b2'];

  box(-5.2,-6.4,4.7,3.65,5.4,plaster,0,'building');
  box(.1,-7.15,5.6,3,7,limestone,0,'building');
  box(6.4,-4.8,3.35,5,5.9,plaster,0,'building');
  box(-5.2,-6.4,2,1.25,.32,wood,5.4);
  box(.1,-7.15,2.5,1.3,.36,wood,7);
  box(6.35,-5.2,1.75,1.25,.34,wood,5.9);
  box(-5.1,-3.9,2.9,1.1,.95,glass);
  box(.1,-5.4,2.7,.95,.87,glass);
  box(5.4,-2.1,3.7,.8,1.06,glass);
  box(6.4,5.3,2.8,1.5,.58,['#6c7d77','#354744','#9caf9c']);
  box(6.4,6.1,1.8,.75,.11,['#959186','#656764','#a8aaa0']);
  box(-5.15,6,2.8,.24,.12,wood,.38);
  box(-5.15,6.28,2.8,.14,.45,wood,.3);
  for(const x of [-4.3,-2.35]){
    for(const z of [1.9,3.2]) box(x,z,.16,.16,1.57,wood);
  }
  box(-3.3,2.55,2.3,1.65,.28,['#d48a59','#a15539','#f4b28a'],1.35);
  box(-2.27,3.3,.52,1.3,.22,wood,.64);
  for(const x of [-1.45,1.45]){
    for(const z of [-2.55,-1.35]) box(x,z,.14,.14,1.7,wood);
  }
  for(let i=0;i<5;i++) box(-1.5+i*.75,-1.95,.13,1.55,.11,wood,1.7);
  box(0,-1.9,2.45,.42,.22,wood,.37);
  box(3.1,2.1,.11,.11,1.48,glass);
  box(5.52,2.1,.11,.11,1.48,glass);
  box(3.1,2.1,.14,.51,.29,plaster,1.39);
  box(5.52,2.1,.14,.51,.29,plaster,1.39);

  tile(0,4.95,16,1.25,'#dfd5ad');
  tile(0,-.1,1.55,12.5,'#f4e3c8');
  tile(0,-2.7,13.5,1.2,'#e9d5b6');
  tile(-3.3,2.55,4.65,3.25,'#d99b72');
  tile(4.32,2.1,3.55,3.08,'#426b73');
  tile(-5.4,6.3,4.5,1.8,'#a6b884');
  tile(0,-1.9,5.4,1.2,'#d4bb88');
  tile(0,7.47,15.9,.22,'#b3c18c');
  tile(0,6.46,1.75,3.1,'#ede0bf');

  const trees = [[-7.35,-2.4],[-7.1,1],[-7,3.8],[-7.3,6.45],[-4.4,6.7],[-2.8,6.6],[2.55,6.4],[3.8,6.9],[7.45,3.8],[7.5,.55],[-2.4,-1.6],[2.45,-1.55],[-5.5,-1.5],[-5.85,3.45],[2.5,-3.65],[-7.4,-7.85],[7.7,-7.8],[7.65,7.4],[-1,7.6],[4.35,-6.95]];
  trees.forEach(([x,z],i) => tree(x,z,0,i % 5 === 0 ? 2 : i % 2));
  tree(-5.8,-6.5,5.4,1);
  tree(.9,-7.4,7,0);
  tree(6.7,-3.7,5.9,0);

  const locations = {
    yard:[0,4.1,.9], play:[-3.35,2.65,1.7], sport:[4.35,2.1,.35], parking:[6.45,5.75,.78],
    garden:[-5.4,6.75,.72], lobby:[-5.14,-3.15,1.1], shops:[5.7,-1.32,.94], home:[.25,-7.25,7.8], rest:[0,-1.82,1.96]
  };

  function mount(frame, {view = 'map', markers = [], onGround} = {}) {
    const canvas = frame.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const world = view === 'world';
    const initial = {angle:world ? .56 : .14, tilt:world ? .59 : 1.32, zoom:1};
    let {angle, tilt, zoom} = initial;
    let drawPending = false;
    let pointer = null;
    let walker = null;
    let animation = {};
    let unproject;
    let alive = true;

    function draw() {
      drawPending = false;
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      if (!alive || !width || !height) return;
      const dpi = Math.min(devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width*dpi) || canvas.height !== Math.round(height*dpi)) {
        canvas.width = Math.round(width*dpi);
        canvas.height = Math.round(height*dpi);
      }
      ctx.setTransform(dpi,0,0,dpi,0,0);
      const scale = Math.min(width / (world ? 24 : 21.2), height / (world ? 19.6 : 20.5)) * zoom;
      const c = Math.cos(angle), s = Math.sin(angle);
      const sy = Math.sin(tilt), cy = Math.cos(tilt);
      const rotate = (x,z) => [x*c - z*s, x*s + z*c];
      const project = (x,z,y = 0) => {
        const [rx,rz] = rotate(x,z);
        return [width*.5 + rx*scale, height*(world ? .58 : .53) + (rz*sy-y*cy)*scale];
      };
      unproject = (x,y) => {
        const rx = (x-width*.5)/scale;
        const rz = (y-height*(world ? .58 : .53))/(scale*sy);
        return [rx*c+rz*s,-rx*s+rz*c];
      };
      function path(points,fill,stroke,size = 1) {
        ctx.beginPath();
        points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = size; ctx.stroke(); }
      }
      function plane(x,z,w,d,y,color,stroke) {
        path([project(x-w/2,z-d/2,y),project(x+w/2,z-d/2,y),project(x+w/2,z+d/2,y),project(x-w/2,z+d/2,y)],color,stroke);
      }
      function paint({x,z,width:w,length:d,height:h,colors,y,type}) {
        if (type === 'tree') {
          const top = project(x,z,y+h);
          const base = project(x,z,y-h*.55);
          const peak = Array.from({length:6},(_,i) => project(x+Math.cos(i*Math.PI/3)*w,z+Math.sin(i*Math.PI/3)*d,y));
          peak.forEach((point,i) => path([top,point,peak[(i+1)%6]],colors[(i+2)%3]));
          peak.forEach((point,i) => path([base,peak[(i+1)%6],point],colors[i%2 ? 1 : 0]));
          return;
        }
        const corners = [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
        corners.forEach(([ax,az],i) => {
          const [bx,bz] = corners[(i+1)%4];
          const [px] = rotate(bx-ax,bz-az);
          if (px >= 0) return;
          const face = (u,v) => project(ax+(bx-ax)*u,az+(bz-az)*u,y+h*v);
          path([face(0,0),face(1,0),face(1,1),face(0,1)],colors[i%2]);
          if (type !== 'building') return;
          const columns = Math.max(3,Math.round(Math.hypot(bx-ax,bz-az)*1.4));
          const floors = Math.round(h/.85);
          for(let row=0;row<floors;row++) {
            for(let col=0;col<columns;col++) {
              const l=(col+.23)/columns, r=(col+.78)/columns, b=(row+.28)/floors, t=(row+.87)/floors;
              path([face(l,b),face(r,b),face(r,t),face(l,t)],(row+col+i)%4 < 2 ? '#415b5a' : '#d8a56e');
              path([face(l-.06,b-.045),face(r+.06,b-.045),face(r+.06,b+.02),face(l-.06,b+.02)],'#735c53');
            }
          }
        });
        plane(x,z,w,d,y+h,colors[2]);
        if (type === 'building') plane(x,z,w-.31,d-.32,y+h+.013,'#9eaa71');
      }
      const backdrop = ctx.createLinearGradient(0,0,width,height);
      backdrop.addColorStop(0, world ? '#193d38' : '#deebd0');
      backdrop.addColorStop(1, world ? '#081f22' : '#a9b99a');
      ctx.fillStyle = backdrop;
      ctx.fillRect(0,0,width,height);
      for(let x=14;x<width;x+=21) for(let y=14;y<height;y+=21){
        ctx.fillStyle = world ? '#c0e5c321' : '#38553b22';
        ctx.fillRect(x,y,1,1);
      }
      plane(.45,.8,17.3,17.3,-.6,world ? '#051515' : '#758b71');
      paint({x:0,z:0,width:17,length:17,height:.65,colors:['#5e805f','#355945','#89aa72'],y:-.65});
      tiles.forEach(({x,z,width:w,length:d,color}) => plane(x,z,w,d,.02,color));
      plane(4.32,2.1,3.16,2.7,.04,null,'#d9e5df');
      plane(4.32,2.1,.04,2.72,.045,'#d9e5df');
      for(let i=0;i<9;i++){
        const x = -6.5 + i * 1.5;
        plane(x,7.87,.7,.18,.045,'#718956');
      }
      for(const [x,z] of trees) plane(x+.22,z+.18,1.32,1.04,.046,'#56764d55');
      const models = objects.slice();
      if (walker) {
        const [x,z] = walker;
        const jump = animation.walking ? .045*Math.sin(performance.now()/45) : 0;
        const [sx,screenY] = project(x,z,.05);
        ctx.beginPath();
        ctx.ellipse(sx,screenY,scale*.49,scale*.25,0,0,Math.PI*2);
        ctx.fillStyle = '#fff1a5';
        ctx.fill();
        models.push(
          {x,z,width:.37,length:.29,height:.57,y:.03+jump,colors:['#7c481f','#9c5522','#ffbd66']},
          {x,z,width:.29,length:.26,height:.3,y:.6+jump,colors:['#ffd69e','#c58556','#ffe7b7']}
        );
        if(animation.cargo) {
          const hue=animation.cargo==='ball'?['#f8a441','#a3572e','#ffd46f']:['#90d4d4','#46878a','#c3eee8'];
          models.push({x:x+.27,z,width:.24,length:.24,height:.25,y:.3+jump,colors:hue});
        }
        if(animation.effect) {
          const {kind,pct} = animation.effect;
          if(kind==='throw') models.push({x:x+pct*1.8,z:z-pct*.85,width:.28,length:.28,height:.28,y:.35+1.6*Math.sin(Math.PI*pct),colors:['#f6a54d','#b55a2d','#ffd070']});
          if(kind==='water') {
            for(let i=0;i<4;i++){
              const f=(pct+i*.16)%1;
              models.push({x:x+.4+f*.6,z:z+i*.11,width:.08,length:.08,height:.14,y:.55*(1-f),colors:['#9ae6eb','#438f99','#d6ffff']});
            }
          }
        }
      }
      models.sort((a,b)=>rotate(a.x,a.z)[1]-rotate(b.x,b.z)[1] || a.y-b.y).forEach(paint);
      for(const marker of markers) {
        const pin = frame.querySelector('[data-pin="'+(typeof marker === 'object' ? marker.key : marker)+'"]');
        const [x,y] = project(...(typeof marker === 'object' ? marker.position : locations[marker]));
        pin.style.left = clamp(x,22,width-22)+'px';
        pin.style.top = clamp(y,22,height-22)+'px';
      }
    }

    function schedule() {
      if (!drawPending) {
        drawPending = true;
        requestAnimationFrame(draw);
      }
    }

    function control(name) {
      if (name === 'left') angle -= .28;
      if (name === 'right') angle += .28;
      if (name === 'in') zoom = clamp(zoom+.13,.76,1.45);
      if (name === 'out') zoom = clamp(zoom-.13,.76,1.45);
      if (name === 'reset') ({angle,tilt,zoom} = initial);
      schedule();
    }

    if (world) {
      canvas.addEventListener('pointerdown',event => {
        if (pointer || event.button !== 0) return;
        pointer = {x:event.clientX,y:event.clientY,id:event.pointerId,distance:0};
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener('pointermove',event => {
        if (pointer?.id !== event.pointerId) return;
        const dx = event.clientX-pointer.x;
        const dy = event.clientY-pointer.y;
        pointer.distance += Math.hypot(dx,dy);
        if (pointer.distance > 5) {
          angle += dx*.01;
          tilt = clamp(tilt+dy*.008,.32,1.14);
        }
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        schedule();
      });
      canvas.addEventListener('pointerup', event => {
        if (pointer?.id !== event.pointerId || pointer.distance > 5 || !unproject || !onGround) return;
        const rect = canvas.getBoundingClientRect();
        onGround(...unproject(event.clientX-rect.left,event.clientY-rect.top));
      });
      canvas.addEventListener('lostpointercapture', () => {pointer = null;});
      canvas.addEventListener('keydown',event => {
        const command = {'[':'left',']':'right','+':'in','-':'out',Home:'reset'}[event.key];
        if (command) {
          event.preventDefault();
          control(command);
        }
      });
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(frame);
    draw();
    return {
      control, walk(position,state={}) {walker=position;animation=state;schedule();},
      direction(x,z){return [Math.cos(angle)*x+Math.sin(angle)*z,-Math.sin(angle)*x+Math.cos(angle)*z];},
      destroy() {alive = false; observer.disconnect();}
    };
  }

  return {mount};
})();
