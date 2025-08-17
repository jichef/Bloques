// ===== Bloques — script.js (v16.9.3: SPAWN sin solapes + zonas centradas en mundo + intro) =====
console.log("Bloques v16.9.3");

const GRID = 32;
Konva.pixelRatio = 1;

const COLORS = { unit: "#1f78ff", ten: "#ff3b30", hundred: "#2ecc71" };
const ZONE_STROKE = "#6c5ce7";
const ZONE_FILL   = "rgba(108,92,231,0.06)";

const CHIP_STYLE = {
  stroke: "#1a1a1a",
  strokeWidth: 1,
  cornerRadius: 6,
  shadowColor: "rgba(0,0,0,0.4)",
  shadowBlur: 6,
  shadowOffsetX: 3,
  shadowOffsetY: 3,
  shadowOpacity: 0.25
};

// ===== Mundo grande =====
const WORLD_COLS = 160;
const WORLD_ROWS = 120;
const WORLD_W = WORLD_COLS * GRID;
const WORLD_H = WORLD_ROWS * GRID;

// ===== Zoom limits =====
const SCALE_MIN = 0.4, SCALE_MAX = 3.0, SCALE_BY = 1.06;

// ----- Stage y Layers -----
const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});
const gridLayer  = new Konva.Layer({ listening: false, opacity: 0 });
const uiLayer    = new Konva.Layer({ listening: false, opacity: 0 });
const pieceLayer = new Konva.Layer({ opacity: 0 });
stage.add(gridLayer, uiLayer, pieceLayer);

// Transformación global
const world = { x: 0, y: 0, scale: 1 };
function applyWorldTransform() {
  [gridLayer, uiLayer, pieceLayer].forEach(L => {
    L.position({ x: world.x, y: world.y });
    L.scale({ x: world.scale, y: world.scale });
  });
  stage.batchDraw();
}

// === Utilidades espacio mundo/viewport
const worldCenter = ()=>({ x: WORLD_W/2, y: WORLD_H/2 });
function screenToWorld(pt){ return { x:(pt.x-world.x)/world.scale, y:(pt.y-world.y)/world.scale }; }
function visibleWorldRect(){
  const tl = screenToWorld({ x: 0, y: 0 });
  const br = screenToWorld({ x: stage.width(), y: stage.height() });
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}
function clampToVisible(x, y, w, h){
  const r = visibleWorldRect();
  const CX = Math.min(Math.max(x, r.x), r.x + r.w - w);
  const CY = Math.min(Math.max(y, r.y), r.y + r.h - h);
  return snap(CX, CY);
}
function zoomAt(pointer, targetScale){
  const old = world.scale;
  const s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, targetScale));
  const mouse = { x: (pointer.x - world.x) / old, y: (pointer.y - world.y) / old };
  world.scale = s;
  world.x = pointer.x - mouse.x * s;
  world.y = pointer.y - mouse.y * s;
  applyWorldTransform();
}
function zoomStep(direction){
  const factor = direction > 0 ? SCALE_BY : 1 / SCALE_BY;
  const target = world.scale * factor;
  zoomAt({ x: stage.width()/2, y: stage.height()/2 }, target);
}

// ----- Cuadrícula -----
function drawGrid() {
  gridLayer.destroyChildren();
  gridLayer.add(new Konva.Rect({ x: 0, y: 0, width: WORLD_W, height: WORLD_H, stroke: "#dddddd", strokeWidth: 2, listening: false }));
  for (let x = 0; x <= WORLD_W; x += GRID) gridLayer.add(new Konva.Line({ points:[x+0.5,0,x+0.5,WORLD_H], stroke:"#e5e5e5", strokeWidth:1, listening:false }));
  for (let y = 0; y <= WORLD_H; y += GRID) gridLayer.add(new Konva.Line({ points:[0,y+0.5,WORLD_W,y+0.5], stroke:"#e5e5e5", strokeWidth:1, listening:false }));
  gridLayer.draw();
}

