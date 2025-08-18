// ===== Bloques — script.js (v17.0.0: modos Construcción + Sumas, zonas ancladas a viewport, SPAWN visible sin solapes) =====
console.log("Bloques v17.0.0");

Konva.pixelRatio = 1;

const GRID = 32;
const COLORS = { unit: "#1f78ff", ten: "#ff3b30", hundred: "#2ecc71" };
const ZONE_STROKE = "#6c5ce7";
const ZONE_FILL   = "rgba(108,92,231,0.06)";
const CHIP_STYLE = {
  stroke:"#1a1a1a", strokeWidth:1, cornerRadius:6,
  shadowColor:"rgba(0,0,0,0.4)", shadowBlur:6, shadowOffsetX:3, shadowOffsetY:3, shadowOpacity:0.25
};

// Mundo
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
// ---- MODO & SUMAS ----
let modo = 'construccion';           // 'construccion' | 'suma'

let SUM = { a: null, b: null };      // objetivos del modo suma
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


// ===== Zonas ancladas al VIEWPORT =====
let ZONES = null;
let zoneTenRect=null, zoneHundRect=null; // (solo en construcción)
let zoneA=null, zoneB=null, zoneR=null;  // (solo en sumas)
let zoneARect=null, zoneBRect=null, zoneRRect=null;

// Margen y espaciado relativos al viewport
const VIEW_M = GRID*3; // ~96px izquierda
const VIEW_T = GRID*3; // ~96px top
const GAP_V  = GRID*2; // vertical

