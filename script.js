// ===== Bloques — script.js (para tu index.html) =====
const GRID = 32;
Konva.pixelRatio = 1;

const COLORS = { unit: "#1f78ff", ten: "#ff3b30", hundred: "#2ecc71" };

// ----- Stage y capas -----
const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});
const gridLayer = new Konva.Layer({ listening: false });
const layer     = new Konva.Layer();
stage.add(gridLayer);
stage.add(layer);

// ----- Cuadrícula visible -----
function drawGrid() {
  gridLayer.destroyChildren();
  const w = stage.width(), h = stage.height();
  for (let x=0; x<=w; x+=GRID){
    const X = Math.round(x) + 0.5;
    gridLayer.add(new Konva.Line({ points:[X,0,X,h], stroke:"#c7c7c7", strokeWidth:1 }));
  }
  for (let y=0; y<=h; y+=GRID){
    const Y = Math.round(y) + 0.5;
    gridLayer.add(new Konva.Line({ points:[0,Y,w,Y], stroke:"#c7c7c7", strokeWidth:1 }));
  }
  gridLayer.draw();
}
drawGrid();
window.addEventListener("resize", ()=>{
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  drawGrid(); layer.draw();
});

// ----- Utils -----
const toCell = n => Math.round(n/GRID)*GRID;
const snap   = (x,y)=>({x:toCell(x), y:toCell(y)});
const center = ()=>({x:toCell(stage.width()/2), y:toCell(stage.height()/2)});
function speak(text){
  try{ const u=new SpeechSynthesisUtterance(text); u.lang="es-ES";
       speechSynthesis.cancel(); speechSynthesis.speak(u); }catch{}
}

// ----- Contador + descomposición -----
function countAll(){
  let u=0,d=0,c=0;
  layer.find('Rect').each(n=>{
    const name = n.name();
    const t = name || n.getAttr('btype');
    if (t==='unit') u++;
    else if (t==='ten') d++;
    else if (t==='hundred') c++;
  });
  return { units:u, tens:d, hundreds:c, total: u + 10*d + 100*c };
}
function updateStatus(){
  const {units,tens,hundreds,total}=countAll();
  const st=document.getElementById("status");
  if(st) st.textContent = `Total: ${total} — ${hundreds} centenas, ${tens} decenas, ${units} unidades`;
  const b=document.getElementById("breakdown");
  if(b){
    b.innerHTML = `
      <div class="label">Centenas</div><div class="value">${hundreds} × 100 = ${hundreds*100}</div>
      <div class="label">Decenas</div><div class="value">${tens} × 10 = ${tens*10}</div>
      <div class="label">Unidades</div><div class="value">${units} × 1 = ${units}</div>
      <div class="label">Total</div><div class="value">${total}</div>`;
  }
}

// refrescar cuando cambia la capa o hay drag
layer.on('add', updateStatus);
layer.on('destroy', updateStatus);
stage.on('dragend', updateStatus);

// ----- Comportamientos comunes -----
function onDragEnd(shape){
  shape.on("dragend", ()=>{
    shape.position(snap(shape.x(), shape.y()));
    layer.draw(); updateStatus();
  });
}
// Doble gesto robusto (móvil y PC)
function onDouble(shape, cb){
  let lastTap=0, lastClick=0;
  shape.on('dbltap', cb);
  shape.on('dblclick', cb);
  shape.on('pointerdown', ()=>{ const now=Date.now(); if(now-lastTap<300) cb(); lastTap=now; });
  shape.on('click', ()=>{ const now=Date.now(); if(now-lastClick<300) cb(); lastClick=now; });
}

// ----- Piezas -----
function createUnit(x,y){
  const p=snap(x,y);
  const r=new Konva.Rect({
    x:p.x, y:p.y, width:GRID, height:GRID,
    fill:COLORS.unit, draggable:true, name:'unit'
  });
  r.setAttr('btype','unit');
  onDragEnd(r);
  layer.add(r);
  return r;
}

function createTen(x,y){
  const p=snap(x,y);
  const r=new Konva.Rect({
    x:p.x, y:p.y, width:10*GRID, height:GRID,
    fill:COLORS.ten, draggable:true, name:'ten'
  });
  r.setAttr('btype','ten');
  onDragEnd(r);

  // Decena -> 10 unidades
  onDouble(r, ()=>{
    const start=snap(r.x(), r.y());
    r.destroy();
    for(let k=0;k<10;k++){
      createUnit(start.x + k*GRID, start.y);
    }
    layer.draw(); updateStatus();
  });

  layer.add(r);
  return r;
}

function createHundred(x,y){
  const p=snap(x,y);
  const r=new Konva.Rect({
    x:p.x, y:p.y, width:10*GRID, height:10*GRID,
    fill:COLORS.hundred, draggable:true, name:'hundred'
  });
  r.setAttr('btype','hundred');
  onDragEnd(r);

  // Centena -> 10 decenas
  onDouble(r, ()=>{
    const start=snap(r.x(), r.y());
    r.destroy();
    for(let row=0; row<10; row++){
      createTen(start.x, start.y + row*GRID);
    }
    layer.draw(); updateStatus();
  });

  layer.add(r);
  return r;
}

// ----- Botones (IDs de tu HTML) -----
function wireUI(){
  const $ = id => document.getElementById(id);

  // Añadir piezas
  $('btn-unit')   ?.addEventListener('click', ()=>{ const c=center(); createUnit(c.x,c.y); layer.draw(); updateStatus(); });
  $('btn-ten')    ?.addEventListener('click', ()=>{ const c=center(); createTen(c.x-5*GRID,c.y); layer.draw(); updateStatus(); });
  $('btn-hundred')?.addEventListener('click', ()=>{ const c=center(); createHundred(c.x-5*GRID,c.y-5*GRID); layer.draw(); updateStatus(); });

  // Limpiar
  $('btn-clear')  ?.addEventListener('click', ()=>{ layer.destroyChildren(); layer.draw(); updateStatus(); });

  // Construir (desactivado mientras comprobamos descomposición)
  $('btn-compose')?.addEventListener('click', ()=>{ /* luego activamos auto-compose */ });

  // Leer número
  $('btn-say')    ?.addEventListener('click', ()=>{
    const {units,tens,hundreds,total}=countAll();
    speak(`Tienes ${hundreds} centenas, ${tens} decenas y ${units} unidades. Total: ${total}.`);
  });

  // Reto
  $('btn-challenge')?.addEventListener('click', ()=>{
    const n=Math.floor(Math.random()*900)+100;
    const ch=$('challenge'); if(ch) ch.textContent=`Forma el número ${n}`;
  });

  // Panel detalles
  $('panel-toggle')?.addEventListener('click', ()=>{
    const panel=$('panel');
    const open=panel.classList.toggle('open');
    const btn=$('panel-toggle');
    btn.textContent = open ? '⬇︎ Ocultar detalles' : '⬆︎ Detalles';
    btn.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
  });
}

wireUI();
updateStatus();
layer.draw();