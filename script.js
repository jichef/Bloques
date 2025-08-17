// ===== Bloques — script.js (v16.4: zoom + spawn visible + auto-orden en zonas) =====
console.log("Bloques v16.4");

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

// Transformación global (pan/zoom) aplicada a TODAS las layers
const world = { x: 0, y: 0, scale: 1 };

function applyWorldTransform() {
  [gridLayer, uiLayer, pieceLayer].forEach(L => {
    L.position({ x: world.x, y: world.y });
    L.scale({ x: world.scale, y: world.scale });
  });
  stage.batchDraw();
}

// === Conversión pantalla ⇄ mundo (con tu pan/zoom)
function screenToWorld(pt){
  return {
    x: (pt.x - world.x) / world.scale,
    y: (pt.y - world.y) / world.scale
  };
}

// Rectángulo visible actual en coordenadas del mundo
function visibleWorldRect(){
  const tl = screenToWorld({ x: 0, y: 0 });
  const br = screenToWorld({ x: stage.width(), y: stage.height() });
  return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
}

// Centrar en la zona visible (alineado a la rejilla)
function visibleWorldCenter(){
  const r = visibleWorldRect();
  return { x: toCell(r.x + r.w/2), y: toCell(r.y + r.h/2) };
}

// Asegura que una ficha de tamaño (w,h) cabe dentro de lo visible
function clampToVisible(x, y, w, h){
  const r = visibleWorldRect();
  const CX = Math.min(Math.max(x, r.x), r.x + r.w - w);
  const CY = Math.min(Math.max(y, r.y), r.y + r.h - h);
  return snap(CX, CY);
}

// Posiciones “seguras” para cada tipo de ficha, dentro de lo visible
function spawnPosUnit(){
  const c = visibleWorldCenter();
  return clampToVisible(c.x, c.y, GRID, GRID);
}
function spawnPosTen(){
  const c = visibleWorldCenter();
  return clampToVisible(c.x - 5*GRID, c.y, 10*GRID, GRID);
}
function spawnPosHundred(){
  const c = visibleWorldCenter();
  return clampToVisible(c.x - 5*GRID, c.y - 5*GRID, 10*GRID, 10*GRID);
}

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
function zoomStep(direction){ // +1 in / -1 out
  const factor = direction > 0 ? SCALE_BY : 1 / SCALE_BY;
  const target = world.scale * factor;
  const center = { x: stage.width() / 2, y: stage.height() / 2 };
  zoomAt(center, target);
}

// ----- Cuadrícula -----
function drawGrid() {
  gridLayer.destroyChildren();
  const W = WORLD_COLS * GRID;
  const H = WORLD_ROWS * GRID;

  gridLayer.add(new Konva.Rect({
    x: 0, y: 0, width: W, height: H,
    stroke: "#dddddd", strokeWidth: 2, listening: false
  }));

  for (let x = 0; x <= W; x += GRID) {
    const X = x + 0.5;
    gridLayer.add(new Konva.Line({ points: [X,0,X,H], stroke: "#e5e5e5", strokeWidth: 1, listening: false }));
  }
  for (let y = 0; y <= H; y += GRID) {
    const Y = y + 0.5;
    gridLayer.add(new Konva.Line({ points: [0,Y,W,Y], stroke: "#e5e5e5", strokeWidth: 1, listening: false }));
  }
  gridLayer.draw();
}

// ----- Utils -----
const toCell = (n) => Math.round(n / GRID) * GRID;
const snap   = (x,y)=>({x:toCell(x), y:toCell(y)});
const centerWorld = () => ({ x: toCell((WORLD_COLS*GRID)/2), y: toCell((WORLD_ROWS*GRID)/2) });
function speak(text){
  try{ const u=new SpeechSynthesisUtterance(text); u.lang="es-ES"; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{}
}

// get bounding box ABSOLUTO
function nodeBoxAbs(n){ const r = n.getClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }
function isInsideZone(node, zoneRect){
  const b = nodeBoxAbs(node);
  const z = nodeBoxAbs(zoneRect);
  return b.x >= z.x && b.y >= z.y &&
         (b.x + b.w) <= (z.x + z.w) &&
         (b.y + b.h) <= (z.y + z.h);
}

// ----- Zonas 1×10 y 10×10 -----
let ZONES = null; // única declaración
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

  uiLayer.add(zoneTenRect);
  uiLayer.add(tenLbl);
  uiLayer.add(zoneHundRect);
  uiLayer.add(hundLbl);
  uiLayer.draw();
}

