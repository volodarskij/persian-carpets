const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const assets=path.join(__dirname,'../app/src/main/assets');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CARPET_BROWSER,headless:true});
 try{
  const page=await browser.newPage();await page.setContent('<canvas width="800" height="450"></canvas>');
  for(const file of ['carpet-gpu.js','carpet-zoom.js'])await page.addScriptTag({content:fs.readFileSync(path.join(assets,file),'utf8')});
  const result=await page.evaluate(()=>{
   const g=document.querySelector('canvas').getContext('webgl',{alpha:true,stencil:true,antialias:false,preserveDrawingBuffer:true}),s=CarpetZoom.rendererShaders();
   const derivative=!!g.getExtension('OES_standard_derivatives');
   function program(v,f){let p=g.createProgram();for(const [kind,src] of [[g.VERTEX_SHADER,v],[g.FRAGMENT_SHADER,f]]){let q=g.createShader(kind);g.shaderSource(q,src);g.compileShader(q);if(!g.getShaderParameter(q,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(q));g.attachShader(p,q);}g.bindAttribLocation(p,0,'a');g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;}
   const raw=program(s.surfaceVertex,derivative?s.surfaceDerivativeFragment:s.surfaceFragment),field=program(s.surfaceVertex,derivative?s.fieldDerivativeFragment:s.fieldFragment),cached=program(s.surfaceVertex,s.cachedSurfaceFragment);
   program(s.vertex,s.fastFragment);program(s.fanVertex,s.fanFragment);
   const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);
   function set(p,h){g.useProgram(p);const u=n=>g.getUniformLocation(p,n);g.uniform3f(u('contour'),0,0,0);g.uniform4f(u('bounds'),740,390,150,120);g.uniform2f(u('waveCenter'),190,190);g.uniform1f(u('zoom'),2);g.uniform1f(u('aa'),.7*450/h);g.uniform3f(u('blue'),0,0,1);g.uniform3f(u('gold'),1,1,0);g.uniform3f(u('accent'),0,0,1);g.uniform3f(u('warm'),0,0,1);}
   const tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,240,135,0,g.RGBA,g.UNSIGNED_BYTE,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
   const f=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,f);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,tex,0);g.viewport(0,0,240,135);set(field,135);g.drawArrays(g.TRIANGLE_STRIP,0,4);
   function pixel(x,y){let a=new Uint8Array(4);g.readPixels(Math.floor(x),449-Math.floor(y),1,1,g.RGBA,g.UNSIGNED_BYTE,a);return Array.from(a);}
   const points=[[10,10],[210,75],[250/Math.sqrt(2),250/Math.sqrt(2)],[500,420],[300,250],[380,380]];
   g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,800,450);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);set(raw,450);g.drawArrays(g.TRIANGLE_STRIP,0,4);const expected=points.map(p=>pixel(...p));
   g.clear(g.COLOR_BUFFER_BIT);set(cached,450);g.uniform1i(g.getUniformLocation(cached,'fieldTexture'),0);g.drawArrays(g.TRIANGLE_STRIP,0,4);const actual=points.map(p=>pixel(...p));
   // Stencil must follow the six petals, not the bounding quad or a circular disk.
   const motifVertex='attribute vec2 a;varying vec2 local;varying vec4 ink;varying vec4 motif;void main(){local=vec2(0.);gl_Position=vec4(a,0.,1.);ink=vec4(1.);motif=vec4(a,1.,8.);}';
   const flower=program(motifVertex,s.fastFragment),solid=program(s.surfaceVertex,'precision mediump float;void main(){gl_FragColor=vec4(0.,1.,0.,1.);}');
   g.clear(g.COLOR_BUFFER_BIT|g.STENCIL_BUFFER_BIT);g.enable(g.STENCIL_TEST);g.stencilFunc(g.ALWAYS,1,255);g.stencilOp(g.KEEP,g.KEEP,g.REPLACE);g.useProgram(flower);g.uniform1f(g.getUniformLocation(flower,'lodScale'),1);g.colorMask(false,false,false,false);g.drawArrays(g.TRIANGLE_STRIP,0,4);
   g.colorMask(true,true,true,true);g.stencilFunc(g.EQUAL,1,255);g.stencilOp(g.KEEP,g.KEEP,g.KEEP);g.useProgram(solid);g.drawArrays(g.TRIANGLE_STRIP,0,4);
   const tip=pixel(400+.70*400,225),valley=pixel(400+.70*Math.cos(Math.PI/6)*400,225-.70*Math.sin(Math.PI/6)*225),outside=pixel(790,10);
   return {expected,actual,tip,valley,outside,error:g.getError()};
  });
  assert.equal(result.error,0);result.actual.forEach((p,i)=>p.forEach((v,k)=>assert.ok(Math.abs(v-result.expected[i][k])<18,'Cached field interior differs')));
  assert.equal(result.tip[3],255);assert.equal(result.valley[3],0);assert.equal(result.outside[3],0);
  console.log(JSON.stringify({pass:true,cachedFieldSamples:result.actual.length,petalStencil:true,error:result.error}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
