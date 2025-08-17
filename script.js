// ===== Bloques — script.js =====
const GRID = 32;
Konva.pixelRatio = 1;

const COLORS = { unit: "#1f78ff", ten: "#ff3b30", hundred: "#2ecc71" };

// ----- Stage y capas
const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});
const gridLayer = new Konva.Layer({ listening: false });
const layer     = new Konva.Layer();
stage.add(gridLayer);
stage.add(layer);

// ----- Cuadrícula visible
function drawGrid() {
  gridLayer.destroyChildren();
  const w = stage.width(), h = stage.height();
  for (let x = 0; x <= w; x += GRID) {
    const X = Math.round(x) + 0.5;
    gridLayer.add(new Konva.Line({ points:[X,0,X,h], stroke:"#c7c7c7", strokeWidth:1 }));
  }
  for (let y = 0; y <= h; y += GRID) {
    const Y = Math.round(y) + 0.5;
    gridLayer.add(new Konva.Line({ points:[0,Y,w,Y], stroke:"#c7c7c7", strokeWidth:1 }));
  }
  gridLayer.draw();
}

// ----- Utils
const toCell     = n => Math.round(n/GRID)*GRID;
const snapToGrid = (x,y)=>({x:toCell(x), y:toCell(y)});
const centerPos  = ()=>({x:toCell(stage.width()/2), y:toCell(stage.height()/2)});

// ----- Estado + descomposición
function countAll(){
  let u=0,d=0,c=0;
  layer.children.each(n=>{
    const t = n.getAttr("btype");
    if (t==="unit") u++;
    else if (t==="ten") d++;
    else if (t==="hundred") c++;
  });
  return { units:u, tens:d, hundreds:c, total: u + 10*d + 100*c };
}
function updateStatus(){
  const {units,tens,hundreds,total} = countAll();
  const st = document.getElementById("status");
  if (st) st.textContent = `Total: ${total} — ${hundreds} centenas, ${tens} decenas, ${units} unidades`;
  const b = document.getElementById("breakdown");
  if (b) {
    b.innerHTML = `
      <div class="label">Centenas</div><div class="value">${hundreds} × 100 = ${hundreds*100}</div>
      <div class="label">Decenas</div><div class="value">${tens} × 10 = ${tens*10}</div>
      <div class="label">Unidades</div><div class="value">${units} × 1 = ${units}</div>
      <div class="label">Total</div><div class="value">${total}</div>`;
  }
}

// ----- Comportamientos comunes
function onDragEnd(shape){
  shape.on("dragend", ()=>{
    const p = snapToGrid(shape.x(), shape.y());
    shape.position(p);
    layer.draw(); updateStatus();
  });
}
function onDouble(shape, cb){
  let lastTap = 0, lastClick = 0;
  shape.on("pointerdown", ()=>{
    const now = Date.now();
    if (now - lastTap < 300) cb();
    lastTap = now;
  });
  shape.on("dblclick", cb);
  shape.on("click", ()=>{
    const now = Date.now();
    if (now - lastClick < 300) cb();
    lastClick = now;
  });
}

// ----- Piezas
function createUnit(x,y){
  const p = snapToGrid(x,y);
  const r = new Konva.Rect({
    x:p.x, y:p.y, width:GRID, height:GRID,
    fill:COLORS.unit, draggable:true
  });
  r.setAttr("btype","unit");
  onDragEnd(r);
  layer.add(r); layer.draw(); updateStatus();
  return r;
}

function createTen(x,y){
  const p = snapToGrid(x,y);
  const r = new Konva.Rect({
    x:p.x, y:p.y, width:10*GRID, height:GRID,
    fill:COLORS.ten, draggable:true
  });
  r.setAttr("btype","ten");
  onDragEnd(r);

  // ▼▼ Descomponer DECENA -> 10 UNIDADES ▼▼
  onDouble(r, ()=>{
    const start = snapToGrid(r.x(), r.y());
    r.destroy();
    // IMPORTANTE: 10 unidades separadas horizontalmente
    for (let k=0; k<10; k++){
      createUnit(start.x + k*GRID, start.y);
    }
    layer.draw(); updateStatus();
  });

  layer.add(r); layer.draw(); updateStatus();
  return r;
}

