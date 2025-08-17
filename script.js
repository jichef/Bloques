// ===== Bloques — script.js (v16.9.6: zonas ancladas al viewport + SPAWN visible sin solapes) =====
console.log("Bloques v16.9.6");

Konva.pixelRatio = 1;

const GRID = 32;
const COLORS = { unit: "#1f78ff", ten: "#ff3b30", hundred: "#2ecc71" };
const ZONE_STROKE = "#6c5ce7";
const ZONE_FILL   = "rgba(108,92,231,0.06)";
const CHIP_STYLE = {
  stroke:"#1a1a1a", strokeWidth:1, cornerRadius:6,
  shadowColor:"rgba(0,0,0,0.4)", shadowBlur:6, shadowOffsetX:3, shadowOffsetY:3, shadowOpacity:0.25
};

// Mundo “infinito” visual
const WORLD_COLS = 160, WORLD_ROWS = 120;
const WORLD_W = WORLD_COLS*GRID, WORLD_H = WORLD_ROWS*GRID;

// Zoom/pan
const SCALE_MIN = 0.4, SCALE_MAX = 3.0, SCALE_BY = 1.06;

// Stage + layers
const stage = new Konva.Stage({ container:"container", width:innerWidth, height:innerHeight });
const gridLayer  = new Konva.Layer({ listening:false });
const uiLayer    = new Konva.Layer({ listening:false });
const pieceLayer = new Konva.Layer();
stage.add(gridLayer, uiLayer, pieceLayer);

// Transform global
const world = { x:0, y:0, scale:1 };
function applyWorldTransform(){
  [gridLayer, uiLayer, pieceLayer].forEach(L=>{
    L.position({x:world.x, y:world.y});
    L.scale({x:world.scale, y:world.scale});
  });
  stage.batchDraw();
}

// Utils
const toCell = n => Math.round(n/GRID)*GRID;
const snap   = (x,y)=>({x:toCell(x), y:toCell(y)});
function speak(text){ try{ const u=new SpeechSynthesisUtterance(text); u.lang="es-ES"; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{} }
function screenToWorld(pt){ return { x:(pt.x-world.x)/world.scale, y:(pt.y-world.y)/world.scale }; }
function visibleWorldRect(){
  const tl = screenToWorld({x:0, y:0});
  const br = screenToWorld({x:stage.width(), y:stage.height()});
  return { x:tl.x, y:tl.y, w:br.x-tl.x, h:br.y-tl.y };
}
function zoomAt(pointer, targetScale){
  const old = world.scale;
  const s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, targetScale));
  const mouse = { x:(pointer.x-world.x)/old, y:(pointer.y-world.y)/old };
  world.scale = s;
  world.x = pointer.x - mouse.x*s;
  world.y = pointer.y - mouse.y*s;
  applyWorldTransform();
}
function zoomStep(dir){ zoomAt({x:stage.width()/2,y:stage.height()/2}, dir>0 ? world.scale*SCALE_BY : world.scale/SCALE_BY); }
function rectsIntersect(a,b){ return !(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y); }

// Grid
function drawGrid(){
  gridLayer.destroyChildren();
  gridLayer.add(new Konva.Rect({x:0,y:0,width:WORLD_W,height:WORLD_H,stroke:"#ddd",strokeWidth:2, listening:false}));
  for (let x=0; x<=WORLD_W; x+=GRID) gridLayer.add(new Konva.Line({points:[x+0.5,0,x+0.5,WORLD_H],stroke:"#e5e5e5",strokeWidth:1,listening:false}));
  for (let y=0; y<=WORLD_H; y+=GRID) gridLayer.add(new Konva.Line({points:[0,y+0.5,WORLD_W,y+0.5],stroke:"#e5e5e5",strokeWidth:1,listening:false}));
  gridLayer.draw();
}

