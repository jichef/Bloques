// ===== Bloques — script.js (v10 con zonas de construcción) =====
const GRID = 32;
Konva.pixelRatio = 1;

const COLORS = { unit: "#1f78ff", ten: "#ff3b30", hundred: "#2ecc71" };
const ZONE_STROKE = "#6c5ce7";
const ZONE_FILL   = "rgba(108,92,231,0.06)";

// ----- Stage y capas -----
const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});
const gridLayer = new Konva.Layer({ listening: false });
const uiLayer   = new Konva.Layer({ listening: false }); // zonas y rótulos
const layer     = new Konva.Layer();                     // piezas
stage.add(gridLayer);
stage.add(uiLayer);
stage.add(layer);

// ----- Cuadrícula -----
function drawGrid() {
  gridLayer.destroyChildren();
  const w = stage.width(), h = stage.height();
  for (let x = 0; x <= w; x += GRID) {
    const X = Math.round(x) + 0.5;
    gridLayer.add(new Konva.Line({ points: [X,0,X,h], stroke: "#c7c7c7", strokeWidth: 1 }));
  }
  for (let y = 0; y <= h; y += GRID) {
    const Y = Math.round(y) + 0.5;
    gridLayer.add(new Konva.Line({ points: [0,Y,w,Y], stroke: "#c7c7c7", strokeWidth: 1 }));
  }
  gridLayer.draw();
}

