/* A morphing rosette unfolds recursively. All scales share live vector geometry. */
(function(global){
  'use strict';
  var ratio=.22;
  var surfaceVertex='attribute vec2 a;varying vec2 world;void main(){world=vec2((a.x+1.)*400.,(1.-a.y)*225.);gl_Position=vec4(a,0.,1.);}';
  // Signed distance fields make one opaque silhouette; only its outer boundary is outlined.
  var surfaceFragment=[
    'precision highp float;varying vec2 world;uniform vec3 contour;uniform vec4 bounds;uniform vec2 waveCenter;uniform float zoom;uniform float cornerStretch;uniform float junctionMask;uniform float aa;uniform vec3 blue;uniform vec3 gold;uniform vec3 accent;uniform vec3 warm;',
    'vec2 profile(vec2 q){float r=max(length(q),.00001);vec2 n=q/r;float c2=2.*n.x*n.x-1.;float s2=2.*n.x*n.y;float c4=2.*c2*c2-1.;float s4=2.*s2*c2;float c8=2.*c4*c4-1.;float s8=2.*s4*c4;float c12=2.*c8*c4-c4;float s12=s8*c4+c8*s4;float h=1.+dot(contour,vec3(c4,c8,c12));float slope=dot(contour,vec3(-4.*s4,-8.*s8,-12.*s12));return vec2(h,sqrt(1.+slope*slope/(h*h)));}',
    'float unite(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}',
    'float contact(float a,float b,float k){return max(0.,1.-abs(a-b)/k)*(1.-smoothstep(k,k*2.,max(abs(a),abs(b))));}',
    'float secondaryRadius(float scale){float t=clamp(log(scale/.25)/log(10.),0.,1.);return scale*(20.+130.*t*t*(3.-2.*t));}',
    'vec4 field(vec2 p){',
    'vec2 u=clamp(p/(bounds.xy-18.),0.,1.);vec2 wave=sin(u*3.141593);vec2 scallop=(3.5+contour.y*6.)*(1.-cos(u*vec2(75.398224,43.982297)))*wave*wave;',
    'float hem=min(bounds.x+scallop.y-p.x,bounds.y+scallop.x-p.y);',
    'vec2 axis=normalize(bounds.xy);vec2 delta=p-bounds.xy;delta-=axis*dot(delta,axis)*(cornerStretch/(1.+cornerStretch));',
    'vec2 cq=-delta/bounds.zw;vec2 cp=profile(cq);float cd=(abs(length(cq)-cp.x*.88)-cp.x*.12)*min(bounds.z,bounds.w)/cp.y;',
    'float fixedShape=unite(hem,cd,20.);float joins=contact(hem,cd,20.);float r=length(p);vec2 rp=profile(p);float rings=100000.;float secondary=100000.;float scale=zoom/.22;',
    'for(int i=0;i<6;i++){float radius=(450.*.22/.79)*scale;float d=(abs(r-radius*rp.x*.895)-radius*rp.x*.105)/rp.y;rings=min(rings,d);scale*=.22;}',
    'scale=zoom/.22;if(waveCenter.x>0.){for(int i=0;i<6;i++){vec2 q=p-waveCenter*scale;vec2 wp=profile(q);float wr=secondaryRadius(scale);float wd=(abs(length(q)-wr*wp.x*.91)-wr*wp.x*.09)/wp.y;secondary=min(secondary,wd);float k=min(28.,18.*scale);joins=max(joins,contact(rings,wd,k));rings=unite(rings,wd,k);scale*=.22;}}',
    'joins=max(joins,contact(rings,fixedShape,56.));float h=clamp(.5+.5*(rings-fixedShape)/56.,0.,1.);return vec4(mix(rings,fixedShape,h)-56.*h*(1.-h),h,secondary,joins);}',
    'void main(){vec4 shape=field(world);',
    '#ifdef HAS_DERIVATIVES',
    'float gradient=length(vec2(dFdx(shape.x),dFdy(shape.x)))*.7/aa;',
    '#else',
    'float gradient=length(vec2(field(world+vec2(.5,0.)).x-field(world-vec2(.5,0.)).x,field(world+vec2(0.,.5)).x-field(world-vec2(0.,.5)).x));',
    '#endif',
    'float distance=shape.x/max(gradient,.18);if(junctionMask>.5){if(shape.w<.18||distance>-4.)discard;gl_FragColor=vec4(1.);return;}float rimWidth=1.4;float coverage=1.-smoothstep(rimWidth-aa,rimWidth+aa,distance);if(coverage<.001)discard;',
    // Flat pigments form ornamental regions. Only geometric edges are antialiased.
    'vec3 ringColor=mix(blue,accent,.22);vec3 frameColor=mix(blue,warm,.32);vec3 waveColor=mix(blue,warm,.58);vec3 material=shape.z<0.?waveColor:shape.y>.5?frameColor:ringColor;',
    'float rim=smoothstep(-rimWidth-aa,-rimWidth+aa,distance);gl_FragColor=vec4(mix(material,gold,rim),coverage);}',
  ].join('\n');
  var derivativeFragment='#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIVATIVES\n'+surfaceFragment;
  function secondaryRadius(scale){var t=Math.max(0,Math.min(1,Math.log(scale/.25)/Math.log(10)));return scale*(20+130*t*t*(3-2*t));}
  function layerBackground(colors,level,out){
    var kind=((level%4)+4)%4;out=out||new Float32Array(3);
    for(var k=0;k<3;k++)out[k]=kind===0?colors[k]:kind===1?colors[3+k]*.82+colors[k]*.18:kind===2?colors[6+k]*.66+colors[k]*.14:colors[12+k]*.52+colors[3+k]*.28;
    return out;
  }
  function cornerReach(bounds,contour,zoom){
    var d=Math.hypot(bounds[0],bounds[1]),nx=bounds[0]/d,ny=bounds[1]/d;
    function profile(th){return 1+contour[0]*Math.cos(4*th)+contour[1]*Math.cos(8*th)+contour[2]*Math.cos(12*th);}
    var front=d-profile(Math.atan2(ny/bounds[3],nx/bounds[2]))/Math.hypot(nx/bounds[2],ny/bounds[3]);
    var edge=profile(Math.atan2(ny,nx)),gap=Infinity,scale=zoom/ratio;
    for(var i=0;i<6;i++){var radius=450*ratio/.79*scale*edge;gap=Math.min(gap,Math.max(0,Math.abs(front-radius*.895)-radius*.105));scale*=ratio;}
    var t=Math.max(0,Math.min(1,1-gap/85));return .18*t*t*(3-2*t);
  }
  function rendererShaders(){
    var clip='varying vec2 local;uniform vec3 contour;uniform float edgeAA;float boundaryMask(vec2 q){float r=length(q);float nx=q.x/max(r,.00001);float c2=2.*nx*nx-1.;float c4=2.*c2*c2-1.;float c8=2.*c4*c4-1.;float c12=2.*c8*c4-c4;float edge=1.+dot(contour,vec3(c4,c8,c12));return 1.-smoothstep(edge-edgeAA,edge+edgeAA,r);}';
    var vertex='uniform float magnification;uniform vec2 offset;varying vec2 local;'+CarpetGpu.shaders.vertex.replace('vec2 p=mix(a,b,phase)/16.;','vec2 p=mix(a,b,phase)/16.;local=p/vec2(450.);p=p*magnification+offset;');
    var fragment=CarpetGpu.shaders.fragment.replace('precision mediump float;','precision highp float;'+clip+'uniform float lodScale;')
      .replace('void main(){','void main(){float mask=boundaryMask(local);if(mask<.001)discard;')
      .replace('.9/max(motif.w,1.)','.9/max(motif.w*lodScale,1.)')
      .replace('coverage*.46','coverage*.46*smoothstep(.45,1.4,motif.w*lodScale)');
    fragment=fragment.slice(0,-1)+'gl_FragColor.a*=mask;if(gl_FragColor.a<.02)discard;}';
    var backgroundVertex='attribute vec2 a;uniform float magnification;varying vec2 local;void main(){local=vec2((a.x+1.)*(800./450.)*.5,(1.-a.y)*.5)/magnification;gl_Position=vec4(a,0.,1.);}';
    var backgroundFragment='precision highp float;'+clip+'uniform vec3 pigment;void main(){float mask=boundaryMask(local);if(mask<.001)discard;gl_FragColor=vec4(pigment,mask);}';
    var fieldFragment=surfaceFragment.slice(0,surfaceFragment.indexOf('float distance='))+'float distance=shape.x/max(gradient,.18);float quantized=clamp((distance+64.)/128.,0.,1.)*255.;float hi=floor(quantized);gl_FragColor=vec4(hi/255.,quantized-hi,shape.z<0.?1.:shape.y>.5?.5:0.,shape.w);}';
    var cachedSurfaceFragment='precision highp float;varying vec2 world;uniform sampler2D fieldTexture;uniform float aa;uniform float junctionMask;uniform vec3 blue;uniform vec3 accent;uniform vec3 warm;uniform vec3 gold;void main(){vec4 texelValue=texture2D(fieldTexture,vec2(world.x/800.,1.-world.y/450.));float distance=(texelValue.r+texelValue.g/255.)*128.-64.;if(junctionMask>.5){if(texelValue.a<.18||distance>-4.)discard;gl_FragColor=vec4(1.);return;}float coverage=1.-smoothstep(1.4-aa,1.4+aa,distance);if(coverage<.001)discard;vec3 material=texelValue.b>.75?mix(blue,warm,.58):texelValue.b>.25?mix(blue,warm,.32):mix(blue,accent,.22);float rim=smoothstep(-1.4-aa,-1.4+aa,distance);gl_FragColor=vec4(mix(material,gold,rim),coverage);}';
    var fastFragment=CarpetGpu.shaders.fragment.replace('void main(){','uniform float lodScale;void main(){').replace('.9/max(motif.w,1.)','.9/max(motif.w*lodScale,1.)').replace('coverage*.46','coverage*.46*smoothstep(.45,1.4,motif.w*lodScale)');
    fastFragment=fastFragment.replace('smoothstep(.45,1.4,motif.w*lodScale)','smoothstep(1.,2.2,motif.w*lodScale)');
    fastFragment=fastFragment.replace('precision mediump float;','precision mediump float;'+clip+'uniform float cacheClip;');
    fastFragment=fastFragment.slice(0,-1)+'if(cacheClip>.5)gl_FragColor*=boundaryMask(local);if(gl_FragColor.a<.02)discard;}';
    return {vertex:vertex,fragment:fragment,fastFragment:fastFragment,fanVertex:'attribute vec2 a;void main(){gl_Position=vec4(a.x/400.-1.,1.-a.y/225.,0.,1.);}',fanFragment:'precision mediump float;uniform vec3 pigment;void main(){gl_FragColor=vec4(pigment,1.);}',backgroundVertex:backgroundVertex,backgroundFragment:backgroundFragment,cornerVertex:'uniform vec4 bounds;uniform float cornerStretch;'+CarpetGpu.shaders.vertex.replace('vec2 p=mix(a,b,phase)/16.;','vec2 p=mix(a,b,phase)/16.;vec2 axis=normalize(bounds.xy);p+=axis*dot(p-bounds.xy,axis)*cornerStretch;'),surfaceVertex:surfaceVertex,surfaceFragment:surfaceFragment,surfaceDerivativeFragment:derivativeFragment,fieldFragment:fieldFragment,fieldDerivativeFragment:'#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIVATIVES\n'+fieldFragment,cachedSurfaceFragment:cachedSurfaceFragment};
  }
  function create(canvas){
    var gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
    if(!gl)throw new Error('WebGL недоступен');
    var shared=rendererShaders();
    function program(v,f){
      var p=gl.createProgram();[[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]].forEach(function(pair){var s=gl.createShader(pair[0]);gl.shaderSource(s,pair[1]);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);});
      gl.bindAttribLocation(p,0,'a');gl.bindAttribLocation(p,1,'b');gl.bindAttribLocation(p,2,'info');gl.bindAttribLocation(p,3,'infoB');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
    }
    function uniforms(p,names){var out={};names.split(' ').forEach(function(n){out[n]=gl.getUniformLocation(p,n);});return out;}
    var main=program(shared.vertex,shared.fragment),background=program(shared.backgroundVertex,shared.backgroundFragment),surface=program(surfaceVertex,gl.getExtension('OES_standard_derivatives')?derivativeFragment:surfaceFragment),edge=program(CarpetGpu.shaders.vertex,CarpetGpu.shaders.fragment),corner=program(shared.cornerVertex,CarpetGpu.shaders.fragment),mirror=program(CarpetGpu.shaders.mirrorVertex,CarpetGpu.shaders.mirrorFragment);
    var u=uniforms(main,'phase palette[0] magnification offset contour edgeAA lodScale'),bg=uniforms(background,'magnification contour edgeAA pigment'),sf=uniforms(surface,'contour bounds waveCenter zoom cornerStretch junctionMask aa blue gold accent warm'),ed=uniforms(edge,'phase palette[0]'),co=uniforms(corner,'phase palette[0] bounds cornerStretch'),mi=uniforms(mirror,'rug texel');
    var groups={};['body','trim','wave','junction','frameBody','cornerTrim','frameTrim'].forEach(function(key){groups[key]=[gl.createBuffer(),gl.createBuffer()];});
    var quad=gl.createBuffer(),fbo=gl.createFramebuffer(),texture=gl.createTexture(),stencil=gl.createRenderbuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    var fw=0,fh=0,left=null,right=null,future=null,seedValue=null,durationValue=0,colors=new Float32Array(18),fieldColor=new Float32Array(3),contour=new Float32Array(3),bounds=new Float32Array(4),waveCenter=new Float32Array(2),generationMs=0;
    function part(scene,start,end){return CarpetMesh.pack(CarpetMesh.compile({shape:scene.shape,commands:scene.commands.slice(start,end)}));}
    function pose(seed,second,duration){
      var mark=performance.now(),t=second/duration,i=Math.floor(t),scene=CarpetEngine.frame(seed,i,t-i,{unfold:true,fusion:true}),frame=CarpetEngine.frame(seed,i,t-i,{unfoldFrame:true,fusion:true}),wave=CarpetEngine.frame(seed,i,t-i,{unfoldWave:true}),junction=CarpetEngine.frame(seed,i,t-i,{unfoldJunction:true});
      var value={second:second,scene:scene,bounds:frame.bounds,body:part(scene,0,scene.bodyEnd),trim:part(scene,scene.bodyEnd),wave:part(wave,0),junction:part(junction,0),frameBody:part(frame,0,frame.bodyEnd),cornerTrim:part(frame,frame.bodyEnd,frame.cornerEnd),frameTrim:part(frame,frame.cornerEnd)};
      generationMs=performance.now()-mark;return value;
    }
    function upload(index,value){Object.keys(groups).forEach(function(key){gl.bindBuffer(gl.ARRAY_BUFFER,groups[key][index]);gl.bufferData(gl.ARRAY_BUFFER,value[key],gl.STATIC_DRAW);});}
    function bindQuad(){for(var k=1;k<4;k++)gl.disableVertexAttribArray(k);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);}
    function bindMesh(pair){
      gl.bindBuffer(gl.ARRAY_BUFFER,pair[0]);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.SHORT,false,6,0);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.UNSIGNED_BYTE,false,6,4);
      gl.bindBuffer(gl.ARRAY_BUFFER,pair[1]);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.SHORT,false,6,0);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,2,gl.UNSIGNED_BYTE,false,6,4);
    }
    function render(seed,time,duration){
      duration=duration||18;var second=Math.floor(time);
      if(seedValue!==seed||durationValue!==duration||!left||second<left.second||second>left.second+1){seedValue=seed;durationValue=duration;left=pose(seed,second,duration);right=pose(seed,second+1,duration);future=null;upload(0,left);upload(1,right);}
      if(second>left.second){left=right;right=future&&future.second===second+1?future:pose(seed,second+1,duration);future=null;Object.keys(groups).forEach(function(key){groups[key].reverse();});upload(1,right);}
      var t=time-second;if(!future&&t>.15)future=pose(seed,second+2,duration);
      // Two samples per output pixel keep fine leaves quiet during continuous scaling.
      var width=Math.min(2048,Math.max(1,canvas.width)),height=Math.max(1,Math.round(width*9/16));
      if(width!==fw||height!==fh){fw=width;fh=height;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,fw,fh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.bindRenderbuffer(gl.RENDERBUFFER,stencil);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_STENCIL,fw,fh);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,stencil);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Incomplete unfold framebuffer');}
      for(var c=0;c<6;c++)for(var k=0;k<3;k++){var shift=(2-k)*8;colors[c*3+k]=(((left.scene.p[c]>>>shift)&255)*(1-t)+((right.scene.p[c]>>>shift)&255)*t)/255;}
      for(k=0;k<3;k++)contour[k]=left.scene.contour[k]*(1-t)+right.scene.contour[k]*t;
      for(k=0;k<4;k++)bounds[k]=left.bounds[k]*(1-t)+right.bounds[k]*t;
      for(k=0;k<2;k++)waveCenter[k]=left.scene.waveCenter[k]*(1-t)+right.scene.waveCenter[k]*t;
      gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,fw,fh);gl.clearColor(colors[0],colors[1],colors[2],1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      var phase=time/duration-Math.floor(time/duration),zoom=Math.pow(1/ratio,phase),reach=cornerReach(bounds,contour,zoom),count=left.body.length/6;
      function drawRosette(scale,key,ox,oy){gl.useProgram(main);gl.uniform1f(u.phase,t);gl.uniform3fv(u['palette[0]'],colors);gl.uniform1f(u.magnification,scale);gl.uniform2f(u.offset,ox||0,oy||0);gl.uniform3fv(u.contour,contour);gl.uniform1f(u.edgeAA,.65/(fh*scale));gl.uniform1f(u.lodScale,scale*fw/800);bindMesh(groups[key]);gl.drawArrays(gl.TRIANGLES,0,left[key].length/6);}
      function drawFrame(key){var isCorner=key==='frameBody'||key==='cornerTrim',loc=isCorner?co:ed;gl.useProgram(isCorner?corner:edge);gl.uniform1f(loc.phase,t);gl.uniform3fv(loc['palette[0]'],colors);if(isCorner){gl.uniform4fv(co.bounds,bounds);gl.uniform1f(co.cornerStretch,reach);}bindMesh(groups[key]);gl.drawArrays(gl.TRIANGLES,0,left[key].length/6);}
      // Keep fine ornament at cloth scale while the large garden expands. Stencil
      // records the visible garden, so infill occupies gaps rather than flower faces.
      gl.enable(gl.STENCIL_TEST);gl.stencilMask(255);gl.clearStencil(0);gl.clear(gl.STENCIL_BUFFER_BIT);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);
      for(var depth=-1;depth<=4;depth++){
        var scale=zoom*Math.pow(ratio,depth),aa=.65/(fh*scale);
        gl.stencilFunc(gl.ALWAYS,0,255);
        gl.useProgram(background);gl.uniform1f(bg.magnification,scale);gl.uniform3fv(bg.contour,contour);gl.uniform1f(bg.edgeAA,aa);gl.uniform3fv(bg.pigment,layerBackground(colors,depth+Math.floor(time/duration),fieldColor));bindQuad();gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
        gl.stencilFunc(gl.ALWAYS,1,255);
        drawRosette(scale,'body');
      }
      gl.stencilMask(0);gl.stencilFunc(gl.EQUAL,0,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);drawFrame('junction');
      gl.disable(gl.STENCIL_TEST);gl.stencilMask(255);
      drawFrame('frameBody');
      // Merge material first, then place the shared leafwork on its continuous surface.
      gl.useProgram(surface);gl.uniform1f(sf.junctionMask,0);gl.uniform3fv(sf.contour,contour);gl.uniform4fv(sf.bounds,bounds);gl.uniform2fv(sf.waveCenter,waveCenter);gl.uniform1f(sf.zoom,zoom);gl.uniform1f(sf.cornerStretch,reach);gl.uniform1f(sf.aa,.7*450/fh);gl.uniform3fv(sf.blue,colors.subarray(3,6));gl.uniform3fv(sf.gold,colors.subarray(15,18));gl.uniform3fv(sf.accent,colors.subarray(12,15));gl.uniform3fv(sf.warm,colors.subarray(6,9));bindQuad();gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      for(depth=-1;depth<=4;depth++)drawRosette(zoom*Math.pow(ratio,depth),'trim');
      for(depth=-1;depth<=4;depth++){var scale=zoom*Math.pow(ratio,depth);drawRosette(secondaryRadius(scale)/100,'wave',waveCenter[0]*scale,waveCenter[1]*scale);}
      drawFrame('cornerTrim');drawFrame('frameTrim');
      // Infill is limited to joined material, with a clear margin around its outer outline.
      gl.enable(gl.STENCIL_TEST);gl.stencilMask(255);gl.clearStencil(0);gl.clear(gl.STENCIL_BUFFER_BIT);
      gl.stencilFunc(gl.ALWAYS,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);gl.colorMask(false,false,false,false);
      gl.useProgram(surface);gl.uniform1f(sf.junctionMask,1);bindQuad();gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      gl.colorMask(true,true,true,true);gl.stencilMask(0);gl.stencilFunc(gl.EQUAL,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
      drawFrame('junction');gl.disable(gl.STENCIL_TEST);gl.stencilMask(255);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.BLEND);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
      var fit=Math.min(canvas.width/1600,canvas.height/900),w=Math.round(1600*fit),h=Math.round(900*fit);gl.viewport(Math.round((canvas.width-w)/2),Math.round((canvas.height-h)/2),w,h);
      gl.useProgram(mirror);bindQuad();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(mi.rug,0);gl.uniform2f(mi.texel,1/fw,1/fh);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      return {vertices:count+left.trim.length/6,secondaryVertices:left.wave.length/6,junctionVertices:left.junction.length/6,frameVertices:(left.frameBody.length+left.cornerTrim.length+left.frameTrim.length)/6,cornerStretch:reach,layers:6,generationMs:generationMs,error:gl.getError()};
    }
    return {render:render,destroy:function(){Object.keys(groups).forEach(function(key){groups[key].forEach(function(b){gl.deleteBuffer(b);});});gl.deleteBuffer(quad);gl.deleteTexture(texture);gl.deleteRenderbuffer(stencil);gl.deleteFramebuffer(fbo);[main,background,surface,edge,corner,mirror].forEach(function(p){gl.deleteProgram(p);});}};
  }
  global.CarpetZoom={create:create,ratio:ratio,secondaryRadius:secondaryRadius,layerBackground:layerBackground,cornerReach:cornerReach,rendererShaders:rendererShaders,shaders:{surfaceVertex:surfaceVertex,surfaceFragment:surfaceFragment,surfaceDerivativeFragment:derivativeFragment}};
})(typeof window!=='undefined'?window:globalThis);