// ===== Zonas ancladas al VIEWPORT (como tu captura) =====
let ZONES=null, zoneTenRect=null, zoneHundRect=null;
/*
   ┌── margenTop (T) y margenLeft (M) relativos al VIEWPORT
   Tens arriba, Hundreds debajo, alineados a la izquierda con un gap vertical.
*/
const VIEW_M = GRID*3;      // ~96px
const VIEW_T = GRID*3;      // ~96px
const GAP_V  = GRID*2;

function computeZonesAnchoredToViewport(){
  const v = visibleWorldRect();
  const tens = { w:10*GRID, h:GRID };
  const hund = { w:10*GRID, h:10*GRID };

  const tensX = toCell(v.x + VIEW_M);
  const tensY = toCell(v.y + VIEW_T);
  const hundX = tensX;
  const hundY = toCell(tensY + tens.h + GAP_V);

  ZONES = {
    tens: { x:tensX, y:tensY, w:tens.w, h:tens.h, label:"Zona Decenas (1×10)" },
    hund: { x:hundX, y:hundY, w:hund.w, h:hund.h, label:"Zona Centenas (10×10)" }
  };
}

function drawZones(){
  uiLayer.destroyChildren();
  const {tens, hund} = ZONES;
  zoneTenRect  = new Konva.Rect({ x:tens.x,y:tens.y,width:tens.w,height:tens.h, stroke:ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill:ZONE_FILL});
  const tenLbl = new Konva.Text({ x:tens.x+6, y:tens.y-22, text:tens.label, fontSize:16, fill:ZONE_STROKE});
  zoneHundRect = new Konva.Rect({ x:hund.x,y:hund.y,width:hund.w,height:hund.h, stroke:ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill:ZONE_FILL});
  const hunLbl = new Konva.Text({ x:hund.x+6, y:hund.y-22, text:hund.label, fontSize:16, fill:ZONE_STROKE});
  uiLayer.add(zoneTenRect, tenLbl, zoneHundRect, hunLbl);
  uiLayer.draw();
}

// ===== Helpers piezas =====
const childrenGroups = ()=> pieceLayer.getChildren(n => n.getClassName && n.getClassName()==='Group');
const pieceType = g => (g.name&&g.name()) || (g.getAttr&&g.getAttr('btype')) || '';
function typeSize(t){ return t==='unit'?{w:GRID,h:GRID}:t==='ten'?{w:10*GRID,h:GRID}:t==='hundred'?{w:10*GRID,h:10*GRID}:{w:GRID,h:GRID}; }
function boxForGroup(g){ const s=typeSize(pieceType(g)); return {x:toCell(g.x()), y:toCell(g.y()), w:s.w, h:s.h}; }
function overlapsAnyBox(box, skipId=null){
  const arr=childrenGroups();
  for (let i=0;i<arr.length;i++){ const g=arr[i]; if (skipId && g._id===skipId) continue; if (rectsIntersect(box, boxForGroup(g))) return true; }
  return false;
}

// ===== SPAWN dentro del área visible, sin solapes =====
const SPAWN = { baseX:0, baseY:0, curX:0, curY:0, rowH:GRID*2, band:{x:0,y:0,w:0,h:0} };

// Candidatos en orden: derecha → abajo → izquierda → fallback
function computeSpawnBandInView(){
  const v = visibleWorldRect();
  const H = ZONES.hund, pad=GRID, gap=GRID*3;

  const clampBand=(x,y,w,h)=>({
    x: toCell(Math.max(v.x+pad, Math.min(x, v.x+v.w-pad))),
    y: toCell(Math.max(v.y+pad, Math.min(y, v.y+v.h-pad))),
    w: Math.max(0, Math.min(w, v.x+v.w-pad - Math.max(v.x+pad, x))),
    h: Math.max(0, Math.min(h, v.y+v.h-pad - Math.max(v.y+pad, y))),
  });
  const ok=b=> b.w>=GRID*3 && b.h>=GRID*2;

  const right = clampBand(H.x+H.w+gap, H.y+pad, (v.x+v.w)- (H.x+H.w+gap) - pad, Math.min(H.h-2*pad, v.h-2*pad));
  if (ok(right)) return right;

  const below = clampBand(H.x, H.y+H.h+gap, Math.min(v.w-2*pad, H.w), (v.y+v.h)-(H.y+H.h+gap)-pad);
  if (ok(below)) return below;

  const left = clampBand(v.x+pad, H.y+pad, (H.x-gap) - (v.x+pad), Math.min(H.h-2*pad, v.h-2*pad));
  if (ok(left)) return left;

  // Fallback: arriba-derecha del viewport
  const fbW = Math.max(GRID*12, Math.min(v.w-2*pad, GRID*20));
  const fbH = Math.max(GRID*6,  Math.min(v.h-2*pad, GRID*10));
  return { x: toCell(v.x+v.w-fbW-pad), y: toCell(v.y+pad), w: fbW, h: fbH };
}

