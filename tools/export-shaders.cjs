const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assets=path.join(__dirname,'../app/src/main/assets');
for(const f of ['carpet-gpu.js','carpet-zoom.js'])vm.runInThisContext(fs.readFileSync(path.join(assets,f),'utf8'));
const zoom=CarpetZoom.rendererShaders();
const shaders={
 'carpet.vert':CarpetGpu.shaders.vertex,'carpet.frag':CarpetGpu.shaders.fragment,
 'mirror.vert':CarpetGpu.shaders.mirrorVertex,'mirror.frag':CarpetGpu.shaders.mirrorFragment,
 'zoom.vert':zoom.vertex,'zoom.frag':zoom.fragment,
 'background.vert':zoom.backgroundVertex,'background.frag':zoom.backgroundFragment,
 'corner.vert':zoom.cornerVertex,'surface.vert':zoom.surfaceVertex,
 'surface.frag':zoom.surfaceFragment,'surface-derivative.frag':zoom.surfaceDerivativeFragment,
 'zoom-fast.frag':zoom.fastFragment,'fan.vert':zoom.fanVertex,'fan.frag':zoom.fanFragment,
 'field.frag':zoom.fieldFragment,'field-derivative.frag':zoom.fieldDerivativeFragment,'surface-cached.frag':zoom.cachedSurfaceFragment
};
for(const [name,source] of Object.entries(shaders)){
 const file=path.join(assets,name);
 if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8').trim()!==source.trim())throw Error('Shader drift: '+name);}
 else fs.writeFileSync(file,source+'\n');
}
console.log('Shared native/browser shaders: '+Object.keys(shaders).length);
