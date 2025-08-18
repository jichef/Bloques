function wireUI(){
  const $ = id => document.getElementById(id);
  ensureModeButton();

  $('btn-unit')   ?.addEventListener('click', ()=> createUnit());
  $('btn-ten')    ?.addEventListener('click', ()=> createTen());
  $('btn-hundred')?.addEventListener('click', ()=> createHundred());
  $('btn-clear')  ?.addEventListener('click', ()=>{ 
    pieceLayer.destroyChildren(); 
    pieceLayer.draw(); 
    updateStatus(); 
    resetSpawnBase(); 
  });
  $('btn-compose')?.addEventListener('click', ()=> checkBuildZones());
  $('btn-say')?.addEventListener('click', ()=>{
    const {units,tens,hundreds,total}=countAll(); 
    if(total===0) return; 
    hablarDescompYLetras(hundreds,tens,units,total,1100); 
  });
  $('btn-challenge')?.addEventListener('click', ()=>{
    if (modo!=='construccion') return; // el reto clásico solo en construcción
    challengeNumber=Math.floor(Math.random()*900)+1;
    const ch=$('challenge'); 
    if(ch) ch.textContent=`🎯 Forma el número: ${challengeNumber}`;
    speak(`Forma el número ${numEnLetras(challengeNumber)}`);
  });

  $('panel-toggle')?.addEventListener('click', ()=>{
    const panel=$('panel'); 
    const open=panel.classList.toggle('open'); 
    const btn=$('panel-toggle');
    btn.textContent=open?'⬇︎ Ocultar detalles':'⬆︎ Detalles'; 
    btn.setAttribute('aria-expanded', String(open)); 
    panel.setAttribute('aria-hidden', String(!open));
  });

  const bindZoom=(id,fn)=>{
    const el=$(id); 
    if(!el) return; 
    el.addEventListener('click', e=>{e.preventDefault(); fn();});
    el.addEventListener('pointerdown', e=>{e.preventDefault(); fn();});
  };
  bindZoom('btn-zoom-in',  ()=>zoomStep(+1));
  bindZoom('btn-zoom-out', ()=>zoomStep(-1));
  bindZoom('btn-reset-view', ()=>{
    world.scale=1;
    world.x = stage.width()/2  - WORLD_W/2;
    world.y = stage.height()/2 - WORLD_H/2;
    applyWorldTransform();
    if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); }
    else { computeZonesSumas(); drawZonesSumas(); }
    resetSpawnBase(); 
    updateStatus();
  });
}