// ----- Contador + descomposición -----
function countAll(){
  let units=0, tens=0, hundreds=0;
  pieceLayer.getChildren().forEach(n=>{
    if (n.getClassName() !== 'Group') return;
    const t = n.name() || n.getAttr('btype');
    if (t==='unit') units++;
    else if (t==='ten') tens++;
    else if (t==='hundred') hundreds++;
  });
  return { units, tens, hundreds, total: units + 10*tens + 100*hundreds };
}
function updateStatus(){
  const {units,tens,hundreds,total}=countAll();
  const st=document.getElementById("status");
  if (st) st.textContent = `Total: ${total} — ${hundreds} centenas, ${tens} decenas, ${units} unidades`;
  const b=document.getElementById("breakdown");
  if (b){
    b.innerHTML = `
      <div class="label">Centenas</div><div class="value">${hundreds} × 100 = ${hundreds*100}</div>
      <div class="label">Decenas</div><div class="value">${tens} × 10 = ${tens*10}</div>
      <div class="label">Unidades</div><div class="value">${units} × 1 = ${units}</div>
      <div class="label">Total</div><div class="value">${total}</div>`;
  }
}

// ======= AUTO-ORDENACIÓN EN ZONAS =======
function reorderTensZone(){
  if (!zoneTenRect) return;
  const z = ZONES.tens;
  // Solo UNIDADES dentro de zona de decenas
  const units = [];
  pieceLayer.getChildren().forEach(g=>{
    if (g.getClassName() !== 'Group') return;
    const t = g.name() || g.getAttr('btype');
    if (t !== 'unit') return;
    if (isInsideZone(g, zoneTenRect)) units.push(g);
  });
  // Orden estable por x,y para consistencia
  units.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  // Colocar en 1×10 (izq→der). Si hay >10, se quedan alineadas en la misma fila (las extra se pondrán encima: puedes ampliar a 2 filas si quieres)
  units.forEach((g,i)=>{
    const X = z.x + Math.min(i,9)*GRID;
    const Y = z.y;
    g.position(snap(X,Y));
  });
  pieceLayer.batchDraw();
}

function reorderHundredsZone(){
  if (!zoneHundRect) return;
  const z = ZONES.hund;
  const tens=[], units=[];
  pieceLayer.getChildren().forEach(g=>{
    if (g.getClassName() !== 'Group') return;
    const t = g.name() || g.getAttr('btype');
    if (!isInsideZone(g, zoneHundRect)) return;
    if (t==='ten') tens.push(g);
    else if (t==='unit') units.push(g);
  });
  // Orden estable
  tens.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  units.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));

  // 1) Decenas ocupan filas completas desde arriba
  tens.forEach((g,i)=>{
    const X = z.x;
    const Y = z.y + i*GRID;
    g.position(snap(X,Y));
  });

  // 2) Unidades rellenan a partir de la primera fila libre
  const startRow = tens.length;
  units.forEach((g,i)=>{
    const row = startRow + Math.floor(i/10);
    const col = i % 10;
    const X = z.x + col*GRID;
    const Y = z.y + row*GRID;
    g.position(snap(X,Y));
  });

  pieceLayer.batchDraw();
}

// ----- Eventos comunes -----
function onDragEnd(group){
  group.on("dragend", ()=>{
    // Snap general
    const p = snap(group.x(), group.y());
    group.position(p);

    // Si cae en zonas especiales, reordenar
    if (zoneTenRect && isInsideZone(group, zoneTenRect)) {
      reorderTensZone();
    }
    if (zoneHundRect && isInsideZone(group, zoneHundRect)) {
      reorderHundredsZone();
    }

    pieceLayer.draw();
    checkBuildZones(); // podría fusionar → reordenamos después dentro de checkBuildZones
    updateStatus();
  });
}
function onDouble(group, cb){
  let lastTap=0, lastClick=0;
  group.on('dbltap', cb);
  group.on('dblclick', cb);
  group.on('pointerdown', ()=>{ const now=Date.now(); if(now-lastTap<300) cb(); lastTap=now; });
  group.on('click',       ()=>{ const now=Date.now(); if(now-lastClick<300) cb(); lastClick=now; });
}

