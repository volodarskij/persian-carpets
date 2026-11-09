const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const assets=path.join(__dirname,'../app/src/main/assets');vm.runInThisContext(fs.readFileSync(path.join(assets,'carpet-mesh.js'),'utf8'));
const base={shape:[.4,.9,.1,.4],commands:[]};
const polygon=CarpetMesh.compile({...base,commands:[[5,3,-1,0,[490,240,510,240,510,260,490,260],500,250]]});
for(let i=0;i<polygon.length;i+=4)assert.ok(polygon[i]>=490&&polygon[i]<=510&&polygon[i+1]>=240&&polygon[i+1]<=260,'off-origin ornament must stay inside its own outline');
const thin=CarpetMesh.compile({...base,commands:[[1,100,100,40,0,2]]});
const large=CarpetMesh.compile({...base,commands:[[1,100,100,90,0,2]]});
assert.equal(thin.length,large.length,'growing petals must retain vertex correspondence across stroke widths');
vm.runInThisContext(fs.readFileSync(path.join(assets,'carpet-engine.js'),'utf8'));
// A fan that reverses winding crosses its own outline, leaking fill into the field.
for(const variant of [false,{unfold:true},{unfoldFrame:true},{unfoldWave:true},{unfoldJunction:true},{unfold:true,fusion:true},{unfoldFrame:true,fusion:true}])for(const seed of [11,3179343922])for(let index=-1;index<3;index++)for(const phase of [0,.5,1]){
  const scene=CarpetEngine.frame(seed,index,phase,variant);
  for(const op of scene.commands.filter(c=>c[0]===5)){
    const p=op[4],cx=op[5],cy=op[6];let sign=0;
    for(let k=0;k<p.length;k+=2){const next=(k+2)%p.length,cross=(p[k]-cx)*(p[next+1]-cy)-(p[k+1]-cy)*(p[next]-cx);
      if(Math.abs(cross)<.00001)continue;
      if(sign)assert.equal(Math.sign(cross),sign,'filled fan must not cross its outline');
      sign=Math.sign(cross);
    }
  }
}
console.log('PASS: local polygon centers, stable detail topology and non-crossing fills');