// --- Construcción: zonas Decenas/Centenas (como tenías)
function computeZonesConstruccion(){
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
function drawZonesConstruccion(){
  uiLayer.destroyChildren();
  const {tens, hund} = ZONES;
  zoneTenRect  = new Konva.Rect({ x:tens.x,y:tens.y,width:tens.w,height:tens.h, stroke:ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill:ZONE_FILL});
  const tenLbl = new Konva.Text({ x:tens.x+6, y:tens.y-22, text:tens.label, fontSize:16, fill:ZONE_STROKE});
  zoneHundRect = new Konva.Rect({ x:hund.x,y:hund.y,width:hund.w,height:hund.h, stroke:ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill:ZONE_FILL});
  const hunLbl = new Konva.Text({ x:hund.x+6, y:hund.y-22, text:hund.label, fontSize:16, fill:ZONE_STROKE});
  uiLayer.add(zoneTenRect, tenLbl, zoneHundRect, hunLbl);
  uiLayer.draw();
}

// --- Sumas: Sumando A / Sumando B / Resultado
function computeZonesSumas(){
  const v = visibleWorldRect();
  const bandW = Math.min(v.w - VIEW_M*2, GRID*40);
  const colW = Math.max(GRID*10, Math.floor(bandW/3) - GRID); // 3 columnas
  const colH = GRID*12;

  const baseX = toCell(v.x + VIEW_M);
  const baseY = toCell(v.y + VIEW_T);

  zoneA = { x: baseX + 0*(colW+GRID), y: baseY, w: colW, h: colH, label: "Sumando A" };
  zoneB = { x: baseX + 1*(colW+GRID), y: baseY, w: colW, h: colH, label: "Sumando B" };
  zoneR = { x: baseX + 2*(colW+GRID), y: baseY, w: colW, h: colH, label: "Resultado" };

  ZONES = { A: zoneA, B: zoneB, R: zoneR };
}
function drawZonesSumas(){
  uiLayer.destroyChildren();

  zoneARect = new Konva.Rect({ x:zoneA.x, y:zoneA.y, width:zoneA.w, height:zoneA.h, stroke:ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill:ZONE_FILL });
  const aLbl = new Konva.Text({ x:zoneA.x+6, y:zoneA.y-22, text:zoneA.label, fontSize:16, fill: ZONE_STROKE });

  zoneBRect = new Konva.Rect({ x:zoneB.x, y:zoneB.y, width:zoneB.w, height:zoneB.h, stroke:ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill:ZONE_FILL });
  const bLbl = new Konva.Text({ x:zoneB.x+6, y:zoneB.y-22, text:zoneB.label, fontSize:16, fill: ZONE_STROKE });

  zoneRRect = new Konva.Rect({ x:zoneR.x, y:zoneR.y, width:zoneR.w, height:zoneR.h, stroke:ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill:ZONE_FILL });
  const rLbl = new Konva.Text({ x:zoneR.x+6, y:zoneR.y-22, text:zoneR.label, fontSize:16, fill: ZONE_STROKE });

  uiLayer.add(zoneARect, aLbl, zoneBRect, bLbl, zoneRRect, rLbl);
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
function applyModeUI(){
  const el = (id)=>document.getElementById(id);

  const challengeEl = el('challenge');
  const btnChallenge = el('btn-challenge');
  const btnNewSum = el('btn-new-sum');     // botón "Nueva suma" (si está en tu HTML)
  const sumInfo   = el('sum-info');        // un span/div para mostrar "a + b = ?"

  if (modo === 'suma'){
    // Oculta reto en modo suma
    if (challengeEl)  challengeEl.style.display = 'none';
    if (btnChallenge) btnChallenge.style.display = 'none';

    // Muestra controles/info de suma si existen
    if (btnNewSum) btnNewSum.style.display = '';
    if (sumInfo)   sumInfo.style.display   = '';

  } else {
    // Modo construcción clásico
    if (challengeEl)  challengeEl.style.display = '';
    if (btnChallenge) btnChallenge.style.display = '';

    if (btnNewSum) btnNewSum.style.display = 'none';
    if (sumInfo)   sumInfo.style.display   = 'none';
  }
}

function setMode(newMode){
  modo = newMode;
  if (modo === 'suma'){
    computeZonesSumas?.();      // si ya tienes estas funciones, se usan
    drawZonesSumas?.();
  } else {
    computeZonesAnchoredToViewport();
    drawZones();
  }
  resetSpawnBase();
  applyModeUI();
  updateStatus();
}
function newSum(){
  // Elige dos sumandos "amigables" (ajusta rango a tu gusto)
  const r = (min,max)=> Math.floor(Math.random()*(max-min+1))+min;
  const a = r(6, 49);
  const b = r(6, 49);

  SUM.a = a; SUM.b = b;

  // Muestra el enunciado si existe un contenedor
  const sumInfo = document.getElementById('sum-info');
  if (sumInfo) sumInfo.textContent = `🧮 Suma: ${a} + ${b}  →  construye los sumandos en sus zonas y coloca el resultado en "Resultado"`;

  // Limpia piezas (opcional). Si prefieres no limpiar, comenta estas dos líneas.
  pieceLayer.destroyChildren();
  pieceLayer.draw();

  // Recoloca zonas de suma si tus funciones las crean por viewport
  if (modo === 'suma'){
    computeZonesSumas?.();
    drawZonesSumas?.();
    resetSpawnBase();
  }

  // Feedback de voz
  speak(`Nueva suma. ${a} más ${b}`);
}

// ===== SPAWN dentro del área visible, sin solapes =====
const SPAWN = { baseX:0, baseY:0, curX:0, curY:0, rowH:GRID*2, band:{x:0,y:0,w:0,h:0} };

// Candidatos en orden: derecha → abajo → izquierda → fallback (siempre respecto a la zona principal del modo)
function computeSpawnBandInView(){
  const v = visibleWorldRect();
  const pad=GRID, gap=GRID*3;

  // Selecciona un rectángulo “referencia” según el modo
  let ref = null;
  if (modo === 'construccion' && ZONES?.hund) ref = ZONES.hund;
  if (modo === 'sumas' && ZONES?.R)          ref = ZONES.R;
  if (!ref) ref = { x:v.x + VIEW_M, y:v.y + VIEW_T, w:GRID*10, h:GRID*10 };

  const clampBand=(x,y,w,h)=>({
    x: toCell(Math.max(v.x+pad, Math.min(x, v.x+v.w-pad))),
    y: toCell(Math.max(v.y+pad, Math.min(y, v.y+v.h-pad))),
    w: Math.max(0, Math.min(w, v.x+v.w-pad - Math.max(v.x+pad, x))),
    h: Math.max(0, Math.min(h, v.y+v.h-pad - Math.max(v.y+pad, y))),
  });
  const ok=b=> b.w>=GRID*3 && b.h>=GRID*2;

  // derecha del ref
  const right = clampBand(ref.x+ref.w+gap, ref.y+pad, (v.x+v.w)-(ref.x+ref.w+gap)-pad, Math.min(ref.h-2*pad, v.h-2*pad));
  if (ok(right)) return right;

  // abajo del ref
  const below = clampBand(ref.x, ref.y+ref.h+gap, Math.min(v.w-2*pad, ref.w), (v.y+v.h)-(ref.y+ref.h+gap)-pad);
  if (ok(below)) return below;

  // izquierda del ref
  const left = clampBand(v.x+pad, ref.y+pad, (ref.x-gap)-(v.x+pad), Math.min(ref.h-2*pad, v.h-2*pad));
  if (ok(left)) return left;

  // Fallback: esquina sup-dcha del viewport
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
  // Último recurso: esquina sup-dcha del viewport
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
  // Construcción: tu estado clásico
  if (modo === 'construccion'){
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
    return;
  }

  // Sumas: muestra A + B = R
  const a = countInRect(zoneA);
  const b = countInRect(zoneB);
  const r = countInRect(zoneR);
  const st=document.getElementById('status');
  if(st) st.textContent = `A: ${a.total}  +  B: ${b.total}  =  Resultado: ${r.total}`;
  const bd=document.getElementById('breakdown');
  if (bd){
    bd.innerHTML = `
      <div class="label">A (c=×100,d=×10,u=×1)</div><div class="value">${a.hundreds}c, ${a.tens}d, ${a.units}u → ${a.total}</div>
      <div class="label">B (c=×100,d=×10,u=×1)</div><div class="value">${b.hundreds}c, ${b.tens}d, ${b.units}u → ${b.total}</div>
      <div class="label">A+B</div><div class="value">${a.total + b.total}</div>
      <div class="label">Resultado</div><div class="value">${r.total}</div>
    `;
  }
  const ch = document.getElementById('challenge');
  if (ch){
    if (r.total === a.total + b.total && (a.total>0 || b.total>0)){
      ch.textContent = `🎉 ¡Perfecto! ${a.total} + ${b.total} = ${r.total}`;
    }else{
      ch.textContent = `➕ Construye: A + B = Resultado`;
    }
  }
}

// ===== Reordenaciones/zonas “Construcción” =====
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

// ===== Sumas: conteo por zona =====
function countInRect(zone){
  if (!zone) return { units:0,tens:0,hundreds:0,total:0 };
  const arr=childrenGroups();
  let u=0,t=0,h=0;
  for (let i=0;i<arr.length;i++){
    const g=arr[i], b=boxForGroup(g), tp=pieceType(g);
    const inside = (b.x+b.w/2>=zone.x && b.x+b.w/2<=zone.x+zone.w && b.y+b.h/2>=zone.y && b.y+b.h/2<=zone.y+zone.h);
    if (!inside) continue;
    if (tp==='unit') u++;
    else if (tp==='ten') t++;
    else if (tp==='hundred') h++;
  }
  return { units:u, tens:t, hundreds:h, total:u + 10*t + 100*h };
}

// ===== Eventos comunes =====
function onDragEnd(group){
  group.on('dragend', ()=>{
    group.position(snap(group.x(), group.y()));
    const type = pieceType(group);
    const b = boxForGroup(group);

    if (modo==='construccion'){
      if (type==='unit' && rectsIntersect(b, ZONES.tens)) { group.position(snap(ZONES.tens.x, ZONES.tens.y)); reorderTensZone(); checkBuildZones(); }
      if ((type==='unit'||type==='ten') && rectsIntersect(b, ZONES.hund)) { group.position(snap(ZONES.hund.x, ZONES.hund.y)); reorderHundredsZone(); checkBuildZones(); }
    }

    // En sumas no recolocamos automáticamente; solo contamos y validamos
    pieceLayer.draw(); updateStatus();
  });
}
function onDouble(group, cb){
  let lastTap=0,lastClick=0;
  group.on('dbltap', cb); group.on('dblclick', cb);
  group.on('pointerdown', ()=>{ const now=Date.now(); if(now-lastTap<300) cb(); lastTap=now; });
  group.on('click',       ()=>{ const now=Date.now(); if(now-lastClick<300) cb(); lastClick=now; });
}

// ===== Crear piezas (usa SPAWN) =====
function addChipRectTo(g,w,h,fill){ g.add(new Konva.Rect({x:0,y:0,width:w,height:h,fill,...CHIP_STYLE})); }
function createUnit(x,y){
  const w=GRID,h=GRID;
  let pos; if (x==null||y==null){ const r=findSpawnRect(w,h); pos={x:r.x,y:r.y}; advanceSpawn(w,h);} else pos=snap(x,y);
  const g=new Konva.Group({ x:pos.x,y:pos.y, draggable:true, name:'unit' }); g.setAttr('btype','unit'); addChipRectTo(g,w,h,COLORS.unit);
  onDragEnd(g); pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}
function createTen(x,y){
  const w=10*GRID,h=GRID;
  let pos; if (x==null||y==null){ const r=findSpawnRect(w,h); pos={x:r.x,y:r.y}; advanceSpawn(w,h);} else pos=snap(x,y);
  const g=new Konva.Group({ x:pos.x,y:pos.y, draggable:true, name:'ten' }); g.setAttr('btype','ten'); addChipRectTo(g,w,h,COLORS.ten);
  onDragEnd(g);
  onDouble(g, ()=>{ const start=snap(g.x(),g.y()); g.destroy(); for(let k=0;k<10;k++) createUnit(start.x+k*GRID, start.y); pieceLayer.draw(); checkBuildZones(); updateStatus(); });
  pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}
function createHundred(x,y){
  const w=10*GRID,h=10*GRID;
  let pos; if (x==null||y==null){ const r=findSpawnRect(w,h); pos={x:r.x,y:r.y}; advanceSpawn(w,h);} else pos=snap(x,y);
  const g=new Konva.Group({ x:pos.x,y:pos.y, draggable:true, name:'hundred' }); g.setAttr('btype','hundred'); addChipRectTo(g,w,h,COLORS.hundred);
  onDragEnd(g);
  onDouble(g, ()=>{ const start=snap(g.x(),g.y()); g.destroy(); for(let row=0;row<10;row++) createTen(start.x, start.y+row*GRID); pieceLayer.draw(); checkBuildZones(); updateStatus(); });
  pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}

// ===== Construcción: composición automática en zonas =====
function composeTensInZone(){
  if(modo!=='construccion' || !zoneTenRect) return false;
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
  if(modo!=='construccion' || !zoneHundRect) return false;
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
  if (modo!=='construccion'){ updateStatus(); return; }
  let changed; do{ changed=false; if(composeTensInZone()) changed=true; if(composeHundredsInZone()) changed=true; }while(changed);
  reorderTensZone(); reorderHundredsZone(); updateStatus();
}

// ===== Botonera =====
// ====== Helpers: crear/injectar UI que falta ======
function ensureModeButton(){
  const controls = document.getElementById('controls');
  if (!controls) return;
  if (document.getElementById('btn-mode')) return;

  const row = document.createElement('div');
  row.className = 'row';
  const btn = document.createElement('button');
  btn.id = 'btn-mode';
  btn.textContent = 'Modo: Construcción';
  btn.addEventListener('click', ()=>{
    modo = (modo === 'construccion') ? 'sumas' : 'construccion';
    btn.textContent = 'Modo: ' + (modo === 'construccion' ? 'Construcción' : 'Sumas');
    enterMode(modo);
  });
  row.appendChild(btn);
  controls.prepend(row);
}

function ensureSumInfo(){
  // crea un contenedor textual para el enunciado (si no existe)
  if (document.getElementById('sum-info')) return;
  const controls = document.getElementById('controls');
  if (!controls) return;

  const row = document.createElement('div');
  row.className = 'row';
  const span = document.createElement('span');
  span.id = 'sum-info';
  span.style.display = 'none';
  row.appendChild(span);
  controls.appendChild(row);
}

// ====== Estado global de modo/ejercicio ======
          
let ejercicio = null;                   // { tipo:'suma'|'resta', a:number, b:number }

// ====== Helpers UI de modo ======
// ====== Helpers UI de modo (arreglado) ======
function setUIForMode(){
  ensureSumInfo();

  const btnChallenge = document.getElementById('btn-challenge');
  const challengeTxt = document.getElementById('challenge');
  const sumInfo      = document.getElementById('sum-info');
  const btnSum       = document.getElementById('btn-sum'); // <- tus IDs reales
  const btnSub       = document.getElementById('btn-sub');

  if (modo === 'construccion'){
    // Mostrar reto, ocultar enunciado y botones de suma/resta
    if (btnChallenge) btnChallenge.style.display = '';
    if (challengeTxt) challengeTxt.style.display = '';
    if (sumInfo)      { sumInfo.style.display = 'none'; sumInfo.textContent = ''; }
    if (btnSum)       btnSum.style.display = 'none';
    if (btnSub)       btnSub.style.display = 'none';

    // Zonas de construcción
    computeZonesConstruccion();
    drawZonesConstruccion();
  } else { // 'sumas'
    // Ocultar reto; mostrar enunciado y botones de suma/resta
    if (btnChallenge) btnChallenge.style.display = 'none';
    if (challengeTxt) { challengeTxt.style.display = 'none'; challengeTxt.textContent = ''; }
    if (sumInfo)      sumInfo.style.display = '';
    if (btnSum)       btnSum.style.display = '';
    if (btnSub)       btnSub.style.display = '';

    // Zonas de suma/resta
    computeZonesSumas();
    drawZonesSumas();
  }

  resetSpawnBase();
  updateStatus();

  // marcar estado del botón de modo toggle si existe
  const btnMode = document.getElementById('btn-mode');
  if (btnMode){
    btnMode.textContent = 'Modo: ' + (modo === 'construccion' ? 'Construcción' : 'Sumas');
  }
}

function enterConstruccionMode(){
  modo = 'construccion';
  // Si quieres mantener las piezas, no limpies; si prefieres empezar limpio, descomenta:
  // pieceLayer.destroyChildren(); pieceLayer.draw();
  setUIForMode();
}

function enterSumasMode(){
  modo = 'sumas';
  // Normalmente empezamos limpio para el ejercicio:
  pieceLayer.destroyChildren(); pieceLayer.draw();
  ejercicio = null;
  setUIForMode();
}

// ====== Generadores de ejercicios ======
// ====== Generadores de ejercicios (usan tus IDs reales) ======
function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

function newSum(a=null, b=null){
  if (modo!=='sumas') enterSumasMode();
  if (a===null) a = randInt(10, 99);
  if (b===null) b = randInt(10, 99);

  // limpiar piezas y mostrar enunciado
  pieceLayer.destroyChildren(); pieceLayer.draw();
  const info = document.getElementById('sum-info');
  if (info) info.textContent = `Suma: ${a} + ${b}. Construye ${a} en “Sumando A”, ${b} en “Sumando B” y deja el total en “Resultado”.`;

  computeZonesSumas(); drawZonesSumas();
  resetSpawnBase();
  updateStatus();
  speak(`Nueva suma: ${a} más ${b}`);
}

function newSub(a=null, b=null){
  if (modo!=='sumas') enterSumasMode();
  if (a===null) a = randInt(20, 99);
  if (b===null) b = randInt(10, a);
  if (b>a) [a,b] = [b,a];

  pieceLayer.destroyChildren(); pieceLayer.draw();
  const info = document.getElementById('sum-info');
  if (info) info.textContent = `Resta: ${a} − ${b}. Construye ${a} en “Minuendo (A)”, ${b} en “Sustraendo (B)” y deja el resultado en “Resultado”.`;

  computeZonesSumas(); drawZonesSumas();
  resetSpawnBase();
  updateStatus();
  speak(`Nueva resta: ${a} menos ${b}`);
}

// Crea una suma a+b (por defecto 2 cifras) y muestra enunciado
function newSum(a=null, b=null){
  if (modo!=='sumas') enterSumasMode();
  if (a===null) a = randInt(10, 99);
  if (b===null) b = randInt(10, 99);
  ejercicio = { tipo:'suma', a, b };

  // Limpia tablero y muestra enunciado
  pieceLayer.destroyChildren(); pieceLayer.draw();
  const info = document.getElementById('sum-info');
  if (info){
    info.textContent = `Suma: ${a} + ${b}. Coloca ${a} en “Sumando A” y ${b} en “Sumando B”. Después compón para obtener el “Resultado”.`;
  }

  // Recalcular zonas de suma y SPAWN
  if (typeof computeZonesSumas === 'function'){
    computeZonesSumas(); drawZonesSumas();
  }
  resetSpawnBase();
  updateStatus();
}

// Crea una resta a-b (a≥b) y muestra enunciado
function newSub(a=null, b=null){
  if (modo!=='sumas') enterSumasMode();
  if (a===null) a = randInt(20, 99);
  if (b===null) b = randInt(10, a); // asegura a>=b
  if (b>a) [a,b] = [b,a];
  ejercicio = { tipo:'resta', a, b };

  pieceLayer.destroyChildren(); pieceLayer.draw();
  const info = document.getElementById('sum-info');
  if (info){
    info.textContent = `Resta: ${a} − ${b}. Coloca ${a} en “Minuendo (A)” y ${b} en “Sustraendo (B)”. Luego descompón/presta si hace falta y deja el resultado en “Resultado”.`;
  }

  if (typeof computeZonesSumas === 'function'){
    computeZonesSumas(); drawZonesSumas();
  }
  resetSpawnBase();
  updateStatus();
}

// ====== Botonera (IDs de tu HTML) ======
function wireUI(){
  const $ = id => document.getElementById(id);

  ensureModeButton();   // añade el botón “Modo: …” si no existe
  ensureSumInfo();      // añade el span del enunciado si no existe

  // Crear piezas
  $('#btn-unit')   ?.addEventListener('click', ()=> createUnit());
  $('#btn-ten')    ?.addEventListener('click', ()=> createTen());
  $('#btn-hundred')?.addEventListener('click', ()=> createHundred());

  // Suma/Resta (IDs reales)
  $('#btn-sum')?.addEventListener('click', ()=> newSum());
  $('#btn-sub')?.addEventListener('click', ()=> newSub());

  // Limpiar
  $('#btn-clear')?.addEventListener('click', ()=>{
    pieceLayer.destroyChildren(); pieceLayer.draw(); updateStatus(); resetSpawnBase();
  });

  // Voz
  $('#btn-say')?.addEventListener('click', ()=>{
    const {units,tens,hundreds,total}=countAll(); 
    if(total===0) return; 
    hablarDescompYLetras(hundreds,tens,units,total,1100); 
  });

  // Reto (solo construcción; además se oculta en setUIForMode)
  $('#btn-challenge')?.addEventListener('click', ()=>{
    if (modo!=='construccion') return;
    challengeNumber=Math.floor(Math.random()*900)+1;
    const ch=$('challenge'); 
    if(ch) ch.textContent=`🎯 Forma el número: ${challengeNumber}`;
    speak(`Forma el número ${numEnLetras(challengeNumber)}`);
  });

  // Botón de modo toggle (si fue inyectado por ensureModeButton)
  $('#btn-mode')?.addEventListener('click', (e)=>{
    // ya tiene su listener dentro de ensureModeButton; no duplicamos
  });

  // Panel
  $('#panel-toggle')?.addEventListener('click', ()=>{
    const panel=$('#panel'); 
    const open=panel.classList.toggle('open'); 
    const btn=$('#panel-toggle');
    btn.textContent=open?'⬇︎ Ocultar detalles':'⬆︎ Detalles'; 
    btn.setAttribute('aria-expanded', String(open)); 
    panel.setAttribute('aria-hidden', String(!open));
  });

  // Zoom
  const bindZoom=(id,fn)=>{
    const el=$(id); if(!el) return;
    el.addEventListener('click', e=>{e.preventDefault(); fn();});
    el.addEventListener('pointerdown', e=>{e.preventDefault(); fn();});
  };
  bindZoom('btn-zoom-in',  ()=>zoomStep(+1));
  bindZoom('btn-zoom-out', ()=>zoomStep(-1));
  bindZoom('btn-reset-view', ()=>{
    world.scale=1;
    world.x = stage.width()/2  - WORLD_W/2;
    world.y = stage.height()/2 - WORLD_H/2;
    applyWorldTransform();

    if (modo==='construccion'){ 
      computeZonesConstruccion(); 
      drawZonesConstruccion(); 
    } else { 
      computeZonesSumas(); 
      drawZonesSumas(); 
    }
    resetSpawnBase(); 
    updateStatus();
  });

  // Estado visual inicial
  setUIForMode();
}

// Pan & zoom
let isPanning=false, lastPointerPos=null;
stage.on('mousedown touchstart', (e)=>{ if(e.target && e.target.getLayer && e.target.getLayer()===pieceLayer) return; isPanning=true; lastPointerPos=stage.getPointerPosition(); });
stage.on('mousemove touchmove', ()=>{
  if(!isPanning) return; const pos=stage.getPointerPosition(); if(!pos||!lastPointerPos) return;
  const dx=pos.x-lastPointerPos.x, dy=pos.y-lastPointerPos.y; world.x+=dx; world.y+=dy; applyWorldTransform(); lastPointerPos=pos;
  if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); } else { computeZonesSumas(); drawZonesSumas(); }
  resetSpawnBase();
});
stage.on('mouseup touchend', ()=>{ isPanning=false; lastPointerPos=null; });
stage.on('wheel', (e)=>{
  e.evt.preventDefault();
  const old=world.scale, p=stage.getPointerPosition(), m={x:(p.x-world.x)/old,y:(p.y-world.y)/old};
  let s=e.evt.deltaY>0?old/SCALE_BY:old*SCALE_BY; s=Math.max(SCALE_MIN,Math.min(SCALE_MAX,s));
  world.scale=s; world.x=p.x-m.x*s; world.y=p.y-m.y*s; applyWorldTransform();
  if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); } else { computeZonesSumas(); drawZonesSumas(); }
  resetSpawnBase();
});
stage.on('dblclick dbltap', ()=>{
  const p=stage.getPointerPosition(), old=world.scale, m={x:(p.x-world.x)/old,y:(p.y-world.y)/old};
  let s=Math.min(SCALE_MAX, old*1.25); world.scale=s; world.x=p.x-m.x*s; world.y=p.y-m.y*s; applyWorldTransform();
  if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); } else { computeZonesSumas(); drawZonesSumas(); }
  resetSpawnBase();
});