// ----- Piezas -----
function addChipRectTo(group, w, h, fill){
  const rect = new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill, ...CHIP_STYLE });
  group.add(rect);
  return rect;
}
function createUnit(x,y){
  const p = snap(x,y);
  const g = new Konva.Group({ x:p.x, y:p.y, draggable:true, name:'unit' });
  g.setAttr('btype','unit');
  addChipRectTo(g, GRID, GRID, COLORS.unit);
  onDragEnd(g);
  pieceLayer.add(g); pieceLayer.draw();

  // Si nace dentro de zonas → reordenar
  if (zoneTenRect && isInsideZone(g, zoneTenRect)) reorderTensZone();
  if (zoneHundRect && isInsideZone(g, zoneHundRect)) reorderHundredsZone();

  checkBuildZones(); updateStatus();
  return g;
}
function createTen(x,y){
  const p = snap(x,y);
  const g = new Konva.Group({ x:p.x, y:p.y, draggable:true, name:'ten' });
  g.setAttr('btype','ten');
  addChipRectTo(g, 10*GRID, GRID, COLORS.ten);
  onDragEnd(g);
  onDouble(g, ()=>{
    const start = snap(g.x(), g.y());
    g.destroy();
    for (let k=0;k<10;k++) createUnit(start.x + k*GRID, start.y);
    pieceLayer.draw(); checkBuildZones(); updateStatus();
  });
  pieceLayer.add(g); pieceLayer.draw();

  if (zoneHundRect && isInsideZone(g, zoneHundRect)) reorderHundredsZone();

  checkBuildZones(); updateStatus();
  return g;
}
function createHundred(x,y){
  const p = snap(x,y);
  const g = new Konva.Group({ x:p.x, y:p.y, draggable:true, name:'hundred' });
  g.setAttr('btype','hundred');
  addChipRectTo(g, 10*GRID, 10*GRID, COLORS.hundred);
  onDragEnd(g);
  onDouble(g, ()=>{
    const start = snap(g.x(), g.y());
    g.destroy();
    for (let row=0; row<10; row++) createTen(start.x, start.y + row*GRID);
    pieceLayer.draw(); checkBuildZones(); updateStatus();
  });
  pieceLayer.add(g); pieceLayer.draw();
  checkBuildZones(); updateStatus();
  return g;
}

// ----- ZONAS de construcción (composición) -----
function composeTensInZone() {
  if (!zoneTenRect) return false;
  let changed = false;

  // Mapa de filas dentro de la zona (UNIDADES)
  const rows = new Map();
  pieceLayer.getChildren().forEach(n=>{
    const t = n.name()||n.getAttr('btype');
    if (t!=='unit') return;
    if (!isInsideZone(n, zoneTenRect)) return;
    const rowY = toCell(n.y());
    if (!rows.has(rowY)) rows.set(rowY, new Map());
    rows.get(rowY).set(toCell(n.x()), n);
  });

  // Buscar 10 contiguas
  rows.forEach((mapX, rowY)=>{
    const xs = Array.from(mapX.keys()).sort((a,b)=>a-b);
    for (let i=0; i<=xs.length-10; i++){
      let ok=true;
      for (let k=0;k<10;k++){
        if (!mapX.has(xs[i]+k*GRID)) { ok=false; break; }
      }
      if (ok){
        const nodes=[]; for (let k=0;k<10;k++) nodes.push(mapX.get(xs[i]+k*GRID));
        nodes.forEach(n=>n.destroy());
        createTen(xs[i], rowY);
        changed = true;
      }
    }
  });

  // Si no hay 10 contiguas, 10 cualesquiera dentro
  if (!changed) {
    const pool=[];
    pieceLayer.getChildren().forEach(n=>{
      const t=n.name()||n.getAttr('btype');
      if (t!=='unit') return;
      if (isInsideZone(n, zoneTenRect)) pool.push(n);
    });
    if (pool.length>=10){
      const anchor = snap(pool[0].x(), pool[0].y());
      for (let i=0;i<10;i++) pool[i].destroy();
      createTen(anchor.x, anchor.y);
      changed = true;
    }
  }

  if (changed) {
    reorderTensZone();
    pieceLayer.draw();
  }
  return changed;
}