function resetSpawnBase(){
  SPAWN.band = computeSpawnBandInView();
  SPAWN.baseX = toCell(SPAWN.band.x);
  SPAWN.baseY = toCell(SPAWN.band.y);
  SPAWN.curX  = SPAWN.baseX;
  SPAWN.curY  = SPAWN.baseY;
  SPAWN.rowH  = GRID*2;
}

function advanceSpawn(w,h){
  const stepX = Math.max(GRID, w+GRID);
  SPAWN.curX += stepX;
  SPAWN.rowH = Math.max(SPAWN.rowH, h+GRID);

  const right = SPAWN.band.x + SPAWN.band.w;
  if (SPAWN.curX + w > right){
    SPAWN.curX = SPAWN.baseX;
    SPAWN.curY = toCell(SPAWN.curY + SPAWN.rowH);
    SPAWN.rowH = GRID*2;

    if (SPAWN.curY + h > SPAWN.band.y + SPAWN.band.h){
      SPAWN.curY = SPAWN.baseY;
    }
  }
}

function findSpawnRect(w,h){
  const attempts=300;
  for (let i=0;i<attempts;i++){
    const p = snap(SPAWN.curX, SPAWN.curY);
    const box = {x:p.x, y:p.y, w, h};
    if (!overlapsAnyBox(box)) return box;
    advanceSpawn(w,h);
  }
  // Ultimo recurso: esquina sup-dcha del viewport
  const v=visibleWorldRect();
  return { x:toCell(v.x+v.w-w-GRID), y:toCell(v.y+GRID), w, h };
}

