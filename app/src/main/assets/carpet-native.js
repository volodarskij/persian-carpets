/* Native and browser use the same vector poses; no screenshots or image fades. */
(function(global){
  'use strict';
  var keys=['body','trim','wave','junction','frameBody','cornerTrim','frameTrim','simpleBody','fineBody'];
  function mesh(scene,start,end){return CarpetMesh.pack(CarpetMesh.compile({shape:scene.shape,commands:scene.commands.slice(start||0,end)}));}
  function prepare(seed,second,zoom){
    var duration=zoom?18:38,t=second/duration,i=Math.floor(t),phase=t-i;
    var scene=CarpetEngine.frame(seed,i,phase,zoom?{unfold:true,fusion:true}:false),parts;
    if(zoom){
      var frame=CarpetEngine.frame(seed,i,phase,{unfoldFrame:true,fusion:true}),wave=CarpetEngine.frame(seed,i,phase,{unfoldWave:true}),detail=CarpetEngine.frame(seed,i,phase,{unfoldJunction:true});
      var simple=CarpetEngine.frame(seed,i,phase,{unfold:true,fusion:true,detailLevel:2});
      var fine=CarpetEngine.frame(seed,i,phase,{unfold:true,fusion:true,detailLevel:3});
      parts=[mesh(scene,0,scene.bodyEnd),mesh(scene,scene.bodyEnd),mesh(wave),mesh(detail),mesh(frame,0,frame.bodyEnd),mesh(frame,frame.bodyEnd,frame.cornerEnd),mesh(frame,frame.cornerEnd),mesh(simple,0,simple.bodyEnd),mesh(fine,0,fine.bodyEnd)];
    }else parts=[mesh(scene)];
    return {second:second,p:scene.p,contour:scene.contour,bounds:zoom?frame.bounds:[0,0,0,0],waveCenter:zoom?scene.waveCenter:[0,0],counts:parts.map(function(p){return p.length/6;}),parts:parts};
  }
  function send(seed,second,zoom){
    try{
      var pose=prepare(seed,second,zoom),parts=pose.parts;delete pose.parts;
      NativeScene.begin(JSON.stringify(pose));
      for(var j=0;j<parts.length;j++)NativeScene.part(second,j,CarpetMesh.encode(parts[j]));
      NativeScene.end(second);
    }catch(error){NativeScene.failed(String(error&&error.stack||error));}
  }
  global.CarpetNative={prepare:prepare,send:send,keys:keys};
})(typeof window!=='undefined'?window:globalThis);