function composeHundredsInZone() {
  if (!zoneHundRect) return false;
  let changed = false;

  // Unidades -> Decenas
  while (true) {
    const units=[];
    pieceLayer.getChildren().forEach(n=>{
      const t=n.name()||n.getAttr('btype');
      if (t!=='unit') return;
      if (isInsideZone(n, zoneHundRect)) units.push(n);
    });
    if (units.length < 10) break;
    const anchor = snap(units[0].x(), units[0].y());
    for (let i=0;i<10;i++) units[i].destroy();
    createTen(anchor.x, anchor.y);
    changed = true;
  }
  // Decenas -> Centena
  while (true) {
    const tens=[];
    pieceLayer.getChildren().forEach(n=>{
      const t=n.name()||n.getAttr('btype');
      if (t!=='ten') return;
      if (isInsideZone(n, zoneHundRect)) tens.push(n);
    });
    if (tens.length < 10) break;
    const anchor = snap(tens[0].x(), tens[0].y());
    for (let i=0;i<10;i++) tens[i].destroy();
    createHundred(anchor.x, anchor.y);
    changed = true;
  }

  if (changed) {
    reorderHundredsZone();
    pieceLayer.draw();
  }
  return changed;
}

function checkBuildZones() {
  let changed;
  do {
    changed = false;
    if (composeTensInZone())     changed = true;
    if (composeHundredsInZone()) changed = true;
  } while (changed);

  // Siempre reordenar si hay algo dentro
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
  $('btn-say')    ?.addEventListener('click', ()=>{
    const {units,tens,hundreds,total}=countAll();
    speak(`Tienes ${hundreds} centenas, ${tens} decenas y ${units} unidades. Total: ${total}.`);
  });
  $('btn-challenge')?.addEventListener('click', ()=>{
    const n=Math.floor(Math.random()*900)+100;
    const ch=$('challenge'); if (ch) ch.textContent=`Forma el número ${n}`;
  });
  $('panel-toggle')?.addEventListener('click', ()=>{
    const panel=$('panel');
    const open=panel.classList.toggle('open');
    const btn=$('panel-toggle');
    btn.textContent = open ? '⬇︎ Ocultar detalles' : '⬆︎ Detalles';
    btn.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
  });

  // 🔍 Botones de zoom
  const bindZoom = (id, fn) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', (ev)=>{ ev.preventDefault(); fn(); });
    el.addEventListener('pointerdown', (ev)=>{ ev.preventDefault(); fn(); });
  };
  bindZoom('btn-zoom-in',  ()=> zoomStep(+1));
  bindZoom('btn-zoom-out', ()=> zoomStep(-1));
  bindZoom('btn-reset-view', ()=>{
    world.x = 0; world.y = 0; world.scale = 1;
    applyWorldTransform();
  });
}

// ----- Pan & Zoom (rueda/drag) -----
let isPanning = false;
let lastPointerPos = null;

stage.on('mousedown touchstart', (e)=>{
  if (e.target && e.target.getLayer && e.target.getLayer() === pieceLayer) return;
  isPanning = true;
  lastPointerPos = stage.getPointerPosition();
});
stage.on('mousemove touchmove', ()=>{
  if (!isPanning) return;
  const pos = stage.getPointerPosition();
  if (!pos || !lastPointerPos) return;
  const dx = pos.x - lastPointerPos.x;
  const dy = pos.y - lastPointerPos.y;
  world.x += dx;
  world.y += dy;
  applyWorldTransform();
  lastPointerPos = pos;
});
stage.on('mouseup touchend', ()=>{ isPanning = false; lastPointerPos = null; });

stage.on('wheel', (e)=>{
  e.evt.preventDefault();
  const old = world.scale;
  const pointer = stage.getPointerPosition();
  const mouse = { x: (pointer.x - world.x) / old, y: (pointer.y - world.y) / old };
  const dir = e.evt.deltaY > 0 ? -1 : 1;
  let s = dir > 0 ? old * SCALE_BY : old / SCALE_BY;
  s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));
  world.scale = s;
  world.x = pointer.x - mouse.x * s;
  world.y = pointer.y - mouse.y * s;
  applyWorldTransform();
});
stage.on('dblclick dbltap', ()=>{
  const pointer = stage.getPointerPosition();
  const old = world.scale;
  const mouse = { x: (pointer.x - world.x) / old, y: (pointer.y - world.y) / old };
  let s = Math.min(SCALE_MAX, old * 1.25);
  world.scale = s;
  world.x = pointer.x - mouse.x * s;
  world.y = pointer.y - mouse.y * s;
  applyWorldTransform();
});

// ----- Resize & arranque -----
function relayout(){
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  drawGrid();
  computeZones();
  drawZones();
  applyWorldTransform();
  pieceLayer.draw();
  updateStatus();
}
window.addEventListener("resize", relayout);

// Boot
drawGrid();
computeZones();
drawZones();
applyWorldTransform();
wireUI();
updateStatus();
pieceLayer.draw();