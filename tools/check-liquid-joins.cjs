const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const assets=path.join(__dirname,'../app/src/main/assets');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CARPET_BROWSER,headless:true});
 try{
  const page=await browser.newPage();await page.setContent('<canvas width="1600" height="900"></canvas>');
  await page.addScriptTag({content:fs.readFileSync(path.join(assets,'carpet-zoom.js'),'utf8')});
  const result=await page.evaluate(forceFallback=>{
   const canvas=document.querySelector('canvas'),g=canvas.getContext('webgl',{preserveDrawingBuffer:true,alpha:true,antialias:false}),p=g.createProgram();
   const derivatives=!forceFallback&&!!g.getExtension('OES_standard_derivatives');
   for(const [kind,source] of [[g.VERTEX_SHADER,CarpetZoom.shaders.surfaceVertex],[g.FRAGMENT_SHADER,derivatives?CarpetZoom.shaders.surfaceDerivativeFragment:CarpetZoom.shaders.surfaceFragment]]){
    const s=g.createShader(kind);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));g.attachShader(p,s);
   }
   g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(p));g.useProgram(p);
   const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);
   const a=g.getAttribLocation(p,'a');g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);
   const u={};for(const n of ['contour','bounds','waveCenter','zoom','cornerStretch','junctionMask','aa','blue','gold','accent','warm'])u[n]=g.getUniformLocation(p,n);
   g.uniform3f(u.contour,0,0,0);g.uniform4f(u.bounds,740,390,150,120);g.uniform1f(u.aa,.35);g.uniform3f(u.blue,0,0,1);g.uniform3f(u.gold,1,1,0);
   g.uniform3f(u.accent,0,0,1);g.uniform3f(u.warm,0,0,1);
   function render(zoom){g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.uniform1f(u.zoom,zoom);g.drawArrays(g.TRIANGLE_STRIP,0,4);}
   function pixel(x,y){const p=new Uint8Array(4);g.readPixels(Math.floor(x*2),899-Math.floor(y*2),1,1,g.RGBA,g.UNSIGNED_BYTE,p);return Array.from(p);}
   const collar=450*.22/.79;
   // A twenty-unit air gap between a ring and the top hem becomes a solid neck.
   render(370/collar);const hem=[];for(let y=370;y<=390;y+=2)hem.push(pixel(.25,y));const empty=pixel(120,250);
   // A separate close approach to the front of the corner quarter, away from the hem.
   const distance=Math.hypot(740,390),nx=740/distance,ny=390/distance;
   const cornerRadius=1/Math.hypot(nx/150,ny/120),cornerFront=distance-cornerRadius;
   render((cornerFront-20)/(collar/.22));const corner=[];
   for(let r=cornerFront-20;r<=cornerFront;r+=2)corner.push(pixel(nx*r,ny*r));
   // Before the encounter the gap remains open; the whole field does not flood.
   render(330/collar);const separated=pixel(.25,365);
   // Integrate actual gold pixels along the normal, at different feature sizes.
   function stroke(cx,cy,nx,ny){let width=0;for(let t=-9.75;t<10;t+=.5){const p=pixel(cx+nx*t,cy+ny*t);width+=p[0]*p[3]/(255*255)*.5;}return width;}
   const widths=[];for(const zoom of [1,3]){render(zoom);widths.push(stroke(collar*zoom,.25,1,0));}
   render(1);widths.push(stroke(.25,390,0,1));
   g.uniform1f(u.cornerStretch,.18);render(3);
   const stretchedFront=distance-cornerRadius*1.18;widths.push(stroke(nx*stretchedFront,ny*stretchedFront,nx,ny));
   const pulled=pixel(nx*(cornerFront-15),ny*(cornerFront-15));
   g.uniform1f(u.cornerStretch,0);render(3);const unpulled=pixel(nx*(cornerFront-15),ny*(cornerFront-15));
   const nearReach=CarpetZoom.cornerReach([740,390,150,120],[0,0,0],(cornerFront-20)/(collar/.22)),farReach=CarpetZoom.cornerReach([740,390,150,120],[0,0,0],3);
   g.uniform3f(u.blue,.1,.2,.4);g.uniform3f(u.accent,.1,.7,.5);g.uniform3f(u.warm,.8,.12,.25);render(2);
   const flatRing=[.12,.39,.7,1.2].map(th=>pixel(Math.cos(th)*collar*2*.895,Math.sin(th)*collar*2*.895));
   const flatFrame=[[50,420],[200,420],[500,420],[770,80],[770,200]].map(p=>pixel(p[0],p[1]));
   g.uniform3f(u.blue,0,0,1);g.uniform3f(u.accent,0,0,1);g.uniform3f(u.warm,0,0,1);
   render(1);const waveRadius=CarpetZoom.secondaryRadius(1),beforeWave=pixel(190+waveRadius*.91,190);
   g.uniform2f(u.waveCenter,190,190);render(1);const wave=pixel(190+waveRadius*.91,190),waveCore=pixel(190,190);widths.push(stroke(190+waveRadius,190,1,0));
   render(2);const largeRadius=CarpetZoom.secondaryRadius(2),waveExpanded=pixel(380+largeRadius*.91,380);
   const jointR=collar*2,secondaryJoint=pixel(jointR/Math.sqrt(2),jointR/Math.sqrt(2));
   const frameJoint=pixel(380+Math.sqrt(largeRadius*largeRadius-100),390);
   // Botanical infill belongs inside fused necks, not in open field or on outlines.
   g.uniform1f(u.junctionMask,1);g.uniform2f(u.waveCenter,0,0);render(370/collar);
   const maskNeck=pixel(.25,380),maskEmpty=pixel(120,250);
   render(1);const maskBand=pixel(collar*.895,.25),maskRim=pixel(collar,.25);
   const maskFrameRim=pixel(.25,390),maskFrameGuard=pixel(.25,393);
   return {hem,corner,empty,separated,widths,pulled,unpulled,nearReach,farReach,flatRing,flatFrame,beforeWave,wave,waveCore,waveExpanded,secondaryJoint,frameJoint,waveRadius,largeRadius,maskNeck,maskEmpty,maskBand,maskRim,maskFrameRim,maskFrameGuard,derivatives,error:g.getError()};
  },process.argv.includes('--finite-gradient'));
  assert.equal(result.error,0);
  for(const [name,pixels] of [['hem',result.hem],['corner',result.corner]]){
   assert.ok(pixels.every(p=>p[3]===255),name+' neck must be opaque and continuous');
   assert.ok(pixels.every(p=>p[2]>230&&p[0]<25),name+' must have no internal gold seam');
  }
  assert.equal(result.empty[3],0,'distant background must remain open');
  assert.equal(result.separated[3],0,'separated shapes must not be joined prematurely');
  assert.ok(result.widths.every(w=>Math.abs(w-2.8)<.45),'common rim must retain uniform thickness: '+result.widths);
  assert.equal(result.pulled[3],255,'corner must reach outward with its ornament');assert.equal(result.unpulled[3],0);
  assert.ok(result.nearReach>.15&&result.farReach===0,'corners stretch only during an approach');
  for(const samples of [result.flatRing,result.flatFrame])assert.equal(new Set(samples.map(p=>p.join(','))).size,1,'pigment regions must be flat, without spatial color gradients');
  assert.notDeepEqual(result.flatRing[0],result.flatFrame[0],'frame and rosette bands must use distinct flat pigments');
  assert.equal(result.beforeWave[3],0);assert.equal(result.waveCore[3],0,'secondary wave must preserve its flower center');
  for(const p of [result.wave,result.waveExpanded,result.secondaryJoint,result.frameJoint])assert.ok(p[3]===255&&p[2]>230&&p[0]<25,'secondary waves must expand and fuse without an internal outline');
  assert.ok(result.largeRadius>2*result.waveRadius,'secondary radius must grow relative to the surrounding zoom');
  assert.equal(result.maskNeck[3],255,'infill must fill the fused neck');
  for(const p of [result.maskEmpty,result.maskBand,result.maskRim,result.maskFrameRim,result.maskFrameGuard])assert.equal(p[3],0,'infill must preserve open field, separate bands and clear outer rims');
  console.log(JSON.stringify({pass:true,hemSamples:result.hem.length,cornerSamples:result.corner.length,strokeWidths:result.widths,nearReach:result.nearReach,farReach:result.farReach,flatPigments:[result.flatRing[0],result.flatFrame[0]],secondaryRadii:[result.waveRadius,result.largeRadius],opaque:true,internalSeams:false,derivatives:result.derivatives,error:result.error}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
