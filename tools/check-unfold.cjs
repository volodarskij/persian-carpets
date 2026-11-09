const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const assets=path.join(__dirname,'../app/src/main/assets');
const output=path.join(__dirname,'../artifacts');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CARPET_BROWSER,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:675}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{margin:0}canvas{width:1200px;height:675px}</style><canvas width="1200" height="675"></canvas>');
  for(const file of ['carpet-engine.js','carpet-mesh.js','carpet-gpu.js','carpet-zoom.js'])if(fs.existsSync(path.join(assets,file)))await page.addScriptTag({content:fs.readFileSync(path.join(assets,file),'utf8')});
  const result=await page.evaluate(()=>{
   if(!window.CarpetZoom)throw new Error('The unfolding center renderer is missing');
   const c=document.querySelector('canvas'),r=CarpetZoom.create(c),g=c.getContext('webgl');
   const pixels=()=>{const p=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;};
   const delta=(a,b)=>{let sum=0,large=0;for(let i=0;i<a.length;i++){let d=Math.abs(a[i]-b[i]);sum+=d;if(d>30)large++;}return {mean:sum/a.length,large:large/a.length};};
   const frames=[],seams=[];
   for(const t of [0,1,8,17.999,18.001,36.001,180.001])frames.push(r.render(3179343922,t,18));
   for(const t of [0,18,36,180]){r.render(3179343922,t-.001,18);let a=pixels();r.render(3179343922,t+.001,18);seams.push(delta(a,pixels()));}
   const a=CarpetMesh.pack(CarpetMesh.compile(CarpetEngine.frame(3179343922,0,.2,{unfold:true,fusion:true}))),b=CarpetMesh.pack(CarpetMesh.compile(CarpetEngine.frame(3179343922,0,.3,{unfold:true,fusion:true})));
   let moved=0;for(let i=0;i<a.length;i+=6)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])moved++;
   r.render(3179343922,7,18);const p=pixels();let symmetric=0;
   for(let y=0;y<c.height;y+=11)for(let x=0;x<c.width;x+=11){const i=(y*c.width+x)*4,j=(y*c.width+c.width-1-x)*4;for(let k=0;k<3;k++)symmetric=Math.max(symmetric,Math.abs(p[i+k]-p[j+k]));}
   return {frames,seams,moved,symmetric,error:g.getError()};
  });
  assert.equal(errors.length,0);assert.equal(result.error,0);assert.ok(result.frames.every(f=>f.error===0));
  assert.ok(result.frames.every(f=>f.frameVertices>1000),'screen-edge frame and corners must be rendered');
  assert.ok(result.frames.every(f=>f.secondaryVertices>1000),'secondary waves must carry their own live ornament');
  assert.ok(result.frames.every(f=>f.junctionVertices>1000),'fused junctions must carry live botanical infill');
  assert.ok(result.moved>1000,'zoom must morph actual vector geometry');assert.ok(result.symmetric<=1);
  assert.ok(result.seams.every(s=>s.mean<2&&s.large<.01),'recursive levels must join without a visible pop');
  await page.screenshot({path:path.join(output,'unfold-center.png')});
  fs.writeFileSync(path.join(output,'unfold-checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
