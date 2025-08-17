// ===== Bloques — script.js (v16.9: no superponer piezas + compat find) =====
console.log("Bloques v16.9");

const GRID = 32;
Konva.pixelRatio = 1;

const COLORS = { unit: "#1f78ff", ten: "#ff3b30", hundred: "#2ecc71" };
const ZONE_STROKE = "#6c5ce7";
const ZONE_FILL   = "rgba(108,92,231,0.06)";

// Estilo de fichas (contorno + sombra)
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

// ===== Zoom limits =====
const SCALE_MIN = 0.4, SCALE_MAX = 3.0, SCALE_BY = 1.06;

// ----- Stage y Layers -----
const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});
const gridLayer  = new Konva.Layer({ listening: false });
const uiLayer    = new Konva.Layer({ listening: false });
const pieceLayer = new Konva.Layer();
stage.add(gridLayer);
stage.add(uiLayer);
stage.add(pieceLayer);

// Transformación global (pan/zoom)
const world = { x: 0, y: 0, scale: 1 };
function applyWorldTransform() {
  [gridLayer, uiLayer, pieceLayer].forEach(L => {
    L.position({ x: world.x, y: world.y });
    L.scale({ x: world.scale, y: world.scale });
  });
  stage.batchDraw();
}

// === Conversión pantalla ⇄ mundo
function screenToWorld(pt){ return { x:(pt.x-world.x)/world.scale, y:(pt.y-world.y)/world.scale }; }
function visibleWorldRect(){
  const tl = screenToWorld({ x: 0, y: 0 });
  const br = screenToWorld({ x: stage.width(), y: stage.height() });
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}
function visibleWorldCenter(){
  const r = visibleWorldRect();
  return { x: toCell(r.x + r.w/2), y: toCell(r.y + r.h/2) };
}
function clampToVisible(x, y, w, h){
  const r = visibleWorldRect();
  const CX = Math.min(Math.max(x, r.x), r.x + r.w - w);
  const CY = Math.min(Math.max(y, r.y), r.y + r.h - h);
  return snap(CX, CY);
}
function spawnPosUnit(){ const c = visibleWorldCenter(); return clampToVisible(c.x, c.y, GRID, GRID); }
function spawnPosTen(){ const c = visibleWorldCenter(); return clampToVisible(c.x - 5*GRID, c.y, 10*GRID, GRID); }
function spawnPosHundred(){ const c = visibleWorldCenter(); return clampToVisible(c.x - 5*GRID, c.y - 5*GRID, 10*GRID, 10*GRID); }

// Helpers de zoom
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
  const center = { x: stage.width() / 2, y: stage.height() / 2 };
  zoomAt(center, target);
}

// ----- Cuadrícula -----
function drawGrid() {
  gridLayer.destroyChildren();
  const W = WORLD_COLS * GRID, H = WORLD_ROWS * GRID;
  gridLayer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, stroke: "#dddddd", strokeWidth: 2, listening: false }));
  for (let x = 0; x <= W; x += GRID) gridLayer.add(new Konva.Line({ points:[x+0.5,0,x+0.5,H], stroke:"#e5e5e5", strokeWidth:1, listening:false }));
  for (let y = 0; y <= H; y += GRID) gridLayer.add(new Konva.Line({ points:[0,y+0.5,W,y+0.5], stroke:"#e5e5e5", strokeWidth:1, listening:false }));
  gridLayer.draw();
}

