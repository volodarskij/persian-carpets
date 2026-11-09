const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assets=path.join(__dirname,'../app/src/main/assets');
const frameOnly=process.argv.includes('--unfold-frame');
const variant=process.argv.includes('--unfold-center-lod')?{unfold:true,fusion:true,detailLevel:4}:frameOnly?{unfoldFrame:true}:process.argv.includes('--unfold-junction')?{unfoldJunction:true}:process.argv.includes('--unfold-wave')?{unfoldWave:true}:process.argv.includes('--unfold')?{unfold:true}:false;
if(process.argv.includes('--fusion')&&variant)variant.fusion=true;
vm.runInThisContext(fs.readFileSync(path.join(assets,'carpet-engine.js'),'utf8'));
const meshFile=path.join(assets,'carpet-mesh.js');
assert.ok(fs.existsSync(meshFile),'GPU geometry compiler must exist');
vm.runInThisContext(fs.readFileSync(meshFile,'utf8'));
let previousCount;
for(let i=0;i<10;i++)for(const phase of [0,.37,1]){
  const scene=CarpetEngine.frame(3179343922,i,phase,variant),mesh=CarpetMesh.compile(scene);
  assert.equal(mesh.length%12,0,'complete XY/palette/coverage triangles');
  if(previousCount)assert.equal(mesh.length,previousCount,'stable morph correspondence');
  previousCount=mesh.length;
  for(let j=0;j<mesh.length;j+=4){
    assert.ok(Number.isFinite(mesh[j])&&Number.isFinite(mesh[j+1]),'finite coordinates');
    assert.ok(Math.abs(mesh[j])<2048&&Math.abs(mesh[j+1])<2048,'coordinates fit signed 1/16 fixed point');
    if(frameOnly)assert.ok(mesh[j]>500||mesh[j+1]>200,'frame and corner ornament must stay at the image edges');
    assert.ok(mesh[j+2]>=0&&mesh[j+2]<22&&mesh[j+2]%16<6,'palette index and primitive tag');
    assert.ok(mesh[j+3]>=0&&mesh[j+3]<=1,'edge coverage');
  }
  if(phase===1){const next=CarpetMesh.compile(CarpetEngine.frame(3179343922,i+1,0,variant));assert.deepEqual(mesh,next,'continuous cycle boundary');}
}
const a=CarpetMesh.compile(CarpetEngine.frame(11,0,.4,variant)),b=CarpetMesh.compile(CarpetEngine.frame(11,0,.45,variant));
const packed=CarpetMesh.pack(a),packedView=new DataView(packed.buffer);
for(let i=0,j=0;i<a.length;i+=4,j+=6){assert.ok(Math.abs(packedView.getInt16(j,true)/16-a[i])<=.031251);assert.ok(Math.abs(packedView.getInt16(j+2,true)/16-a[i+1])<=.031251);assert.equal(packed[j+4],a[i+2]);}
let changed=0;for(let j=0;j<a.length;j+=4){if(a[j]!==b[j]||a[j+1]!==b[j+1])changed++;assert.equal(a[j+2],b[j+2]);}
assert.ok(changed>1000,'morph changes real geometry');
vm.runInThisContext(fs.readFileSync(path.join(assets,'carpet-gpu.js'),'utf8'));
for(const [key,file] of Object.entries({vertex:'carpet.vert',fragment:'carpet.frag',mirrorVertex:'mirror.vert',mirrorFragment:'mirror.frag'}))assert.equal(fs.readFileSync(path.join(assets,file),'utf8').trim(),CarpetGpu.shaders[key],'native/browser shader parity');
console.log(JSON.stringify({pass:true,vertices:previousCount/4,changedVertices:changed,bytesPerPose:packed.length}));