// ----- Utils -----
const toCell = (n) => Math.round(n/GRID)*GRID;
const snap   = (x,y)=>({x:toCell(x), y:toCell(y)});
const center = ()=>({x:toCell(stage.width()/2), y:toCell(stage.height()/2)});
function speak(text){
  try{ const u=new SpeechSynthesisUtterance(text); u.lang="es-ES";
      speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{}
}

// ----- Zonas de construcción (posiciones relativas) -----
let ZONES = null;
function computeZones() {
  // margen y tamaños en celdas
  const margin = GRID;          // 1 celda de margen
  const tensW  = GRID*12, tensH = GRID*3;           // 12×3 celdas
  const hundW  = GRID*12, hundH = GRID*12;          // 12×12 celdas

  const tens = {
    x: margin,
    y: margin,
    w: tensW,
    h: tensH,
    label: "Zona Decenas",
  };
  const hund = {
    x: margin,
    y: tens.y + tens.h + GRID,  // debajo de decenas con 1 celda de separación
    w: hundW,
    h: hundH,
    label: "Zona Centenas",
  };
  ZONES = { tens, hund };
}

function drawZones() {
  uiLayer.destroyChildren();
  const { tens, hund } = ZONES;

  // Decenas
  uiLayer.add(new Konva.Rect({
    x: tens.x, y: tens.y, width: tens.w, height: tens.h,
    stroke: ZONE_STROKE, strokeWidth: 2, cornerRadius: 8, fill: ZONE_FILL
  }));
  uiLayer.add(new Konva.Text({
    x: tens.x + 6, y: tens.y + 6, text: tens.label, fontSize: 16, fill: ZONE_STROKE
  }));

  // Centenas
  uiLayer.add(new Konva.Rect({
    x: hund.x, y: hund.y, width: hund.w, height: hund.h,
    stroke: ZONE_STROKE, strokeWidth: 2, cornerRadius: 8, fill: ZONE_FILL
  }));
  uiLayer.add(new Konva.Text({
    x: hund.x + 6, y: hund.y + 6, text: hund.label, fontSize: 16, fill: ZONE_STROKE
  }));

  uiLayer.draw();
}

// Helper zona
function nodeBox(n){
  return { x: n.x(), y: n.y(), w: n.width(), h: n.height() };
}
function isInsideZone(n, zone){
  const b = nodeBox(n);
  return b.x >= zone.x && b.y >= zone.y &&
         (b.x + b.w) <= (zone.x + zone.w) &&
         (b.y + b.h) <= (zone.y + zone.h);
}

// ----- Contador + descomposición -----
function countAll(){
  let units=0, tens=0, hundreds=0;
  layer.getChildren().forEach(n=>{
    if (n.getClassName() !== 'Rect') return;
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

// ----- Comunes -----
function onDragEnd(shape){
  shape.on("dragend", ()=>{
    shape.position(snap(shape.x(), shape.y()));
    layer.draw();
    checkBuildZones();  // <— importante
    updateStatus();
  });
}
function onDouble(shape, cb){
  let lastTap=0, lastClick=0;
  shape.on('dbltap', cb);
  shape.on('dblclick', cb);
  shape.on('pointerdown', ()=>{
    const now=Date.now(); if (now-lastTap<300) cb(); lastTap=now;
  });
  shape.on('click', ()=>{
    const now=Date.now(); if (now-lastClick<300) cb(); lastClick=now;
  });
}

// ----- Piezas -----
function createUnit(x,y){
  const p=snap(x,y);
  const r=new Konva.Rect({ x:p.x, y:p.y, width:GRID, height:GRID, fill:COLORS.unit, draggable:true, name:'unit' });
  r.setAttr('btype','unit');
  onDragEnd(r);
  layer.add(r); layer.draw();
  checkBuildZones(); updateStatus();
  return r;
}
function createTen(x,y){
  const p=snap(x,y);
  const r=new Konva.Rect({ x:p.x, y:p.y, width:10*GRID, height:GRID, fill:COLORS.ten, draggable:true, name:'ten' });
  r.setAttr('btype','ten');
  onDragEnd(r);
  onDouble(r, ()=>{
    const start = snap(r.x(), r.y());
    r.destroy();
    for (let k=0;k<10;k++) createUnit(start.x + k*GRID, start.y);
    layer.draw(); checkBuildZones(); updateStatus();
  });
  layer.add(r); layer.draw();
  checkBuildZones(); updateStatus();
  return r;
}
function createHundred(x,y){
  const p=snap(x,y);
  const r=new Konva.Rect({ x:p.x, y:p.y, width:10*GRID, height:10*GRID, fill:COLORS.hundred, draggable:true, name:'hundred' });
  r.setAttr('btype','hundred');
  onDragEnd(r);
  onDouble(r, ()=>{
    const start = snap(r.x(), r.y());
    r.destroy();
    for (let row=0; row<10; row++) createTen(start.x, start.y + row*GRID);
    layer.draw(); checkBuildZones(); updateStatus();
  });
  layer.add(r); layer.draw();
  checkBuildZones(); updateStatus();
  return r;
}

// ----- Lógica de ZONAS -----

// 1) Zona DECENAS: 10 unidades => 1 decena
function composeTensInZone() {
  const { tens } = ZONES;
  // intentamos primero por filas contiguas (alineadas)
  let changed = false;

  // Mapa: y -> Map(x -> unitNode)
  const rows = new Map();
  layer.getChildren().forEach(n=>{
    if ((n.name()||n.getAttr('btype'))!=='unit') return;
    if (!isInsideZone(n, tens)) return;
    const y = n.y();
    const rowY = toCell(y);
    if (!rows.has(rowY)) rows.set(rowY, new Map());
    rows.get(rowY).set(toCell(n.x()), n);
  });

  // Buscar secuencias contiguas de 10
  rows.forEach((mapX, rowY)=>{
    // ordenar Xs
    const xs = Array.from(mapX.keys()).sort((a,b)=>a-b);
    for (let i=0; i<=xs.length-10; i++){
      let ok = true;
      for (let k=0;k<10;k++){
        if (!mapX.has(xs[i] + k*GRID)) { ok=false; break; }
      }
      if (ok) {
        // eliminar esas 10 unidades
        const units = [];
        for (let k=0;k<10;k++){
          const node = mapX.get(xs[i] + k*GRID);
          if (node && !node.destroyed()) units.push(node);
        }
        units.forEach(u=>u.destroy());
        // crear decena en el mismo row, desde X inicial
        createTen(xs[i], rowY);
        changed = true;
      }
    }
  });

  // Si no hubo filas contiguas, permitir 10 unidades cualesquiera dentro de la zona
  if (!changed) {
    const pool = [];
    layer.getChildren().forEach(n=>{
      if ((n.name()||n.getAttr('btype'))!=='unit') return;
      if (isInsideZone(n, tens)) pool.push(n);
    });
    if (pool.length >= 10) {
      // Tomar 10 primeras
      const anchorX = toCell(pool[0].x());
      const anchorY = toCell(pool[0].y());
      for (let i=0;i<10;i++) pool[i].destroy();
      createTen(anchorX, anchorY);
      changed = true;
    }
  }

  if (changed) { layer.draw(); }
  return changed;
}

// 2) Zona CENTENAS: 100 unidades o 10 decenas o combinación
function composeHundredsInZone() {
  const { hund } = ZONES;
  let changed = false;

  // Paso A: mientras haya >=10 unidades dentro, conviértelas en 1 decena
  while (true) {
    const units = [];
    layer.getChildren().forEach(n=>{
      if ((n.name()||n.getAttr('btype'))!=='unit') return;
      if (isInsideZone(n, hund)) units.push(n);
    });
    if (units.length < 10) break;
    // usar 10 primeras → decena
    const anchorX = toCell(units[0].x());
    const anchorY = toCell(units[0].y());
    for (let i=0;i<10;i++) units[i].destroy();
    createTen(anchorX, anchorY);
    changed = true;
  }

  // Paso B: mientras haya >=10 decenas dentro, conviértelas en 1 centena
  while (true) {
    const tens = [];
    layer.getChildren().forEach(n=>{
      if ((n.name()||n.getAttr('btype'))!=='ten') return;
      if (isInsideZone(n, hund)) tens.push(n);
    });
    if (tens.length < 10) break;
    const anchorX = toCell(tens[0].x());
    const anchorY = toCell(tens[0].y());
    for (let i=0;i<10;i++) tens[i].destroy();
    createHundred(anchorX, anchorY);
    changed = true;
  }

  if (changed) layer.draw();
  return changed;
}

// Llama a ambas zonas de forma iterativa hasta estabilidad
function checkBuildZones() {
  let changed;
  do {
    changed = false;
    if (composeTensInZone())     changed = true;
    if (composeHundredsInZone()) changed = true;
  } while (changed);
  updateStatus();
}

// ----- Botones (IDs de tu HTML) -----
function wireUI(){
  const $ = id => document.getElementById(id);
  $('btn-unit')   ?.addEventListener('click', ()=>{ const c=center(); createUnit(c.x,c.y); });
  $('btn-ten')    ?.addEventListener('click', ()=>{ const c=center(); createTen(c.x-5*GRID,c.y); });
  $('btn-hundred')?.addEventListener('click', ()=>{ const c=center(); createHundred(c.x-5*GRID,c.y-5*GRID); });
  $('btn-clear')  ?.addEventListener('click', ()=>{ layer.destroyChildren(); layer.draw(); updateStatus(); });
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

// ----- Resize & arranque -----
function layoutAll() {
  drawGrid();
  computeZones();
  drawZones();
  uiLayer.draw();
  layer.draw();
  updateStatus();
}
window.addEventListener("resize", ()=>{
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  layoutAll();
});

computeZones();
drawGrid();
drawZones();
wireUI();
updateStatus();
layer.draw();