const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const assets=path.join(__dirname,'../app/src/main/assets');
for(const f of ['carpet-engine.js','carpet-mesh.js','carpet-native.js'])vm.runInThisContext(fs.readFileSync(path.join(assets,f),'utf8'));
for(const zoom of [false,true]){
 let counts;
 for(const second of [0,1,2,17,18,19,37,38,76]){
  const pose=CarpetNative.prepare(3179343922,second,zoom);
  assert.equal(pose.parts.length,zoom?8:1);
  assert.equal(pose.p.length,6);assert.equal(pose.contour.length,3);
  if(counts)assert.deepEqual(pose.counts,counts);counts=pose.counts;
  pose.parts.forEach((part,j)=>{assert.equal(part.length,pose.counts[j]*6);assert.equal(part.length%18,0);assert.ok(part.length>0);});
 }
 console.log(JSON.stringify({zoom,counts}));
}
let calls=[];global.NativeScene={begin:s=>calls.push(['begin',JSON.parse(s)]),part:(s,i,b)=>calls.push(['part',s,i,Buffer.from(b,'base64').length]),end:s=>calls.push(['end',s]),failed:s=>{throw Error(s);}};
CarpetNative.send(11,18,true);assert.equal(calls.length,10);assert.equal(calls[0][1].parts,undefined);assert.equal(calls[9][0],'end');
calls.slice(1,9).forEach((c,i)=>assert.equal(c[3],calls[0][1].counts[i]*6));
console.log('PASS: native bridge payload order, stable topology and packed sizes');