// ===== Contador + voz =====
function getPieceGroups(){
  const res=[]; const arr=childrenGroups();
  for (let i=0;i<arr.length;i++){ const t=pieceType(arr[i]); if (t==='unit'||t==='ten'||t==='hundred') res.push(arr[i]); }
  return res;
}
function countAll(){
  const pcs=getPieceGroups(); let u=0,t=0,h=0;
  for (let i=0;i<pcs.length;i++){ const tp=pieceType(pcs[i]); if(tp==='unit')u++; else if(tp==='ten')t++; else if(tp==='hundred')h++; }
  return { units:u, tens:t, hundreds:h, total:u+10*t+100*h };
}
function numEnLetras(n){
  n = Math.floor(Number(n)||0); if(n===0) return 'cero';
  const U=['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
  const T=['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const C=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
  function _0_99(x){ if(x<30)return U[x]; const d=Math.floor(x/10),u=x%10; if(u===0)return T[d]; if(d===2)return 'veinti'+U[u]; return T[d]+' y '+U[u]; }
  function _0_999(x){ if(x===100)return 'cien'; const c=Math.floor(x/100),r=x%100; if(c===0)return _0_99(r); if(r===0)return C[c]; return C[c]+' '+_0_99(r); }
  if(n<1000) return _0_999(n);
  if(n<1_000_000){ const m=Math.floor(n/1000),r=n%1000; const mt=(m===1)?'mil':_0_999(m)+' mil'; return r===0?mt:mt+' '+_0_999(r); }
  return String(n);
}
function hablarDescompYLetras(h,t,u,total,pausa=1000){
  const parts=[]; if(h)parts.push(`${h} ${h===1?'centena':'centenas'}`); if(t)parts.push(`${t} ${t===1?'decena':'decenas'}`); if(u)parts.push(`${u} ${u===1?'unidad':'unidades'}`);
  const letras=numEnLetras(total);
  if(!parts.length){ speak(letras); return; }
  const descomp = parts.length===1?parts[0]:parts.length===2?parts.join(' y '):parts.slice(0,-1).join(', ')+' y '+parts.at(-1);
  try{
    speechSynthesis.cancel();
    const u1=new SpeechSynthesisUtterance(`Tienes ${descomp}`); u1.lang='es-ES';
    u1.onend=()=>setTimeout(()=>{ const u2=new SpeechSynthesisUtterance(letras); u2.lang='es-ES'; speechSynthesis.speak(u2); }, pausa);
    speechSynthesis.speak(u1);
  }catch{ speak(`Tienes ${descomp}`); setTimeout(()=>speak(letras), pausa); }
}

let challengeNumber=null;
function updateStatus(){
  const {units,tens,hundreds,total}=countAll();
  const enLetras=numEnLetras(total);
  const st=document.getElementById('status');
  if(st) st.textContent=`Total: ${total} — ${hundreds} centenas, ${tens} decenas, ${units} unidades — (${enLetras})`;
  const b=document.getElementById('breakdown');
  if(b){
    b.innerHTML = `
      <div class="label">Centenas</div><div class="value">${hundreds} × 100 = ${hundreds*100}</div>
      <div class="label">Decenas</div><div class="value">${tens} × 10 = ${tens*10}</div>
      <div class="label">Unidades</div><div class="value">${units} × 1 = ${units}</div>
      <div class="label">Total</div><div class="value">${total}</div>
      <div class="label">En letras</div><div class="value">${enLetras}</div>`;
  }
  if(challengeNumber!==null && total===challengeNumber){
    const ch=document.getElementById('challenge'); const msg=`🎉 ¡Correcto! Has formado ${enLetras}`;
    if(ch) ch.textContent=msg; speak(msg); challengeNumber=null;
  }
}

// ===== Reordenaciones/zonas de construcción =====
function centerInRectBox(b, z){ const cx=b.x+b.w/2, cy=b.y+b.h/2; return (cx>=z.x && cx<=z.x+z.w && cy>=z.y && cy<=z.y+z.h); }
function reorderTensZone(){
  if(!zoneTenRect) return;
  const z=ZONES.tens, units=[];
  const arr=childrenGroups();
  for (let i=0;i<arr.length;i++){ const g=arr[i]; if (pieceType(g)==='unit' && centerInRectBox(boxForGroup(g), ZONES.tens)) units.push(g); }
  units.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  for (let i=0;i<units.length;i++) units[i].position(snap(z.x + Math.min(i,9)*GRID, z.y));
  pieceLayer.batchDraw(); updateStatus();
}
function reorderHundredsZone(){
  if(!zoneHundRect) return;
  const z=ZONES.hund, tens=[], units=[];
  const arr=childrenGroups();
  for (let i=0;i<arr.length;i++){
    const g=arr[i], b=boxForGroup(g);
    if (!centerInRectBox(b, ZONES.hund)) continue;
    const t=pieceType(g); if(t==='ten') tens.push(g); else if(t==='unit') units.push(g);
  }
  tens.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  units.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  for (let i=0;i<tens.length;i++) tens[i].position(snap(z.x, z.y + i*GRID));
  const start=tens.length;
  for (let i=0;i<units.length;i++){ const row=start+Math.floor(i/10), col=i%10; units[i].position(snap(z.x+col*GRID, z.y+row*GRID)); }
  pieceLayer.batchDraw(); updateStatus();
}

// Eventos comunes
function onDragEnd(group){
  group.on('dragend', ()=>{
    group.position(snap(group.x(), group.y()));
    const type = pieceType(group);
    const b = boxForGroup(group);
    if (type==='unit' && rectsIntersect(b, ZONES.tens)) { group.position(snap(ZONES.tens.x, ZONES.tens.y)); reorderTensZone(); checkBuildZones(); }
    if ((type==='unit'||type==='ten') && rectsIntersect(b, ZONES.hund)) { group.position(snap(ZONES.hund.x, ZONES.hund.y)); reorderHundredsZone(); checkBuildZones(); }
    pieceLayer.draw(); updateStatus();
  });
}
function onDouble(group, cb){
  let lastTap=0,lastClick=0;
  group.on('dbltap', cb); group.on('dblclick', cb);
  group.on('pointerdown', ()=>{ const now=Date.now(); if(now-lastTap<300) cb(); lastTap=now; });
  group.on('click',       ()=>{ const now=Date.now(); if(now-lastClick<300) cb(); lastClick=now; });
}

// Crear piezas (usa SPAWN)
function addChipRectTo(g,w,h,fill){ g.add(new Konva.Rect({x:0,y:0,width:w,height:h,fill,...CHIP_STYLE})); }
function createUnit(x,y){
  const w=GRID,h=GRID;
  let pos = (x==null||y==null) ? snap(...Object.values(findSpawnRect(w,h))) : snap(x,y);
  if (x==null||y==null){ const r=findSpawnRect(w,h); pos={x:r.x,y:r.y}; advanceSpawn(w,h); }
  const g=new Konva.Group({ x:pos.x,y:pos.y, draggable:true, name:'unit' }); g.setAttr('btype','unit'); addChipRectTo(g,w,h,COLORS.unit);
  onDragEnd(g); pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}
function createTen(x,y){
  const w=10*GRID,h=GRID;
  let pos; if (x==null||y==null){ const r=findSpawnRect(w,h); pos={x:r.x,y:r.y}; advanceSpawn(w,h);} else pos=snap(x,y);
  const g=new Konva.Group({ x:pos.x,y:pos.y, draggable:true, name:'ten' }); g.setAttr('btype','ten'); addChipRectTo(g,w,h,COLORS.ten);
  onDragEnd(g); onDouble(g, ()=>{ const start=snap(g.x(),g.y()); g.destroy(); for(let k=0;k<10;k++) createUnit(start.x+k*GRID, start.y); pieceLayer.draw(); checkBuildZones(); updateStatus(); });
  pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}
function createHundred(x,y){
  const w=10*GRID,h=10*GRID;
  let pos; if (x==null||y==null){ const r=findSpawnRect(w,h); pos={x:r.x,y:r.y}; advanceSpawn(w,h);} else pos=snap(x,y);
  const g=new Konva.Group({ x:pos.x,y:pos.y, draggable:true, name:'hundred' }); g.setAttr('btype','hundred'); addChipRectTo(g,w,h,COLORS.hundred);
  onDragEnd(g); onDouble(g, ()=>{ const start=snap(g.x(),g.y()); g.destroy(); for(let row=0;row<10;row++) createTen(start.x, start.y+row*GRID); pieceLayer.draw(); checkBuildZones(); updateStatus(); });
  pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}

// Composición
function composeTensInZone(){
  if(!zoneTenRect) return false;
  let changed=false;
  const rows=new Map();
  const arr=childrenGroups();
  for (let i=0;i<arr.length;i++){
    const n=arr[i]; if (pieceType(n)!=='unit') continue;
    const b=boxForGroup(n); if (!centerInRectBox(b, ZONES.tens)) continue;
    const rowY=toCell(b.y); if(!rows.has(rowY)) rows.set(rowY, new Map());
    rows.get(rowY).set(toCell(b.x), n);
  }
  rows.forEach((mapX,rowY)=>{
    const xs=[...mapX.keys()].sort((a,b)=>a-b);
    for(let i=0;i<=xs.length-10;i++){
      let ok=true; for(let k=0;k<10;k++){ if(!mapX.has(xs[i]+k*GRID)){ ok=false; break; } }
      if(ok){ const nodes=[]; for(let k=0;k<10;k++) nodes.push(mapX.get(xs[i]+k*GRID)); nodes.forEach(n=>n.destroy()); createTen(xs[i],rowY); changed=true; }
    }
  });
  if(!changed){
    const pool=[]; for (let i=0;i<arr.length;i++){ const n=arr[i]; if(pieceType(n)!=='unit') continue; if(centerInRectBox(boxForGroup(n), ZONES.tens)) pool.push(n); }
    if(pool.length>=10){ const a=snap(pool[0].x(),pool[0].y()); for(let i=0;i<10;i++) pool[i].destroy(); createTen(a.x,a.y); changed=true; }
  }
  if(changed){ reorderTensZone(); pieceLayer.draw(); }
  return changed;
}
function composeHundredsInZone(){
  if(!zoneHundRect) return false;
  let changed=false;
  while(true){
    const units=[]; const arr=childrenGroups();
    for(let i=0;i<arr.length;i++){ const n=arr[i]; if(pieceType(n)!=='unit') continue; if(centerInRectBox(boxForGroup(n), ZONES.hund)) units.push(n); }
    if(units.length<10) break;
    const a=snap(units[0].x(), units[0].y()); for(let i=0;i<10;i++) units[i].destroy(); createTen(a.x,a.y); changed=true;
  }
  while(true){
    const tens=[]; const arr=childrenGroups();
    for(let i=0;i<arr.length;i++){ const n=arr[i]; if(pieceType(n)!=='ten') continue; if(centerInRectBox(boxForGroup(n), ZONES.hund)) tens.push(n); }
    if(tens.length<10) break;
    const a=snap(tens[0].x(), tens[0].y()); for(let i=0;i<10;i++) tens[i].destroy(); createHundred(a.x,a.y); changed=true;
  }
  if(changed){ reorderHundredsZone(); pieceLayer.draw(); }
  return changed;
}
function checkBuildZones(){
  let changed; do{ changed=false; if(composeTensInZone()) changed=true; if(composeHundredsInZone()) changed=true; }while(changed);
  reorderTensZone(); reorderHundredsZone(); updateStatus();
}

// Botonera
function wireUI(){
  const $=id=>document.getElementById(id);
  $('#btn-unit')   ?.addEventListener('click', ()=> createUnit());
  $('#btn-ten')    ?.addEventListener('click', ()=> createTen());
  $('#btn-hundred')?.addEventListener('click', ()=> createHundred());
  $('#btn-clear')  ?.addEventListener('click', ()=>{ pieceLayer.destroyChildren(); pieceLayer.draw(); updateStatus(); resetSpawnBase(); });
  $('#btn-compose')?.addEventListener('click', ()=> checkBuildZones());
  $('#btn-say')?.addEventListener('click', ()=>{ const {units,tens,hundreds,total}=countAll(); if(total===0) return; hablarDescompYLetras(hundreds,tens,units,total,1100); });
  $('#btn-challenge')?.addEventListener('click', ()=>{
    challengeNumber=Math.floor(Math.random()*900)+1;
    const ch=document.getElementById('challenge'); if(ch) ch.textContent=`🎯 Forma el número: ${challengeNumber}`;
    speak(`Forma el número ${numEnLetras(challengeNumber)}`);
  });
  $('#panel-toggle')?.addEventListener('click', ()=>{
    const panel=$('#panel'); const open=panel.classList.toggle('open'); const btn=$('#panel-toggle');
    btn.textContent=open?'⬇︎ Ocultar detalles':'⬆︎ Detalles'; btn.setAttribute('aria-expanded', String(open)); panel.setAttribute('aria-hidden', String(!open));
  });
  const bindZoom=(id,fn)=>{ const el=$(id); if(!el) return; el.addEventListener('click',e=>{e.preventDefault();fn();}); el.addEventListener('pointerdown',e=>{e.preventDefault();fn();}); };
  bindZoom('btn-zoom-in', ()=>zoomStep(+1));
  bindZoom('btn-zoom-out',()=>zoomStep(-1));
  bindZoom('btn-reset-view', ()=>{
    world.scale=1;
    // centra el mundo, pero recoloca zonas en viewport (es lo que queremos)
    world.x = stage.width()/2  - WORLD_W/2;
    world.y = stage.height()/2 - WORLD_H/2;
    applyWorldTransform();
    computeZonesAnchoredToViewport(); drawZones(); resetSpawnBase();
  });
}

// Pan & zoom
let isPanning=false, lastPointerPos=null;
stage.on('mousedown touchstart', (e)=>{ if(e.target && e.target.getLayer && e.target.getLayer()===pieceLayer) return; isPanning=true; lastPointerPos=stage.getPointerPosition(); });
stage.on('mousemove touchmove', ()=>{
  if(!isPanning) return; const pos=stage.getPointerPosition(); if(!pos||!lastPointerPos) return;
  const dx=pos.x-lastPointerPos.x, dy=pos.y-lastPointerPos.y; world.x+=dx; world.y+=dy; applyWorldTransform(); lastPointerPos=pos;
  // al mover el lienzo, reancla zonas y banda SPAWN al viewport actual
  computeZonesAnchoredToViewport(); drawZones(); resetSpawnBase();
});
stage.on('mouseup touchend', ()=>{ isPanning=false; lastPointerPos=null; });
stage.on('wheel', (e)=>{
  e.evt.preventDefault();
  const old=world.scale, p=stage.getPointerPosition(), m={x:(p.x-world.x)/old,y:(p.y-world.y)/old};
  let s=e.evt.deltaY>0?old/SCALE_BY:old*SCALE_BY; s=Math.max(SCALE_MIN,Math.min(SCALE_MAX,s));
  world.scale=s; world.x=p.x-m.x*s; world.y=p.y-m.y*s; applyWorldTransform();
  computeZonesAnchoredToViewport(); drawZones(); resetSpawnBase();
});
stage.on('dblclick dbltap', ()=>{
  const p=stage.getPointerPosition(), old=world.scale, m={x:(p.x-world.x)/old,y:(p.y-world.y)/old};
  let s=Math.min(SCALE_MAX, old*1.25); world.scale=s; world.x=p.x-m.x*s; world.y=p.y-m.y*s; applyWorldTransform();
  computeZonesAnchoredToViewport(); drawZones(); resetSpawnBase();
});

// Intro (fade + zoom suave)
function startIntro(){
  // coloca zonas ya en viewport
  computeZonesAnchoredToViewport(); drawZones();
  resetSpawnBase();

  [gridLayer, uiLayer, pieceLayer].forEach(L=>{ L.opacity(0); L.to({opacity:1,duration:0.5,easing:Konva.Easings.EaseInOut}); });

  const start=1.4, end=1.0, steps=28, dur=0.8, dt=dur/steps;
  world.scale=start;
  world.x = stage.width()/2  - WORLD_W/2 * world.scale;
  world.y = stage.height()/2 - WORLD_H/2 * world.scale;
  applyWorldTransform();

  let i=0; const timer=setInterval(()=>{
    i++; const t=i/steps, s=start + (end-start)*t;
    zoomAt({x:stage.width()/2,y:stage.height()/2}, s);
    if(i>=steps){ clearInterval(timer); computeZonesAnchoredToViewport(); drawZones(); resetSpawnBase(); }
  }, dt*1000);
}

// Resize & boot
function relayout(){
  stage.width(innerWidth); stage.height(innerHeight);
  drawGrid();
  computeZonesAnchoredToViewport(); drawZones();
  applyWorldTransform();
  resetSpawnBase();
  pieceLayer.draw();
  updateStatus();
}
addEventListener('resize', relayout);

// Boot
drawGrid();
computeZonesAnchoredToViewport();
drawZones();
applyWorldTransform();
resetSpawnBase();
wireUI();
updateStatus();
pieceLayer.draw();
startIntro();