// ----- Utils -----
const toCell = n => Math.round(n / GRID) * GRID;
const snap   = (x,y)=>({x:toCell(x), y:toCell(y)});
function speak(text){
  try{ const u=new SpeechSynthesisUtterance(text); u.lang="es-ES"; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch{}
}
function rectsIntersect(a,b){ return !(a.x+a.w<=b.x || a.x>=b.x+b.w || a.y+a.h<=b.y || a.y>=b.y+b.h); }

// ----- Zonas 1×10 y 10×10 (centradas en el mundo) -----
let ZONES = null;
let zoneTenRect = null;
let zoneHundRect = null;

function computeZonesCenteredWorld() {
  const wc = worldCenter();
  const tensSize = { w: 10*GRID, h: 1*GRID };
  const hundSize = { w: 10*GRID, h:10*GRID };
  const gap = 2*GRID;

  const tens = {
    x: toCell(wc.x - tensSize.w/2),
    y: toCell(wc.y - (hundSize.h + gap + tensSize.h)/2),
    w: tensSize.w, h: tensSize.h, label: "Zona Decenas (1×10)"
  };
  const hund = {
    x: toCell(wc.x - hundSize.w/2),
    y: toCell(tens.y + tens.h + gap),
    w: hundSize.w, h: hundSize.h, label: "Zona Centenas (10×10)"
  };
  ZONES = { tens, hund };
}
function drawZones() {
  uiLayer.destroyChildren();
  const { tens, hund } = ZONES;
  zoneTenRect  = new Konva.Rect({ x:tens.x, y:tens.y, width:tens.w, height:tens.h, stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL, listening:false });
  const tenLbl = new Konva.Text({ x:tens.x+6, y:tens.y-22, text:tens.label, fontSize:16, fill: ZONE_STROKE, listening:false });
  zoneHundRect = new Konva.Rect({ x:hund.x, y:hund.y, width:hund.w, height:hund.h, stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL, listening:false });
  const hundLbl= new Konva.Text({ x:hund.x+6, y:hund.y-22, text:hund.label, fontSize:16, fill: ZONE_STROKE, listening:false });
  uiLayer.add(zoneTenRect, tenLbl, zoneHundRect, hundLbl);
  uiLayer.draw();
}

// ----- Helpers de piezas -----
const childrenGroups = ()=> pieceLayer.getChildren(n => n.getClassName && n.getClassName() === 'Group');
const pieceType = (g)=> (g.name && g.name()) || (g.getAttr && g.getAttr('btype')) || '';
function typeSize(t){
  if (t==='unit') return { w: GRID, h: GRID };
  if (t==='ten')  return { w: 10*GRID, h: GRID };
  if (t==='hundred') return { w: 10*GRID, h: 10*GRID };
  return { w: GRID, h: GRID };
}
function boxForGroup(g){
  const t = pieceType(g);
  const s = typeSize(t);
  return { x: toCell(g.x()), y: toCell(g.y()), w: s.w, h: s.h };
}
function overlapsAnyBox(box, skipId=null){
  const groups = childrenGroups();
  for (let i=0; i<groups.length; i++){
    const g = groups[i];
    if (skipId && g._id === skipId) continue;
    if (rectsIntersect(box, boxForGroup(g))) return true;
  }
  return false;
}

// ===== SPAWN: cursor de aparición sin solapes =====
// ===== SPAWN: cursor de aparición priorizando el área visible =====
const SPAWN = {
  baseX: 0, baseY: 0,
  curX: 0, curY: 0,
  rowH: GRID*2,
  band: { x: 0, y: 0, w: 0, h: 0 },  // banda de aparición activa
  maxWidth: GRID * 36,                // límite de fallback cuando no usamos banda visible
};

// Calcula una banda de aparición dentro del viewport, intentando:
// 1) a la derecha de la 10×10, dentro de lo visible
// 2) si no hay hueco, a la izquierda de la 10×10, dentro de lo visible
// 3) si tampoco cabe, usa un fallback pequeño arriba a la derecha del viewport
function computeSpawnBandInView(){
  const v = visibleWorldRect();
  const rightGap = 3*GRID;
  const leftGap  = 3*GRID;

  // Zona a la derecha de la 10×10, recortada al viewport
  const rightBand = {
    x: Math.max(ZONES.hund.x + ZONES.hund.w + rightGap, v.x + GRID),
    y: Math.max(ZONES.hund.y + GRID, v.y + GRID),
    w: (v.x + v.w) - Math.max(ZONES.hund.x + ZONES.hund.w + rightGap, v.x + GRID) - GRID,
    h: Math.min(ZONES.hund.h - 2*GRID, v.h - 2*GRID)
  };

  // Zona a la izquierda de la 10×10, recortada al viewport
  const leftBand = {
    x: Math.max(v.x + GRID, v.x + GRID), // inicio del viewport
    y: Math.max(ZONES.hund.y + GRID, v.y + GRID),
    w: Math.min(ZONES.hund.x - leftGap - (v.x + GRID), v.w - 2*GRID),
    h: Math.min(ZONES.hund.h - 2*GRID, v.h - 2*GRID)
  };

  // ¿Tiene ancho y alto razonables?
  const ok = b => (b.w >= GRID*3) && (b.h >= GRID*2);

  if (ok(rightBand)) return rightBand;
  if (ok(leftBand))  return leftBand;

  // Fallback: banda pequeña arriba-derecha del viewport
  const fbW = Math.max(GRID*12, Math.min(v.w - 2*GRID, GRID*20));
  const fbH = Math.max(GRID*6,  Math.min(v.h - 2*GRID, GRID*10));
  return {
    x: toCell(v.x + v.w - fbW - GRID),
    y: toCell(v.y + GRID),
    w: fbW, h: fbH
  };
}

// Sitúa el cursor al inicio de la banda activa
function resetSpawnBase(){
  SPAWN.band = computeSpawnBandInView();
  SPAWN.baseX = toCell(SPAWN.band.x);
  SPAWN.baseY = toCell(SPAWN.band.y);
  SPAWN.curX  = SPAWN.baseX;
  SPAWN.curY  = SPAWN.baseY;
  SPAWN.rowH  = GRID*2;
}

// Avanza el cursor dentro de la banda; si llega al borde, baja de fila.
// Si se llena la banda visible, saltará de vuelta a la base (seguirá probando filas).
function advanceSpawn(w, h){
  const stepX = Math.max(GRID, w + GRID);
  SPAWN.curX += stepX;
  SPAWN.rowH = Math.max(SPAWN.rowH, h + GRID);

  const bandRight = SPAWN.band.x + SPAWN.band.w;
  if (SPAWN.curX + w > bandRight){
    SPAWN.curX = SPAWN.baseX;
    SPAWN.curY = toCell(SPAWN.curY + SPAWN.rowH);
    SPAWN.rowH = GRID*2;

    // Si nos salimos por abajo de la banda, reinicia a la parte superior de la banda
    if (SPAWN.curY + h > SPAWN.band.y + SPAWN.band.h){
      SPAWN.curY = SPAWN.baseY;
    }
  }
}

// Busca hueco en la banda visible; si no lo encuentra tras varios intentos, cae al fallback de borde derecho
function findSpawnRect(w, h){
  const attempts = 300;
  for (let i=0; i<attempts; i++){
    const pos = snap(SPAWN.curX, SPAWN.curY);
    const box = { x: pos.x, y: pos.y, w, h };
    if (!overlapsAnyBox(box)) return box;
    advanceSpawn(w, h);
  }
  // Fallback: extremo derecho del viewport actual
  const v = visibleWorldRect();
  return {
    x: toCell(v.x + v.w - w - GRID),
    y: toCell(v.y + GRID),
    w, h
  };
}

// ----- Contador + descomposición -----
function getPieceGroups(){
  const out = [];
  const groups = childrenGroups();
  for (let i = 0; i < groups.length; i++){
    const g = groups[i];
    const t = pieceType(g);
    if (t === 'unit' || t === 'ten' || t === 'hundred') out.push(g);
  }
  return out;
}
function countAll(){
  const pieces = getPieceGroups();
  let units = 0, tens = 0, hundreds = 0;
  for (let i=0; i<pieces.length; i++){
    const t = pieceType(pieces[i]);
    if (t==='unit') units++;
    else if (t==='ten') tens++;
    else if (t==='hundred') hundreds++;
  }
  return { units, tens, hundreds, total: units + 10*tens + 100*hundreds };
}

// === Conversor ES (0..999999) ===
function numEnLetras(n){
  n = Math.floor(Number(n) || 0);
  if (n === 0) return 'cero';
  const U=['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
  const T=['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const C=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
  function _0_99(x){ if(x<30)return U[x]; const d=Math.floor(x/10),u=x%10; if(u===0)return T[d]; if(d===2)return 'veinti'+U[u]; return T[d]+' y '+U[u]; }
  function _0_999(x){ if(x===100)return 'cien'; const c=Math.floor(x/100),r=x%100; if(c===0)return _0_99(r); if(r===0)return C[c]; return C[c]+' '+_0_99(r); }
  if (n<1000) return _0_999(n);
  if (n<1_000_000){ const miles=Math.floor(n/1000),r=n%1000; const m=(miles===1)?'mil':_0_999(miles)+' mil'; return r===0?m:m+' '+_0_999(r); }
  return String(n);
}

// ---- Voz en 2 pasos ----
function hablarDescompYLetras(h,t,u,total,pausaMs=1000){
  const partes=[]; if(h>0)partes.push(`${h} ${h===1?'centena':'centenas'}`); if(t>0)partes.push(`${t} ${t===1?'decena':'decenas'}`); if(u>0)partes.push(`${u} ${u===1?'unidad':'unidades'}`);
  const letras=numEnLetras(total);
  if (partes.length===0){ speak(letras); return; }
  let descomp = partes.length===1 ? partes[0] : (partes.length===2 ? partes.join(' y ') : partes.slice(0,-1).join(', ')+' y '+partes.slice(-1));
  try{
    speechSynthesis.cancel();
    const u1=new SpeechSynthesisUtterance(`Tienes ${descomp}`); u1.lang='es-ES';
    u1.onend=()=>{ setTimeout(()=>{ const u2=new SpeechSynthesisUtterance(letras); u2.lang='es-ES'; speechSynthesis.speak(u2); }, pausaMs); };
    speechSynthesis.speak(u1);
  }catch{ speak(`Tienes ${descomp}`); setTimeout(()=>speak(letras), pausaMs); }
}

let challengeNumber = null;

function updateStatus(){
  const { units, tens, hundreds, total } = countAll();
  const enLetras = numEnLetras(total);

  const st=document.getElementById("status");
  if (st) st.textContent = `Total: ${total} — ${hundreds} centenas, ${tens} decenas, ${units} unidades — (${enLetras})`;

  const b=document.getElementById("breakdown");
  if (b){
    b.innerHTML = `
      <div class="label">Centenas</div><div class="value">${hundreds} × 100 = ${hundreds*100}</div>
      <div class="label">Decenas</div><div class="value">${tens} × 10 = ${tens*10}</div>
      <div class="label">Unidades</div><div class="value">${units} × 1 = ${units}</div>
      <div class="label">Total</div><div class="value">${total}</div>
      <div class="label">En letras</div><div class="value">${enLetras}</div>`;
  }

  if (challengeNumber !== null && total === challengeNumber) {
    const ch = document.getElementById('challenge');
    const msg = `🎉 ¡Correcto! Has formado ${enLetras}`;
    if (ch) ch.textContent = msg;
    speak(msg);
    challengeNumber = null;
  }
}

// ======= AUTO-ORDENACIÓN =======
function centerInZone(node, zoneRect){
  const b = boxForGroup(node);
  const z = { x: zoneRect.x(), y: zoneRect.y(), w: zoneRect.width(), h: zoneRect.height() };
  const cx = b.x + b.w/2, cy = b.y + b.h/2;
  return (cx >= z.x && cx <= z.x+z.w && cy >= z.y && cy <= z.y+z.h);
}
function reorderTensZone(){
  if (!zoneTenRect) return;
  const z = ZONES.tens;
  const units = [];
  const groups = childrenGroups();
  for (let i=0; i<groups.length; i++){
    const g = groups[i];
    if (pieceType(g)==='unit' && centerInZone(g, zoneTenRect)) units.push(g);
  }
  units.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  for (let i=0; i<units.length; i++) units[i].position(snap(z.x + Math.min(i,9)*GRID, z.y));
  pieceLayer.batchDraw();
  updateStatus();
}
function reorderHundredsZone(){
  if (!zoneHundRect) return;
  const z = ZONES.hund;
  const tens=[], units=[];
  const groups = childrenGroups();
  for (let i=0; i<groups.length; i++){
    const g = groups[i];
    if (!centerInZone(g, zoneHundRect)) continue;
    const t = pieceType(g);
    if (t==='ten') tens.push(g); else if (t==='unit') units.push(g);
  }
  tens.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  units.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  for (let i=0; i<tens.length; i++) tens[i].position(snap(z.x, z.y + i*GRID));
  const startRow=tens.length;
  for (let i=0; i<units.length; i++){
    const row=startRow+Math.floor(i/10), col=i%10;
    units[i].position(snap(z.x+col*GRID, z.y+row*GRID));
  }
  pieceLayer.batchDraw();
  updateStatus();
}

// ----- Eventos comunes -----
function onDragEnd(group){
  group.on("dragend", ()=>{
    group.position(snap(group.x(), group.y()));
    const type = pieceType(group);
    const inTens = rectsIntersect(boxForGroup(group), {x:ZONES.tens.x,y:ZONES.tens.y,w:ZONES.tens.w,h:ZONES.tens.h});
    const inHund = rectsIntersect(boxForGroup(group), {x:ZONES.hund.x,y:ZONES.hund.y,w:ZONES.hund.w,h:ZONES.hund.h});
    if (zoneTenRect && type==='unit' && inTens) { group.position(snap(ZONES.tens.x, ZONES.tens.y)); reorderTensZone(); checkBuildZones(); }
    if (zoneHundRect && (type==='unit' || type==='ten') && inHund) { group.position(snap(ZONES.hund.x, ZONES.hund.y)); reorderHundredsZone(); checkBuildZones(); }
    pieceLayer.draw();
    updateStatus();
  });
}
function onDouble(group, cb){
  let lastTap=0, lastClick=0;
  group.on('dbltap', cb); group.on('dblclick', cb);
  group.on('pointerdown', ()=>{ const now=Date.now(); if(now-lastTap<300) cb(); lastTap=now; });
  group.on('click',       ()=>{ const now=Date.now(); if(now-lastClick<300) cb(); lastClick=now; });
}

// ----- Creación de piezas (usa SPAWN sin solape) -----
function addChipRectTo(group, w, h, fill){
  const rect = new Konva.Rect({ x:0, y:0, width:w, height:h, fill, ...CHIP_STYLE });
  group.add(rect);
  return rect;
}
function createUnit(x,y){
  const w=GRID, h=GRID;
  let pos;
  if (x==null||y==null){
    const box = findSpawnRect(w,h);
    pos = { x: box.x, y: box.y };
    advanceSpawn(w,h);
  } else {
    pos = snap(x,y);
  }
  const g=new Konva.Group({ x:pos.x, y:pos.y, draggable:true, name:'unit' });
  g.setAttr('btype','unit'); addChipRectTo(g, w, h, COLORS.unit); onDragEnd(g);
  pieceLayer.add(g); pieceLayer.draw();
  checkBuildZones(); updateStatus(); return g;
}
function createTen(x,y){
  const w=10*GRID, h=GRID;
  let pos;
  if (x==null||y==null){
    const box = findSpawnRect(w,h);
    pos = { x: box.x, y: box.y };
    advanceSpawn(w,h);
  } else {
    pos = snap(x,y);
  }
  const g=new Konva.Group({ x:pos.x, y:pos.y, draggable:true, name:'ten' });
  g.setAttr('btype','ten'); addChipRectTo(g, w, h, COLORS.ten); onDragEnd(g);
  onDouble(g, ()=>{ const start=snap(g.x(), g.y()); g.destroy(); for(let k=0;k<10;k++) createUnit(start.x + k*GRID, start.y); pieceLayer.draw(); checkBuildZones(); updateStatus(); });
  pieceLayer.add(g); pieceLayer.draw();
  checkBuildZones(); updateStatus(); return g;
}
function createHundred(x,y){
  const w=10*GRID, h=10*GRID;
  let pos;
  if (x==null||y==null){
    const box = findSpawnRect(w,h);
    pos = { x: box.x, y: box.y };
    advanceSpawn(w,h);
  } else {
    pos = snap(x,y);
  }
  const g=new Konva.Group({ x:pos.x, y:pos.y, draggable:true, name:'hundred' });
  g.setAttr('btype','hundred'); addChipRectTo(g, w, h, COLORS.hundred); onDragEnd(g);
  onDouble(g, ()=>{ const start=snap(g.x(), g.y()); g.destroy(); for(let row=0; row<10; row++) createTen(start.x, start.y + row*GRID); pieceLayer.draw(); checkBuildZones(); updateStatus(); });
  pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}

// ----- Composición en zonas -----
function composeTensInZone() {
  if (!zoneTenRect) return false;
  let changed = false;
  const rows = new Map();
  const groups = childrenGroups();
  for (let i=0; i<groups.length; i++){
    const n = groups[i];
    if (pieceType(n)!=='unit') continue;
    const b = boxForGroup(n);
    const z = {x:ZONES.tens.x,y:ZONES.tens.y,w:ZONES.tens.w,h:ZONES.tens.h};
    const cx = b.x + b.w/2, cy = b.y + b.h/2;
    if (!(cx>=z.x && cx<=z.x+z.w && cy>=z.y && cy<=z.y+z.h)) continue;
    const rowY = toCell(b.y);
    if (!rows.has(rowY)) rows.set(rowY, new Map());
    rows.get(rowY).set(toCell(b.x), n);
  }
  rows.forEach((mapX, rowY)=>{
    const xs = Array.from(mapX.keys()).sort((a,b)=>a-b);
    for (let i=0; i<=xs.length-10; i++){
      let ok=true; for (let k=0;k<10;k++){ if (!mapX.has(xs[i]+k*GRID)) { ok=false; break; } }
      if (ok){
        const nodes=[]; for (let k=0;k<10;k++) nodes.push(mapX.get(xs[i]+k*GRID));
        for (const n of nodes) n.destroy();
        createTen(xs[i], rowY);
        changed = true;
      }
    }
  });
  if (!changed) {
    const pool=[];
    for (let i=0; i<groups.length; i++){
      const n = groups[i];
      if (pieceType(n)!=='unit') continue;
      const b = boxForGroup(n);
      const z = {x:ZONES.tens.x,y:ZONES.tens.y,w:ZONES.tens.w,h:ZONES.tens.h};
      const cx = b.x + b.w/2, cy = b.y + b.h/2;
      if (cx>=z.x && cx<=z.x+z.w && cy>=z.y && cy<=z.y+z.h) pool.push(n);
    }
    if (pool.length>=10){
      const anchor=snap(pool[0].x(), pool[0].y());
      for (let i=0;i<10;i++) pool[i].destroy();
      createTen(anchor.x, anchor.y);
      changed = true;
    }
  }
  if (changed) { reorderTensZone(); pieceLayer.draw(); }
  return changed;
}
function composeHundredsInZone() {
  if (!zoneHundRect) return false;
  let changed = false;
  while (true) {
    const units=[];
    const groups = childrenGroups();
    for (let i=0; i<groups.length; i++){
      const n = groups[i];
      if (pieceType(n)!=='unit') continue;
      const b = boxForGroup(n);
      const z = {x:ZONES.hund.x,y:ZONES.hund.y,w:ZONES.hund.w,h:ZONES.hund.h};
      const cx = b.x + b.w/2, cy = b.y + b.h/2;
      if (cx>=z.x && cx<=z.x+z.w && cy>=z.y && cy<=z.y+z.h) units.push(n);
    }
    if (units.length < 10) break;
    const anchor = snap(units[0].x(), units[0].y());
    for (let i=0;i<10;i++) units[i].destroy();
    createTen(anchor.x, anchor.y);
    changed = true;
  }
  while (true) {
    const tens=[];
    const groups = childrenGroups();
    for (let i=0; i<groups.length; i++){
      const n = groups[i];
      if (pieceType(n)!=='ten') continue;
      const b = boxForGroup(n);
      const z = {x:ZONES.hund.x,y:ZONES.hund.y,w:ZONES.hund.w,h:ZONES.hund.h};
      const cx = b.x + b.w/2, cy = b.y + b.h/2;
      if (cx>=z.x && cx<=z.x+z.w && cy>=z.y && cy<=z.y+z.h) tens.push(n);
    }
    if (tens.length < 10) break;
    const anchor = snap(tens[0].x(), tens[0].y());
    for (let i=0;i<10;i++) tens[i].destroy();
    createHundred(anchor.x, anchor.y);
    changed = true;
  }
  if (changed) { reorderHundredsZone(); pieceLayer.draw(); }
  return changed;
}
function checkBuildZones() {
  let changed;
  do { changed = false;
    if (composeTensInZone())     changed = true;
    if (composeHundredsInZone()) changed = true;
  } while (changed);
  reorderTensZone();
  reorderHundredsZone();
  updateStatus();
}

// ----- Botonera -----
function wireUI(){
  const $ = id => document.getElementById(id);

  $('btn-unit')   ?.addEventListener('click', ()=>{ createUnit(); });
  $('btn-ten')    ?.addEventListener('click', ()=>{ createTen(); });
  $('btn-hundred')?.addEventListener('click', ()=>{ createHundred(); });
  $('btn-clear')  ?.addEventListener('click', ()=>{ pieceLayer.destroyChildren(); pieceLayer.draw(); updateStatus(); resetSpawnBase(); });
  $('btn-compose')?.addEventListener('click', ()=>{ checkBuildZones(); });

  $('btn-say')?.addEventListener('click', ()=>{
    const {units,tens,hundreds,total}=countAll();
    if (total === 0) return;
    hablarDescompYLetras(hundreds, tens, units, total, 1100);
  });

  $('btn-challenge')?.addEventListener('click', ()=>{
    challengeNumber = Math.floor(Math.random()*900)+1;
    const ch=document.getElementById('challenge');
    if (ch) ch.textContent = `🎯 Forma el número: ${challengeNumber}`;
    speak(`Forma el número ${numEnLetras(challengeNumber)}`);
  });

  $('panel-toggle')?.addEventListener('click', ()=>{
    const panel=$('panel');
    const open=panel.classList.toggle('open');
    const btn=$('panel-toggle');
    btn.textContent = open ? '⬇︎ Ocultar detalles' : '⬆︎ Detalles';
    btn.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
  });

  const bindZoom=(id,fn)=>{ const el=$(id); if(!el) return; el.addEventListener('click',e=>{e.preventDefault();fn();}); el.addEventListener('pointerdown',e=>{e.preventDefault();fn();}); };
  bindZoom('btn-zoom-in',  ()=> zoomStep(+1));
  bindZoom('btn-zoom-out', ()=> zoomStep(-1));
  bindZoom('btn-reset-view', ()=>{
    world.scale=1;
    const wc = worldCenter();
    world.x = stage.width()/2  - wc.x;
    world.y = stage.height()/2 - wc.y;
    applyWorldTransform();
    computeZonesCenteredWorld(); drawZones();
    resetSpawnBase();
  });
}

// ----- Pan & Zoom -----
let isPanning=false, lastPointerPos=null;
stage.on('mousedown touchstart', (e)=>{ if (e.target && e.target.getLayer && e.target.getLayer() === pieceLayer) return; isPanning=true; lastPointerPos=stage.getPointerPosition(); });
stage.on('mousemove touchmove', ()=>{ if(!isPanning) return; const pos=stage.getPointerPosition(); if(!pos||!lastPointerPos) return; const dx=pos.x-lastPointerPos.x, dy=pos.y-lastPointerPos.y; world.x+=dx; world.y+=dy; applyWorldTransform();
lastPointerPos = pos;
resetSpawnBase(); });
stage.on('mouseup touchend', ()=>{ isPanning=false; lastPointerPos=null; });
stage.on('wheel', (e)=>{ e.evt.preventDefault(); const old=world.scale; const p=stage.getPointerPosition(); const m={x:(p.x-world.x)/old,y:(p.y-world.y)/old}; let s=e.evt.deltaY>0?old/SCALE_BY:old*SCALE_BY; s=Math.max(SCALE_MIN,Math.min(SCALE_MAX,s)); world.scale=s; world.x=p.x-m.x*s; world.y=p.y-m.y*s; applyWorldTransform();
resetSpawnBase(); });
stage.on('dblclick dbltap', ()=>{ const p=stage.getPointerPosition(); const old=world.scale; const m={x:(p.x-world.x)/old,y:(p.y-world.y)/old}; let s=Math.min(SCALE_MAX, old*1.25); world.scale=s; world.x=p.x-m.x*s; world.y=p.y-m.y*s; applyWorldTransform();
resetSpawnBase(); });

// ----- Intro (fade + zoom centrado al mundo) -----
function startIntroAnimation(){
  const targetScale = 1.0;
  const startScale  = 1.6;

  // centra el centro del MUNDO en el centro de pantalla
  const wc = worldCenter();
  world.scale = startScale;
  world.x = stage.width()/2  - wc.x * world.scale;
  world.y = stage.height()/2 - wc.y * world.scale;
  applyWorldTransform();

  drawGrid();
  computeZonesCenteredWorld();
  drawZones();
  resetSpawnBase();

  [gridLayer, uiLayer, pieceLayer].forEach(L=>{
    L.opacity(0);
    L.to({ opacity: 1, duration: 0.5, easing: Konva.Easings.EaseInOut });
  });

  const steps = 30, dur = 0.8, dt = dur/steps;
  let i = 0;
  const timer = setInterval(()=>{
    i++;
    const t = i/steps;
    const s = startScale + (targetScale - startScale)*t;
    zoomAt({ x: stage.width()/2, y: stage.height()/2 }, s);
    if (i >= steps) clearInterval(timer);
  }, dt*1000);
}

// ----- Resize & arranque -----
function relayout(){
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  drawGrid();
  computeZonesCenteredWorld();
  drawZones();
  applyWorldTransform();
  
  resetSpawnBase();
  pieceLayer.draw();
  updateStatus();
}
window.addEventListener("resize", relayout);

// Boot
drawGrid();
computeZonesCenteredWorld();
drawZones();
applyWorldTransform();
resetSpawnBase();
wireUI();
updateStatus();
pieceLayer.draw();
startIntroAnimation();