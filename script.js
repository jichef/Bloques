// ===== Bloques — script.js (v16.1: 3 Layers + pan/zoom sincronizado + fix ZONES) =====
console.log("Bloques v16.1");

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

// ----- Eventos comunes -----
function onDragEnd(group){
  group.on("dragend", ()=>{
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

// ----- Construcción en zonas -----
function composeTensInZone() { /* igual que antes */ }
function composeHundredsInZone() { /* igual que antes */ }
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
function wireUI(){ /* igual que antes */ }

// ----- Pan & Zoom -----
/* ... igual que tu v16 ... */

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