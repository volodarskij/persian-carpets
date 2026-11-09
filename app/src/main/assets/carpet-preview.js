(() => {
  'use strict';
  const root=document.getElementById('persian-loom');
  const canvas=root.querySelector('[data-renderer="zoom"]'),flowCanvas=root.querySelector('[data-renderer="flow"]');
  const status=root.querySelector('[data-status]'),pauseButton=root.querySelector('[data-action="pause"]');
  const modeButtons=[...root.querySelectorAll('[data-mode]')],errorBox=root.querySelector('.loom-error');
  let flowRenderer,zoomRenderer;
  try{flowRenderer=CarpetGpu.create(flowCanvas);zoomRenderer=CarpetZoom.create(canvas);}
  catch(e){errorBox.hidden=false;errorBox.textContent='Не удалось запустить отрисовку: '+e.message;return;}
  let baseSeed=(Date.now()^0x518ed9)>>>0,mode='zoom',paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let elapsed=0,previous=0,lastAnnounced='',idleTimer,alive=true,dirty=true,raf=0;
  function restore(s){const m=s?.modelContent||s;if(m?.mode==='flow'||m?.mode==='zoom')mode=m.mode;if(Number.isInteger(m?.seed))baseSeed=m.seed>>>0;if(typeof s?.privateContent?.paused==='boolean')paused=s.privateContent.paused;}
  restore(window.openai?.widgetState);
  function save(){if(window.openai?.setWidgetState)window.openai.setWidgetState({modelContent:{mode,seed:baseSeed},privateContent:{paused}}).catch(()=>{});}
  function resize(){const r=root.querySelector('.loom-stage').getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=flowCanvas.width=w;canvas.height=flowCanvas.height=h;dirty=true;}}
  const observer=new ResizeObserver(resize);observer.observe(root.querySelector('.loom-stage'));resize();
  function draw(now){
    if(!alive)return;
    if(previous&&!paused&&!document.hidden)elapsed+=Math.min((now-previous)/1000,.1);previous=now;
    if(document.hidden||(paused&&!dirty)){raf=requestAnimationFrame(draw);return;}
    dirty=false;
    const duration=18,index=Math.floor(elapsed/duration);
    if(mode==='flow')flowRenderer.render(baseSeed,elapsed,duration);else zoomRenderer.render(baseSeed,elapsed,duration);
    const label=(mode==='zoom'?'Раскрытие центра · уровень ':'Морфинг рисунка · ковёр ')+(index+1)+(paused?' · пауза':'');
    if(label!==lastAnnounced){status.textContent=label;lastAnnounced=label;}
    raf=requestAnimationFrame(draw);
  }
  function controls(){dirty=true;canvas.hidden=mode!=='zoom';flowCanvas.hidden=mode!=='flow';modeButtons.forEach(b=>{const active=b.dataset.mode===mode;b.setAttribute('aria-pressed',String(active));b.classList.toggle('btn-primary',active);});pauseButton.textContent=paused?'Продолжить':'Пауза';pauseButton.setAttribute('aria-pressed',String(paused));}
  function choose(value){mode=value;controls();save();wake();}
  function pause(){paused=!paused;controls();save();wake();}
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(root.requestFullscreen){await root.requestFullscreen();if(document.activeElement instanceof HTMLElement)document.activeElement.blur();}else throw new Error('unavailable');}catch{status.textContent='Полный экран недоступен в этом окне. Откройте версию для компьютера.';}wake();}
  function wake(){root.classList.remove('loom-idle');clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(document.fullscreenElement===root&&!root.querySelector('.viz-controls').contains(document.activeElement))root.classList.add('loom-idle');},2800);}
  modeButtons.forEach(b=>b.addEventListener('click',()=>choose(b.dataset.mode)));pauseButton.addEventListener('click',pause);root.querySelector('[data-action="fullscreen"]').addEventListener('click',fullscreen);
  root.addEventListener('pointermove',wake);root.addEventListener('pointerdown',wake);root.addEventListener('focusin',wake);
  document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();pause();}else if(e.code==='Digit1')choose('flow');else if(e.code==='Digit2')choose('zoom');else if(e.code==='KeyF'){e.preventDefault();fullscreen();}});
  document.addEventListener('visibilitychange',()=>{previous=0;});
  [canvas,flowCanvas].forEach(c=>c.addEventListener('webglcontextlost',e=>{e.preventDefault();alive=false;cancelAnimationFrame(raf);errorBox.hidden=false;errorBox.textContent='Графический контекст приостановлен. Перезагрузите окно, чтобы продолжить.';}));
  window.addEventListener('openai:set_globals',e=>{if(e.detail?.globals?.widgetState){const oldSeed=baseSeed;restore(e.detail.globals.widgetState);if(oldSeed!==baseSeed)elapsed=0;controls();}});
  window.addEventListener('pagehide',()=>{alive=false;cancelAnimationFrame(raf);clearTimeout(idleTimer);observer.disconnect();flowRenderer.destroy();zoomRenderer.destroy();});
  controls();raf=requestAnimationFrame(draw);
})();