// ----- Utils -----
const toCell = n => Math.round(n / GRID) * GRID;
const snap   = (x,y)=>({x:toCell(x), y:toCell(y)});
function speak(text){
  try{ const u=new SpeechSynthesisUtterance(text); u.lang="es-ES"; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch{}
}

// ==== Geometría de zona ====
function nodeBoxAbs(n){ const r=n.getClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; }
function rectsIntersect(a,b){ return !(a.x+a.w<=b.x || a.x>=b.x+b.w || a.y+a.h<=b.y || a.y>=b.y+b.h); }
function intersectsZone(node, zoneRect){ return rectsIntersect(nodeBoxAbs(node), nodeBoxAbs(zoneRect)); }
function centerInZone(node, zoneRect){
  const b = nodeBoxAbs(node), z = nodeBoxAbs(zoneRect);
  const cx = b.x + b.w/2, cy = b.y + b.h/2;
  return (cx >= z.x && cx <= z.x+z.w && cy >= z.y && cy <= z.y+z.h);
}

// ----- Zonas 1×10 y 10×10 -----
let ZONES = null;
let zoneTenRect = null;
let zoneHundRect = null;

function computeZones() {
  const margin = GRID * 2;
  const tens = { x: margin, y: margin, w: GRID * 10, h: GRID * 1,  label: "Zona Decenas (1×10)" };
  const hund = { x: margin, y: tens.y + tens.h + GRID * 2, w: GRID * 10, h: GRID * 10, label: "Zona Centenas (10×10)" };
  ZONES = { tens, hund };
}
function drawZones() {
  uiLayer.destroyChildren();
  const { tens, hund } = ZONES;
  zoneTenRect = new Konva.Rect({ x:tens.x, y:tens.y, width:tens.w, height:tens.h, stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL, listening:false });
  const tenLbl = new Konva.Text({ x:tens.x+6, y:tens.y-22, text:tens.label, fontSize:16, fill: ZONE_STROKE, listening:false });
  zoneHundRect = new Konva.Rect({ x:hund.x, y:hund.y, width:hund.w, height:hund.h, stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL, listening:false });
  const hundLbl = new Konva.Text({ x:hund.x+6, y:hund.y-22, text:hund.label, fontSize:16, fill: ZONE_STROKE, listening:false });
  uiLayer.add(zoneTenRect, tenLbl, zoneHundRect, hundLbl);
  uiLayer.draw();
}

// ===== Normalizador universal para collections de Konva / arrays =====
function collectionToArray(coll){
  if (Array.isArray(coll)) return coll;
  if (coll && typeof coll.length === 'number') { const out=[]; for (let i=0;i<coll.length;i++) out.push(coll[i]); return out; }
  if (coll && typeof coll.each === 'function') { const out=[]; coll.each(n=>out.push(n)); return out; }
  if (coll && typeof coll.toArray === 'function') { try { return coll.toArray(); } catch {} }
  return [];
}

// ----- Helpers de piezas (robusto) -----
function getPieceGroups(){
  const groups = collectionToArray(pieceLayer.find('Group'));
  return groups.filter(g=>{
    const t = (g.name && g.name()) || (g.getAttr && g.getAttr('btype'));
    return t === 'unit' || t === 'ten' || t === 'hundred';
  });
}
function pieceType(g){ return (g.name && g.name()) || (g.getAttr && g.getAttr('btype')); }
function pieceSize(typeOrGroup){
  const t = typeof typeOrGroup === 'string' ? typeOrGroup : pieceType(typeOrGroup);
  if (t === 'unit')    return { w: GRID,       h: GRID };
  if (t === 'ten')     return { w: 10*GRID,    h: GRID };
  if (t === 'hundred') return { w: 10*GRID,    h: 10*GRID };
  return { w: GRID, h: GRID };
}
function worldBounds(){
  return { x:0, y:0, w: WORLD_COLS*GRID, h: WORLD_ROWS*GRID };
}
function clampToWorld(x,y,w,h){
  const W = worldBounds();
  return {
    x: Math.max(W.x, Math.min(x, W.x + W.w - w)),
    y: Math.max(W.y, Math.min(y, W.y + W.h - h))
  };
}

// ---- Colisiones / Búsqueda de hueco libre ----
function overlapsRect(rect, ignore=null){
  for (const other of getPieceGroups()){
    if (ignore && other === ignore) continue;
    const b = nodeBoxAbs(other);
    if (rectsIntersect(rect, b)) return true;
  }
  return false;
}
function overlapsAny(node){
  const a = nodeBoxAbs(node);
  return overlapsRect(a, node);
}
function findFreeSpot(desired, type, ignore=null){
  // desired: {x,y} YA alineado a GRID
  const { w, h } = pieceSize(type);
  const W = worldBounds();
  // 1) Prueba directa
  const clamped0 = clampToWorld(desired.x, desired.y, w, h);
  const rect0 = { x: clamped0.x, y: clamped0.y, w, h };
  if (!overlapsRect(rect0, ignore)) return clamped0;

  // 2) Búsqueda en espiral por celdas
  const MAX_RADIUS = 60; // celdas
  for (let r=1; r<=MAX_RADIUS; r++){
    // Recorre el perímetro del cuadrado de radio r
    for (let dx=-r; dx<=r; dx++){
      for (let dy of [-r, r]){ // top y bottom
        const x = toCell(desired.x + dx*GRID);
        const y = toCell(desired.y + dy*GRID);
        const p = clampToWorld(x, y, w, h);
        const rect = { x:p.x, y:p.y, w, h };
        if (!overlapsRect(rect, ignore)) return p;
      }
    }
    for (let dy=-r+1; dy<=r-1; dy++){
      for (let dx of [-r, r]){ // left y right
        const x = toCell(desired.x + dx*GRID);
        const y = toCell(desired.y + dy*GRID);
        const p = clampToWorld(x, y, w, h);
        const rect = { x:p.x, y:p.y, w, h };
        if (!overlapsRect(rect, ignore)) return p;
      }
    }
  }
  return null; // no se encontró (muy raro)
}

// ----- Contador + descomposición (robusto) -----
function countAll(){
  const pieces = getPieceGroups();
  let units = 0, tens = 0, hundreds = 0;
  for (const g of pieces){
    const t = pieceType(g);
    if (t==='unit') units++;
    else if (t==='ten') tens++;
    else if (t==='hundred') hundreds++;
  }
  return { units, tens, hundreds, total: units + 10*tens + 100*hundreds };
}

// === Conversor ES nativo (0..999999) ===
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
function reorderTensZone(){
  if (!zoneTenRect) return;
  const z = ZONES.tens;
  const units = [];
  for (const g of getPieceGroups()){
    const t=pieceType(g);
    if (t==='unit' && centerInZone(g, zoneTenRect)) units.push(g);
  }
  units.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  units.forEach((g,i)=>{ g.position(snap(z.x + Math.min(i,9)*GRID, z.y)); });
  pieceLayer.batchDraw();
  updateStatus();
}
function reorderHundredsZone(){
  if (!zoneHundRect) return;
  const z = ZONES.hund;
  const tens=[], units=[];
  for (const g of getPieceGroups()){
    const t=pieceType(g);
    if (!centerInZone(g, zoneHundRect)) continue;
    if (t==='ten') tens.push(g); else if (t==='unit') units.push(g);
  }
  tens.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  units.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  tens.forEach((g,i)=>{ g.position(snap(z.x, z.y + i*GRID)); });
  const startRow=tens.length;
  units.forEach((g,i)=>{ const row=startRow+Math.floor(i/10), col=i%10; g.position(snap(z.x+col*GRID, z.y+row*GRID)); });
  pieceLayer.batchDraw();
  updateStatus();
}

// ----- Eventos comunes -----
function onDragEnd(group){
  // Guardar última posición válida al empezar a arrastrar
  group.on("dragstart", ()=>{
    group._prevPos = { x: group.x(), y: group.y() };
  });

  group.on("dragend", ()=>{
    const type = pieceType(group);
    // Snap general
    const snapped = snap(group.x(), group.y());
    group.position(snapped);

    // Si pisa zonas, reordenamos y componemos como antes
    if (zoneTenRect && type==='unit' && intersectsZone(group, zoneTenRect)) {
      group.position(snap(ZONES.tens.x, ZONES.tens.y));
      reorderTensZone();
      checkBuildZones();
    }
    if (zoneHundRect && (type==='unit' || type==='ten') && intersectsZone(group, zoneHundRect)) {
      group.position(snap(ZONES.hund.x, ZONES.hund.y));
      reorderHundredsZone();
      checkBuildZones();
    }

    // ---- NO SUPERPONER: reubicar si colisiona
    if (overlapsAny(group)) {
      const desired = snap(group.x(), group.y());
      const free = findFreeSpot(desired, type, group);
      if (free) {
        group.position(free);
      } else if (group._prevPos) {
        // No hay hueco: volver a donde estaba
        group.position(group._prevPos);
      }
    }

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

// ----- Piezas -----
function addChipRectTo(group, w, h, fill){
  const rect = new Konva.Rect({ x:0, y:0, width:w, height:h, fill, ...CHIP_STYLE });
  group.add(rect);
  return rect;
}
function placeWithoutOverlap(g, desired){
  const type = pieceType(g);
  const start = snap(desired.x, desired.y);
  const free = findFreeSpot(start, type, g);
  if (free) g.position(free);
  else g.position(start); // fallback
}
function createUnit(x,y){
  const g=new Konva.Group({ x:toCell(x), y:toCell(y), draggable:true, name:'unit' });
  g.setAttr('btype','unit');
  addChipRectTo(g, GRID, GRID, COLORS.unit);
  onDragEnd(g);
  pieceLayer.add(g);

  // Recolocar si nace dentro o rozando zonas
  if (zoneTenRect && intersectsZone(g, zoneTenRect)) { g.position(snap(ZONES.tens.x, ZONES.tens.y)); reorderTensZone(); }
  else if (zoneHundRect && intersectsZone(g, zoneHundRect)) { g.position(snap(ZONES.hund.x, ZONES.hund.y)); reorderHundredsZone(); }
  else { placeWithoutOverlap(g, {x:g.x(), y:g.y()}); }

  pieceLayer.draw();
  checkBuildZones(); updateStatus();
  return g;
}
function createTen(x,y){
  const g=new Konva.Group({ x:toCell(x), y:toCell(y), draggable:true, name:'ten' });
  g.setAttr('btype','ten');
  addChipRectTo(g, 10*GRID, GRID, COLORS.ten);
  onDragEnd(g);
  onDouble(g, ()=>{
    const start = snap(g.x(), g.y());
    g.destroy();
    for (let k=0;k<10;k++) createUnit(start.x + k*GRID, start.y);
    pieceLayer.draw(); checkBuildZones(); updateStatus();
  });
  pieceLayer.add(g);

  if (zoneHundRect && intersectsZone(g, zoneHundRect)) { g.position(snap(ZONES.hund.x, ZONES.hund.y)); reorderHundredsZone(); }
  else { placeWithoutOverlap(g, {x:g.x(), y:g.y()}); }

  pieceLayer.draw();
  checkBuildZones(); updateStatus();
  return g;
}
function createHundred(x,y){
  const g=new Konva.Group({ x:toCell(x), y:toCell(y), draggable:true, name:'hundred' });
  g.setAttr('btype','hundred');
  addChipRectTo(g, 10*GRID, 10*GRID, COLORS.hundred);
  onDragEnd(g);
  onDouble(g, ()=>{
    const start = snap(g.x(), g.y());
    g.destroy();
    for (let row=0; row<10; row++) createTen(start.x, start.y + row*GRID);
    pieceLayer.draw(); checkBuildZones(); updateStatus();
  });
  pieceLayer.add(g);

  placeWithoutOverlap(g, {x:g.x(), y:g.y()});

  pieceLayer.draw();
  checkBuildZones(); updateStatus();
  return g;
}

// ----- ZONAS de composición -----
function composeTensInZone() {
  if (!zoneTenRect) return false;
  let changed = false;
  const rows = new Map();
  for (const n of getPieceGroups()){
    const t = pieceType(n);
    if (t!=='unit' || !centerInZone(n, zoneTenRect)) continue;
    const rowY = toCell(n.y());
    if (!rows.has(rowY)) rows.set(rowY, new Map());
    rows.get(rowY).set(toCell(n.x()), n);
  }
  rows.forEach((mapX, rowY)=>{
    const xs = Array.from(mapX.keys()).sort((a,b)=>a-b);
    for (let i=0; i<=xs.length-10; i++){
      let ok=true; for (let k=0;k<10;k++){ if (!mapX.has(xs[i]+k*GRID)) { ok=false; break; } }
      if (ok){
        const nodes=[]; for (let k=0;k<10;k++) nodes.push(mapX.get(xs[i]+k*GRID));
        nodes.forEach(n=>n.destroy());
        const ten = createTen(xs[i], rowY);
        placeWithoutOverlap(ten, {x:xs[i], y:rowY});
        changed = true;
      }
    }
  });
  if (!changed) {
    const pool=[];
    for (const n of getPieceGroups()){
      const t=pieceType(n);
      if (t==='unit' && centerInZone(n, zoneTenRect)) pool.push(n);
    }
    if (pool.length>=10){
      const anchor=snap(pool[0].x(), pool[0].y());
      for (let i=0;i<10;i++) pool[i].destroy();
      const ten = createTen(anchor.x, anchor.y);
      placeWithoutOverlap(ten, anchor);
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
    for (const n of getPieceGroups()){
      const t=pieceType(n);
      if (t==='unit' && centerInZone(n, zoneHundRect)) units.push(n);
    }
    if (units.length < 10) break;
    const anchor = snap(units[0].x(), units[0].y());
    for (let i=0;i<10;i++) units[i].destroy();
    const ten = createTen(anchor.x, anchor.y);
    placeWithoutOverlap(ten, anchor);
    changed = true;
  }
  while (true) {
    const tens=[];
    for (const n of getPieceGroups()){
      const t=pieceType(n);
      if (t==='ten' && centerInZone(n, zoneHundRect)) tens.push(n);
    }
    if (tens.length < 10) break;
    const anchor = snap(tens[0].x(), tens[0].y());
    for (let i=0;i<10;i++) tens[i].destroy();
    const hundred = createHundred(anchor.x, anchor.y);
    placeWithoutOverlap(hundred, anchor);
    changed = true;
  }
  if (changed) { reorderHundredsZone(); pieceLayer.draw(); }
  return changed;
}
function checkBuildZones() {
  let changed;
  do {
    changed = false;
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
  $('btn-unit')   ?.addEventListener('click', ()=>{ const p = spawnPosUnit();    createUnit(p.x, p.y); });
  $('btn-ten')    ?.addEventListener('click', ()=>{ const p = spawnPosTen();     createTen(p.x, p.y); });
  $('btn-hundred')?.addEventListener('click', ()=>{ const p = spawnPosHundred(); createHundred(p.x, p.y); });
  $('btn-clear')  ?.addEventListener('click', ()=>{ pieceLayer.destroyChildren(); pieceLayer.draw(); updateStatus(); });
  $('btn-compose')?.addEventListener('click', ()=>{ checkBuildZones(); });

  // 🔊 Leer número
  $('btn-say')?.addEventListener('click', ()=>{
    const {units,tens,hundreds,total}=countAll();
    if (total === 0) return;
    hablarDescompYLetras(hundreds, tens, units, total, 1100);
  });

  // 🎯 Reto
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

  // 🔍 Zoom
  const bindZoom=(id,fn)=>{ const el=$(id); if(!el) return; el.addEventListener('click',e=>{e.preventDefault();fn();}); el.addEventListener('pointerdown',e=>{e.preventDefault();fn();}); };
  bindZoom('btn-zoom-in',  ()=> zoomStep(+1));
  bindZoom('btn-zoom-out', ()=> zoomStep(-1));
  bindZoom('btn-reset-view', ()=>{ world.x=0; world.y=0; world.scale=1; applyWorldTransform(); });
}

// ----- Pan & Zoom -----
let isPanning=false, lastPointerPos=null;
stage.on('mousedown touchstart', (e)=>{ if (e.target && e.target.getLayer && e.target.getLayer() === pieceLayer) return; isPanning=true; lastPointerPos=stage.getPointerPosition(); });
stage.on('mousemove touchmove', ()=>{ if(!isPanning) return; const pos=stage.getPointerPosition(); if(!pos||!lastPointerPos) return; const dx=pos.x-lastPointerPos.x, dy=pos.y-lastPointerPos.y; world.x+=dx; world.y+=dy; applyWorldTransform(); lastPointerPos=pos; });
stage.on('mouseup touchend', ()=>{ isPanning=false; lastPointerPos=null; });
stage.on('wheel', (e)=>{ e.evt.preventDefault(); const old=world.scale; const p=stage.getPointerPosition(); const m={x:(p.x-world.x)/old,y:(p.y-world.y)/old}; let s=e.evt.deltaY>0?old/SCALE_BY:old*SCALE_BY; s=Math.max(SCALE_MIN,Math.min(SCALE_MAX,s)); world.scale=s; world.x=p.x-m.x*s; world.y=p.y-m.y*s; applyWorldTransform(); });
stage.on('dblclick dbltap', ()=>{ const p=stage.getPointerPosition(); const old=world.scale; const m={x:(p.x-world.x)/old,y:(p.y-world.y)/old}; let s=Math.min(SCALE_MAX, old*1.25); world.scale=s; world.x=p.x-m.x*s; world.y=p.y-m.y*s; applyWorldTransform(); });

// ----- Resize & arranque -----
function relayout(){
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  drawGrid(); computeZones(); drawZones(); applyWorldTransform(); pieceLayer.draw(); updateStatus();
}
window.addEventListener("resize", relayout);

// Boot
drawGrid(); computeZones(); drawZones(); applyWorldTransform(); wireUI(); updateStatus(); pieceLayer.draw();