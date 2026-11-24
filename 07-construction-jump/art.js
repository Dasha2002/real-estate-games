'use strict';

// Generated images retain their original alpha. Source rectangles only omit
// transparent padding; they never change the collision geometry.
const JumpArt=(()=>{
  const definitions={"worker":{"width":1263,"height":1246,"frames":[[198,61,294,472],[750,61,318,439],[151,707,383,439],[774,625,295,544]]}};
  const images={};let ready=false,request;
  function preload(){
    if(request)return request;
    request=Promise.all(Object.keys(definitions).map(key=>new Promise(resolve=>{
      const image=new Image();images[key]=image;
      image.onload=()=>resolve(true);image.onerror=()=>resolve(false);
      image.src=new URL('assets/inni/mascot.png',document.baseURI).href;
    }))).then(results=>{ready=true;return results.every(Boolean)});
    return request;
  }
  function draw(ctx,key,x,y,w,h,frame=0){
    const image=images[key];if(!image?.complete || !image.naturalWidth)return false;
    const [sx,sy,sw,sh]=definitions[key].frames[frame];
    ctx.drawImage(image,sx,sy,sw,sh,x,y,w,h);return true;
  }
  const has=key=>Boolean(images[key]?.complete && images[key].naturalWidth);
  return {preload,draw,has,definitions,get ready(){return ready}};
})();
