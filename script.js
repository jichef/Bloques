// ===== Parámetros y fixes =====
const GRID = 32;
const UNIT_SIZE = GRID;
const COLORS = { unit: "blue", ten: "red", hundred: "green" };
const GRID_COLOR = "#c7c7c7";
const DOUBLE_TAP_MS = 300;
Konva.pixelRatio = 1; // evitar HiDPI raro

// ===== Stage y capas =====
const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});
const gridLayer = new Konva.Layer({ listening: false });
const layer = new Konva.Layer();
stage.add(gridLayer);
stage.add(layer);

// ===== Utilidades =====
const toCell = (n) => Math.round(n / GRID) * GRID;
const snapToGrid = (x, y) => ({ x: toCell(x), y: toCell(y) });
function speak(t){ try{ const u=new SpeechSynthesisUtterance(t); u.lang="es-ES"; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{} }
const centerPos = () => ({ x: toCell(stage.width()/2), y: toCell(stage.height()/2) });

// ===== Cuadrícula =====
function drawGrid() {
  gridLayer.destroyChildren();
  const w = stage.width(), h = stage.height();
  for (let x = 0; x <= w; x += GRID) {
    const X = Math.round(x) + 0.5;
    gridLayer.add(new Konva.Line({ points: [X,0,X,h], stroke: GRID_COLOR, strokeWidth: 1, listening:false }));
  }
  for (let y = 0; y <= h; y += GRID) {
    const Y = Math.round(y) + 0.5;
    gridLayer.add(new Konva.Line({ points: [0,Y,w,Y], stroke: GRID_COLOR, strokeWidth: 1, listening:false }));
  }
  gridLayer.draw();
}

// ===== Estado y descomposición =====
function countAll(){
  let units=0,tens=0,hundreds=0;
  layer.children.each(n=>{
    const t=n.getAttr("btype");
    if(t==="unit") units++;
    else if(t==="ten") tens++;
    else if(t==="hundred") hundreds++;
  });
  return { units,tens,hundreds,total: units + 10*tens + 100*hundreds };
}
function updateStatus(){
  const {units,tens,hundreds,total}=countAll();
  document.getElementById("status").innerText = `Total: ${total} — ${hundreds} centenas, ${tens} decenas, ${units} unidades`;
  const b=document.getElementById("breakdown");
  if(b){
    b.innerHTML = `
      <div class="label">Centenas</div><div class="value">${hundreds} × 100 = ${hundreds*100}</div>
      <div class="label">Decenas</div><div class="value">${tens} × 10 = ${tens*10}</div>
      <div class="label">Unidades</div><div class="value">${units} × 1 = ${units}</div>
      <div class="label">Total</div><div class="value">${total}</div>`;
  }
}

// ===== Interacción piezas =====
function commonDragBehavior(shape){
  shape.on("dragend", ()=>{
    shape.position(snapToGrid(shape.x(), shape.y()));
    layer.draw(); updateStatus();
  });
}
function addDoubleTapHandler(shape, onDT){
  let lastTap=0,lastClick=0;
  shape.on("pointerdown", ()=>{ const now=Date.now(); if(now-lastTap<DOUBLE_TAP_MS) onDT(); lastTap=now; });
  shape.on("dblclick", onDT);
  shape.on("click", ()=>{ const now=Date.now(); if(now-lastClick<DOUBLE_TAP_MS) onDT(); lastClick=now; });
}

// ===== Piezas =====
function createUnit(x,y){
  const p=snapToGrid(x,y);
  const rect=new Konva.Rect({ x:p.x,y:p.y,width:UNIT_SIZE,height:UNIT_SIZE,fill:COLORS.unit,draggable:true,strokeEnabled:false });
  rect.setAttr("btype","unit");
  commonDragBehavior(rect);
  layer.add(rect); layer.draw(); updateStatus();
}
function createTen(x,y){
  const p=snapToGrid(x,y);
  const rect=new Konva.Rect({ x:p.x,y:p.y,width:10*GRID,height:GRID,fill:COLORS.ten,draggable:true,strokeEnabled:false });
  rect.setAttr("btype","ten");
  commonDragBehavior(rect);
  addDoubleTapHandler(rect, ()=>{
    const start=snapToGrid(rect.x(), rect.y());
    rect.destroy();
    for(let k=0;k<10;k++) createUnit(start.x + k*GRID, start.y);
    layer.draw(); updateStatus();
  });
  layer.add(rect); layer.draw(); updateStatus();
}
function createHundred(x,y){
  const p=snapToGrid(x,y);
  const rect=new Konva.Rect({ x:p.x,y:p.y,width:10*GRID,height:10*GRID,fill:COLORS.hundred,draggable:true,strokeEnabled:false });
  rect.setAttr("btype","hundred");
  commonDragBehavior(rect);
  addDoubleTapHandler(rect, ()=>{
    const start=snapToGrid(rect.x(), rect.y());
    rect.destroy();
    for(let r=0;r<10;r++) createTen(start.x, start.y + r*GRID);
    layer.draw(); updateStatus();
  });
  layer.add(rect); layer.draw(); updateStatus();
}

// ===== Composición automática =====
function indexByGrid(){
  const m=new Map();
  layer.children.each(n=>{
    const t=n.getAttr("btype"); if(!t) return;
    const p=snapToGrid(n.x(),n.y());
    m.set(`${p.x},${p.y}`, n);
  });
  return m;
}
function removeNodes(nodes){ nodes.forEach(n=>n.destroy()); }
function tryComposeTensFromUnits(grid){
  const composed=[];
  grid.forEach((node,key)=>{
    if(node.getAttr("btype")!=="unit") return;
    const [xs,ys]=key.split(","); const x0=+xs,y0=+ys;
    const seq=[];
    for(let k=0;k<10;k++){
      const n=grid.get(`${x0+k*GRID},${y0}`);
      if(!n || n.getAttr("btype")!=="unit") return;
      seq.push(n);
    }
    composed.push({x:x0,y:y0,nodes:seq});
  });
  composed.forEach(({x,y,nodes})=>{
    if(nodes.some(n=>n.destroyed())) return;
    removeNodes(nodes); createTen(x,y);
  });
  return composed.length>0;
}
function tryComposeHundredsFromTens(grid){
  const composed=[];
  grid.forEach((node,key)=>{
    if(node.getAttr("btype")!=="ten") return;
    const [xs,ys]=key.split(","); const x0=+xs,y0=+ys;
    const seq=[];
    for(let r=0;r<10;r++){
      const n=grid.get(`${x0},${y0+r*GRID}`);
      if(!n || n.getAttr("btype")!=="ten") return;
      seq.push(n);
    }
    composed.push({x:x0,y:y0,nodes:seq});
  });
  composed.forEach(({x,y,nodes})=>{
    if(nodes.some(n=>n.destroyed())) return;
    removeNodes(nodes); createHundred(x,y);
  });
  return composed.length>0;
}
function tryComposeHundredsFromUnits(grid){
  const composed=[];
  grid.forEach((node,key)=>{
    if(node.getAttr("btype")!=="unit") return;
    const [xs,ys]=key.split(","); const x0=+xs,y0=+ys;
    const all=[];
    for(let r=0;r<10;r++){
      for(let c=0;c<10;c++){
        const n=grid.get(`${x0+c*GRID},${y0+r*GRID}`);
        if(!n || n.getAttr("btype")!=="unit") return;
        all.push(n);
      }
    }
    composed.push({x:x0,y:y0,nodes:all});
  });
  composed.forEach(({x,y,nodes})=>{
    if(nodes.some(n=>n.destroyed())) return;
    removeNodes(nodes); createHundred(x,y);
  });
  return composed.length>0;
}
function autoCompose(){
  let changed=false;
  do{
    changed=false;
    let grid=indexByGrid(); if(tryComposeTensFromUnits(grid)) changed=true;
    grid=indexByGrid(); if(tryComposeHundredsFromTens(grid)) changed=true;
    grid=indexByGrid(); if(tryComposeHundredsFromUnits(grid)) changed=true;
  }while(changed);
  layer.draw(); updateStatus();
}

// ===== Panel =====
function togglePanel(){
  const panel=document.getElementById("panel");
  const btn=document.getElementById("panel-toggle");
  const open=panel.classList.toggle("open");
  if(open) panel.classList.remove("closed");
  btn.textContent=open?"⬇︎ Ocultar detalles":"⬆︎ Detalles";
  btn.setAttribute("aria-expanded", String(open));
  panel.setAttribute("aria-hidden", String(!open));
}

// ===== Enlazar botones SIN onclick inline =====
function wireUI(){
  document.getElementById("btn-unit").addEventListener("click", ()=>{ const c=centerPos(); createUnit(c.x,c.y); });
  document.getElementById("btn-ten").addEventListener("click",  ()=>{ const c=centerPos(); createTen(c.x-5*GRID,c.y); });
  document.getElementById("btn-hundred").addEventListener("click", ()=>{ const c=centerPos(); createHundred(c.x-5*GRID,c.y-5*GRID); });
  document.getElementById("btn-clear").addEventListener("click", clearAll);
  document.getElementById("btn-compose").addEventListener("click", autoCompose);
  document.getElementById("btn-say").addEventListener("click", sayCurrent);
  document.getElementById("btn-challenge").addEventListener("click", newChallenge);
  document.getElementById("panel-toggle").addEventListener("click", togglePanel);
}
function clearAll(){ layer.destroyChildren(); layer.draw(); updateStatus(); }
function sayCurrent(){ const {units,tens,hundreds,total}=countAll(); speak(`Tienes ${hundreds} centenas, ${tens} decenas y ${units} unidades. Total: ${total}.`); }
function newChallenge(){ const target=Math.floor(Math.random()*900)+100; const el=document.getElementById("challenge"); el.textContent=`Forma el número ${target}`; speak(`Reto: forma el número ${target}`); }

// ===== Resize y arranque =====
function resize(){ stage.width(window.innerWidth); stage.height(window.innerHeight); drawGrid(); layer.draw(); }

window.addEventListener("resize", resize);
window.addEventListener("DOMContentLoaded", ()=>{
  drawGrid();
  wireUI();       // 👈 ahora sí conectamos los botones
  updateStatus();
});