// ===== Bloques — script.js (v13: piezas en Group + contorno suave) =====
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
const WORLD_COLS = 160; // ancho en celdas
const WORLD_ROWS = 120; // alto en celdas

// ----- Stage y capas -----
const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});
const world      = new Konva.Group({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
const gridLayer  = new Konva.Layer({ listening: false });
const uiLayer    = new Konva.Layer({ listening: false });
const pieceLayer = new Konva.Layer();
world.add(gridLayer);
world.add(uiLayer);
world.add(pieceLayer);
stage.add(world);

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

// get bounding box de un nodo (Rect o Group) en coords del "world"
function nodeBox(n){
  // getClientRect con referencia al 'world' asegura coords en el mismo sistema
  const r = n.getClientRect({ relativeTo: world });
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}
function isInsideZone(n, zone){
  const b = nodeBox(n);
  return b.x >= zone.x && b.y >= zone.y &&
         (b.x + b.w) <= (zone.x + zone.w) &&
         (b.y + b.h) <= (zone.y + zone.h);
}

// ----- Zonas 1×10 (decenas) y 10×10 (centenas) -----
let ZONES = null;
function computeZones() {
  const margin = GRID * 2;
  const tens = { x: margin, y: margin, w: GRID * 10, h: GRID * 1,  label: "Zona Decenas (1×10)" };
  const hund = { x: margin, y: tens.y + tens.h + GRID * 2, w: GRID * 10, h: GRID * 10, label: "Zona Centenas (10×10)" };
  ZONES = { tens, hund };
}
function drawZones() {
  uiLayer.destroyChildren();
  const { tens, hund } = ZONES;
  uiLayer.add(new Konva.Rect({ x:tens.x, y:tens.y, width:tens.w, height:tens.h, stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL, listening:false }));
  uiLayer.add(new Konva.Text({ x:tens.x+6, y:tens.y-22, text:tens.label, fontSize:16, fill: ZONE_STROKE, listening:false }));
  uiLayer.add(new Konva.Rect({ x:hund.x, y:hund.y, width:hund.w, height:hund.h, stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL, listening:false }));
  uiLayer.add(new Konva.Text({ x:hund.x+6, y:hund.y-22, text:hund.label, fontSize:16, fill: ZONE_STROKE, listening:false }));
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
pieceLayer.on('add', updateStatus);
pieceLayer.on('destroy', updateStatus);
stage.on('dragend', updateStatus);

// ----- Comunes (drag/double) -----
function onDragEnd(group){
  group.on("dragend", ()=>{
    // snap al origen del group
    const p = snap(group.x(), group.y());
    group.position(p);
    pieceLayer.draw();
    checkBuildZones();
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

// ----- Piezas (cada pieza = Group con Rect hijo) -----
function addChipRectTo(group, w, h, fill){
  const rect = new Konva.Rect({
    x: 0, y: 0,
    width: w, height: h,
    fill,
    ...CHIP_STYLE
  });
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

// ----- ZONAS de construcción -----
function composeTensInZone() {
  const { tens } = ZONES;
  let changed = false;

  // mapear filas y Xs de UNIDADES dentro de la zona
  const rows = new Map();
  pieceLayer.getChildren().forEach(n=>{
    const t = n.name()||n.getAttr('btype');
    if (t!=='unit') return;
    if (!isInsideZone(n, tens)) return;
    const rowY = toCell(n.y());
    if (!rows.has(rowY)) rows.set(rowY, new Map());
    rows.get(rowY).set(toCell(n.x()), n);
  });

  // buscar 10 contiguas
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

  // si no hay 10 contiguas, 10 cualesquiera dentro
  if (!changed) {
    const pool=[];
    pieceLayer.getChildren().forEach(n=>{
      const t=n.name()||n.getAttr('btype');
      if (t!=='unit') return;
      if (isInsideZone(n, tens)) pool.push(n);
    });
    if (pool.length>=10){
      const anchor = snap(pool[0].x(), pool[0].y());
      for (let i=0;i<10;i++) pool[i].destroy();
      createTen(anchor.x, anchor.y);
      changed = true;
    }
  }

  if (changed) pieceLayer.draw();
  return changed;
}

function composeHundredsInZone() {
  const { hund } = ZONES;
  let changed = false;

  // Unidades -> Decenas
  while (true) {
    const units=[];
    pieceLayer.getChildren().forEach(n=>{
      const t=n.name()||n.getAttr('btype');
      if (t!=='unit') return;
      if (isInsideZone(n, hund)) units.push(n);
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
      if (isInsideZone(n, hund)) tens.push(n);
    });
    if (tens.length < 10) break;
    const anchor = snap(tens[0].x(), tens[0].y());
    for (let i=0;i<10;i++) tens[i].destroy();
    createHundred(anchor.x, anchor.y);
    changed = true;
  }

  if (changed) pieceLayer.draw();
  return changed;
}

function checkBuildZones() {
  let changed;
  do {
    changed = false;
    if (composeTensInZone())     changed = true;
    if (composeHundredsInZone()) changed = true;
  } while (changed);
  updateStatus();
}

// ----- Botonera -----
function wireUI(){
  const $ = id => document.getElementById(id);
  $('btn-unit')   ?.addEventListener('click', ()=>{ const c=centerWorld(); createUnit(c.x,c.y); });
  $('btn-ten')    ?.addEventListener('click', ()=>{ const c=centerWorld(); createTen(c.x-5*GRID,c.y); });
  $('btn-hundred')?.addEventListener('click', ()=>{ const c=centerWorld(); createHundred(c.x-5*GRID,c.y-5*GRID); });
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
}

// ----- Pan & Zoom -----
let isPanning = false;
let lastPointerPos = null;
stage.on('mousedown touchstart', (e)=>{
  if (e.target && e.target.getParent() === pieceLayer) return; // no pan si arrastras ficha
  isPanning = true;
  lastPointerPos = stage.getPointerPosition();
});
stage.on('mousemove touchmove', ()=>{
  if (!isPanning) return;
  const pos = stage.getPointerPosition();
  if (!pos || !lastPointerPos) return;
  const dx = pos.x - lastPointerPos.x;
  const dy = pos.y - lastPointerPos.y;
  world.x(world.x() + dx);
  world.y(world.y() + dy);
  lastPointerPos = pos;
  stage.batchDraw();
});
stage.on('mouseup touchend', ()=>{ isPanning = false; lastPointerPos = null; });

const SCALE_MIN = 0.4, SCALE_MAX = 3.0, SCALE_BY = 1.06;
stage.on('wheel', (e)=>{
  e.evt.preventDefault();
  const old = world.scaleX();
  const pointer = stage.getPointerPosition();
  const mouse = { x: (pointer.x - world.x()) / old, y: (pointer.y - world.y()) / old };
  const dir = e.evt.deltaY > 0 ? -1 : 1;
  let s = dir > 0 ? old * SCALE_BY : old / SCALE_BY;
  s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));
  world.scale({ x:s, y:s });
  world.position({ x: pointer.x - mouse.x * s, y: pointer.y - mouse.y * s });
  stage.batchDraw();
});
stage.on('dblclick dbltap', ()=>{
  const pointer = stage.getPointerPosition();
  const old = world.scaleX();
  const mouse = { x: (pointer.x - world.x()) / old, y: (pointer.y - world.y()) / old };
  let s = Math.min(SCALE_MAX, old * 1.25);
  world.scale({ x:s, y:s });
  world.position({ x: pointer.x - mouse.x * s, y: pointer.y - mouse.y * s });
  stage.batchDraw();
});

// ----- Resize & arranque -----
function relayout(){
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  drawGrid();
  computeZones();
  drawZones();
  pieceLayer.draw();
  updateStatus();
}
window.addEventListener("resize", relayout);

drawGrid();
computeZones();
drawZones();
wireUI();
updateStatus();
pieceLayer.draw();