// Intro (fade + zoom suave)
function startIntro(){
  [gridLayer, uiLayer, pieceLayer].forEach(L=>{ L.opacity(0); L.to({opacity:1,duration:0.5,easing:Konva.Easings.EaseInOut}); });

  const start=1.4, end=1.0, steps=28, dur=0.8, dt=dur/steps;
  world.scale=start;
  world.x = stage.width()/2  - WORLD_W/2 * world.scale;
  world.y = stage.height()/2 - WORLD_H/2 * world.scale;
  applyWorldTransform();

  let i=0; const timer=setInterval(()=>{
    i++; const t=i/steps, s=start + (end-start)*t;
    zoomAt({x:stage.width()/2,y:stage.height()/2}, s);
    if(i>=steps){ clearInterval(timer);
      if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); } else { computeZonesSumas(); drawZonesSumas(); }
      resetSpawnBase(); updateStatus();
    }
  }, dt*1000);
}

// ===== Cambio de modo =====

function enterMode(m){
  modo = m === 'sumas' ? 'sumas' : 'construccion';
  uiLayer.destroyChildren();
  setUIForMode();   // esto ya recalcula zonas + SPAWN + status
}
function enterConstruccionMode(){ enterMode('construccion'); }
function enterSumasMode(){ enterMode('sumas'); }

// Resize & boot
function relayout(){
  stage.width(innerWidth); stage.height(innerHeight);
  drawGrid();
  if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); } else { computeZonesSumas(); drawZonesSumas(); }
  applyWorldTransform();
  resetSpawnBase();
  pieceLayer.draw();
  updateStatus();
}
addEventListener('resize', relayout);

// Boot
drawGrid();
computeZonesConstruccion(); // arranca en construcción
drawZonesConstruccion();
applyWorldTransform();
resetSpawnBase();
wireUI();
updateStatus();
pieceLayer.draw();
startIntro();