function createHundred(x,y){
  const p = snapToGrid(x,y);
  const r = new Konva.Rect({
    x:p.x, y:p.y, width:10*GRID, height:10*GRID,
    fill:COLORS.hundred, draggable:true
  });
  r.setAttr("btype","hundred");
  onDragEnd(r);

  // ▼▼ Descomponer CENTENA -> 10 DECENAS ▼▼
  onDouble(r, ()=>{
    const start = snapToGrid(r.x(), r.y());
    r.destroy();
    for (let row=0; row<10; row++){
      createTen(start.x, start.y + row*GRID);
    }
    layer.draw(); updateStatus();
  });

  layer.add(r); layer.draw(); updateStatus();
  return r;
}

// ----- Composición automática (opcional: simple)
function indexByGrid(){
  const m=new Map();
  layer.children.each(n=>{
    const t=n.getAttr("btype"); if(!t) return;
    const p=snapToGrid(n.x(),n.y());
    m.set(`${p.x},${p.y}`, n);
  });
  return m;
}
function removeNodes(ns){ ns.forEach(n=>n.destroy()); }

function tryComposeTensFromUnits(grid){
  const composed=[];
  grid.forEach((node,key)=>{
    if(node.getAttr("btype")!=="unit") return;
    const [xs,ys]=key.split(","); const x0=+xs, y0=+ys;
    const seq=[];
    for(let k=0;k<10;k++){
      const n = grid.get(`${x0 + k*GRID},${y0}`);
      if (!n || n.getAttr("btype")!=="unit") return;
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
    const [xs,ys]=key.split(","); const x0=+xs, y0=+ys;
    const seq=[];
    for(let r=0;r<10;r++){
      const n = grid.get(`${x0},${y0 + r*GRID}`);
      if (!n || n.getAttr("btype")!=="ten") return;
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

function autoCompose(){
  let changed=false;
  do{
    changed=false;
    let grid=indexByGrid(); if(tryComposeTensFromUnits(grid)) changed=true;
    grid=indexByGrid(); if(tryComposeHundredsFromTens(grid)) changed=true;
  }while(changed);
  layer.draw(); updateStatus();
}

// ----- Botones (IDs: btn-unit / btn-ten / btn-hundred / btn-compose / btn-clear / btn-say / btn-challenge / panel-toggle)
function wireUI(){
  const $ = id => document.getElementById(id);
  $("btn-unit").addEventListener("click", ()=>{
    const c=centerPos(); createUnit(c.x,c.y);
  });
  $("btn-ten").addEventListener("click", ()=>{
    const c=centerPos(); createTen(c.x-5*GRID,c.y);
  });
  $("btn-hundred").addEventListener("click", ()=>{
    const c=centerPos(); createHundred(c.x-5*GRID, c.y-5*GRID);
  });
  $("btn-compose").addEventListener("click", autoCompose);
  $("btn-clear").addEventListener("click", ()=>{ layer.destroyChildren(); layer.draw(); updateStatus(); });
  $("btn-say").addEventListener("click", ()=>{
    const {units,tens,hundreds,total}=countAll();
    const u=new SpeechSynthesisUtterance(`Tienes ${hundreds} centenas, ${tens} decenas y ${units} unidades. Total: ${total}.`);
    u.lang="es-ES"; try{ speechSynthesis.cancel(); speechSynthesis.speak(u);}catch{}
  });
  $("btn-challenge").addEventListener("click", ()=>{
    const n=Math.floor(Math.random()*900)+100;
    const ch=$("challenge"); if (ch) ch.textContent=`Forma el número ${n}`;
  });
  $("panel-toggle").addEventListener("click", ()=>{
    const panel=$("panel");
    const open=panel.classList.toggle("open");
    const btn=$("panel-toggle");
    btn.textContent=open?"⬇︎ Ocultar detalles":"⬆︎ Detalles";
  });
}

// ----- Arranque
window.addEventListener("resize", ()=>{
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  drawGrid(); layer.draw();
});
drawGrid();
wireUI();
updateStatus();