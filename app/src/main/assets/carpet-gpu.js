/* The same GLES 2 shaders and tessellated geometry are used on desktop and Android. */
(function(global){
  'use strict';
  var shaders={
    vertex:'attribute vec2 a;attribute vec2 b;attribute vec2 info;attribute vec2 infoB;uniform float phase;uniform vec3 palette[6];varying vec4 ink;varying vec4 motif;void main(){vec2 p=mix(a,b,phase)/16.;gl_Position=vec4(p.x/400.-1.,1.-p.y/225.,0.,1.);float kind=floor(info.x/16.);int c=int(info.x-kind*16.+.5);float corner=mod(info.y,4.);motif=vec4(vec2(mod(corner,2.),floor(corner*.5))*2.-1.,kind,mix(floor(info.y/4.),floor(infoB.y/4.),phase));ink=vec4(palette[c],kind>.5?1.:mix(info.y,infoB.y,phase)/255.);}',
    fragment:'precision mediump float;varying vec4 ink;varying vec4 motif;void main(){if(motif.z>.5){float rr=dot(motif.xy,motif.xy);float r=sqrt(rr);float nx=motif.x*inversesqrt(max(rr,.0001));float c3=nx*(4.*nx*nx-3.);float edge=.66+.16*(2.*c3*c3-1.);float aa=clamp(.9/max(motif.w,1.),.08,.40);float coverage=1.-smoothstep(edge-aa,edge+aa,r);vec3 color=mix(ink.rgb*(.72+.28*smoothstep(.1,.5,r)),vec3(1.,.86,.38),1.-smoothstep(.12,.25,r));gl_FragColor=vec4(color,coverage*.46);}else{gl_FragColor=ink;}}',
    mirrorVertex:'attribute vec2 a;varying vec2 uv;void main(){uv=a;gl_Position=vec4(a,0.,1.);}',
    mirrorFragment:'precision mediump float;varying vec2 uv;uniform sampler2D rug;uniform vec2 texel;void main(){vec2 q=abs(uv);q.y=1.-q.y;q=clamp(q,texel*.5,1.-texel*.5);gl_FragColor=texture2D(rug,q);}'
  };
  function create(canvas){
    var gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
    if(!gl)throw new Error('WebGL недоступен');
    function program(v,f){
      var p=gl.createProgram();[[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]].forEach(function(pair){var s=gl.createShader(pair[0]);gl.shaderSource(s,pair[1]);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);});
      gl.bindAttribLocation(p,0,'a');gl.bindAttribLocation(p,1,'b');gl.bindAttribLocation(p,2,'info');gl.bindAttribLocation(p,3,'infoB');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
    }
    var p=program(shaders.vertex,shaders.fragment),mirror=program(shaders.mirrorVertex,shaders.mirrorFragment);
    var phase=gl.getUniformLocation(p,'phase'),palette=gl.getUniformLocation(p,'palette[0]');
    var buffers=[gl.createBuffer(),gl.createBuffer()],quad=gl.createBuffer(),fbo=gl.createFramebuffer(),texture=gl.createTexture();
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    var fw=0,fh=0,left=null,right=null,future=null,seedValue=-1,colors=new Float32Array(18),generationMs=0;
    function pose(seed,second,duration){var t=second/duration,i=Math.floor(t),s=CarpetEngine.frame(seed,i,t-i,false),mark=performance.now(),mesh=CarpetMesh.pack(CarpetMesh.compile(s));generationMs=performance.now()-mark;return {second:second,scene:s,mesh:mesh};}
    function upload(index,value){gl.bindBuffer(gl.ARRAY_BUFFER,buffers[index]);gl.bufferData(gl.ARRAY_BUFFER,value.mesh,gl.STATIC_DRAW);}
    function render(seed,time,duration){
      var second=Math.floor(time);
      if(seedValue!==seed||!left||second<left.second||second>left.second+1){seedValue=seed;left=pose(seed,second,duration);right=pose(seed,second+1,duration);future=null;upload(0,left);upload(1,right);}
      if(second>left.second){left=right;right=future&&future.second===second+1?future:pose(seed,second+1,duration);future=null;buffers.reverse();upload(1,right);}
      var t=time-second;
      if(!future&&t>.15)future=pose(seed,second+2,duration);
      var width=Math.max(1,Math.round(canvas.width/2)),height=Math.max(1,Math.round(width*9/16));
      if(width!==fw||height!==fh){fw=width;fh=height;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,fw,fh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Incomplete carpet framebuffer');}
      for(var c=0;c<6;c++)for(var k=0;k<3;k++){var shift=(2-k)*8;colors[c*3+k]=(((left.scene.p[c]>>>shift)&255)*(1-t)+((right.scene.p[c]>>>shift)&255)*t)/255;}
      gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,fw,fh);gl.clearColor(colors[0],colors[1],colors[2],1);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(p);gl.uniform1f(phase,t);gl.uniform3fv(palette,colors);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER,buffers[0]);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.SHORT,false,6,0);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.UNSIGNED_BYTE,false,6,4);gl.bindBuffer(gl.ARRAY_BUFFER,buffers[1]);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.SHORT,false,6,0);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,2,gl.UNSIGNED_BYTE,false,6,4);gl.drawArrays(gl.TRIANGLES,0,left.mesh.length/6);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.BLEND);gl.disableVertexAttribArray(1);gl.disableVertexAttribArray(2);gl.disableVertexAttribArray(3);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
      var scale=Math.min(canvas.width/1600,canvas.height/900),w=Math.round(1600*scale),h=Math.round(900*scale);gl.viewport(Math.round((canvas.width-w)/2),Math.round((canvas.height-h)/2),w,h);
      gl.useProgram(mirror);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(mirror,'rug'),0);gl.uniform2f(gl.getUniformLocation(mirror,'texel'),1/fw,1/fh);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      return {vertices:left.mesh.length/6,generationMs:generationMs,error:gl.getError()};
    }
    return {render:render,destroy:function(){buffers.concat([quad]).forEach(function(b){gl.deleteBuffer(b);});gl.deleteTexture(texture);gl.deleteFramebuffer(fbo);gl.deleteProgram(p);gl.deleteProgram(mirror);}};
  }
  global.CarpetGpu={create:create,shaders:shaders};
})(typeof window!=='undefined'?window:globalThis);
