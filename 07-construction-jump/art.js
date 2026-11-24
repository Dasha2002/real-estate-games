'use strict';

// Generated images retain their original alpha. Source rectangles only omit
// transparent padding; they never change the collision geometry.
const JumpArt=(()=>{
  const definitions={"background": {"width": 1024, "height": 1536, "frames": [[0, 0, 1024, 1536]]}, "brick": {"width": 1774, "height": 887, "frames": [[265, 159, 1244, 568]]}, "cargo": {"width": 1484, "height": 1060, "frames": [[110, 117, 1263, 851]]}, "crane": {"width": 1199, "height": 1312, "frames": [[363, 31, 439, 1242]]}, "fragile": {"width": 2172, "height": 724, "frames": [[43, 173, 2082, 456]]}, "jetpack": {"width": 1312, "height": 1199, "frames": [[238, 144, 836, 932]]}, "metal": {"width": 2172, "height": 724, "frames": [[62, 196, 2049, 414]]}, "propeller": {"width": 1312, "height": 1199, "frames": [[191, 74, 917, 1074]]}, "spring": {"width": 1484, "height": 1060, "frames": [[182, 101, 1119, 929]]}, "wood": {"width": 2172, "height": 724, "frames": [[52, 173, 2067, 435]]}, "worker": {"width": 1254, "height": 1254, "frames": [[179, 77, 272, 509], [769, 49, 322, 470], [134, 669, 360, 520], [726, 682, 437, 527]], "file": "worker-simple.png"}};
  const images={};let ready=false,request;
  function preload(){
    if(request)return request;
    request=Promise.all(Object.keys(definitions).map(key=>new Promise(resolve=>{
      const image=new Image();images[key]=image;
      image.onload=()=>resolve(true);image.onerror=()=>resolve(false);
      image.src=new URL('assets/'+(definitions[key].file || key+'.png'),document.baseURI).href;
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
