// ===== Bloques — script.js (v17.1.0: Construcción + Sumas, zonas ancladas al viewport, SPAWN visible sin solapes, TACHADO + Corrección + Toggle Topbar) =====
console.log("Bloques v17.2.1 + corrección + toggle topbar");

Konva.pixelRatio = 1;

const GRID = 32;
const COLORS = { unit: "#1f78ff", ten: "#ff3b30", hundred: "#2ecc71" };
const ZONE_STROKE = "#6c5ce7";
const ZONE_FILL   = "rgba(108,92,231,0.06)";
const CHIP_STYLE = {
  stroke:"#1a1a1a", strokeWidth:1, cornerRadius:6,
  shadowColor:"rgba(0,0,0,0.4)", shadowBlur:6, shadowOffsetX:3, shadowOffsetY:3, shadowOpacity:0.25
};
// === Dificultad del reto ===
// === Dificultad del reto (construcción) ===
const DIFFICULTY_LEVELS = { inicial: 10, medio: 100, avanzado: 999 };
let currentDifficulty = (localStorage.getItem('bloques.difficulty') || 'inicial');
if (!DIFFICULTY_LEVELS[currentDifficulty]) currentDifficulty = 'inicial';
// Dificultad actual: 'auto' | 'facil' | 'media' | 'dificil' | 'experto'
let difficulty = 'auto';

// Operación activa para corrección: { type:'suma'|'resta', a:number, b:number }
let currentOp = null;
// === Dificultad de sumas/restas ===
const SUM_DIFFICULTY_LEVELS = { basico: 9, avanzado: 99, experto: 999 };
let currentSumDifficulty = (localStorage.getItem('bloques.sumDifficulty') || 'basico');
if (!SUM_DIFFICULTY_LEVELS[currentSumDifficulty]) currentSumDifficulty = 'basico';
// Mundo
const WORLD_COLS = 160, WORLD_ROWS = 120;
const WORLD_W = WORLD_COLS*GRID, WORLD_H = WORLD_ROWS*GRID;

// Zoom/pan
const SCALE_MIN = 0.4, SCALE_MAX = 3.0, SCALE_BY = 1.06;

// Stage + layers
const stage = new Konva.Stage({ container:"container", width:innerWidth, height:innerHeight });
const gridLayer  = new Konva.Layer({ listening:false });
const uiLayer    = new Konva.Layer({ listening:false });    // etiquetas/zonas/halos
const pieceLayer = new Konva.Layer();                       // piezas
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

// ---- MODO ----
let modo = 'construccion';    // 'construccion' | 'sumas'
// ---- OPERACIÓN ACTUAL EN EL MODO "sumas" ----
// 'suma' | 'resta'
let oper = 'suma';
let currentOp = null; // {type:'suma'|'resta', a:number, b:number}
const LABELS = {
  suma:  { A: 'Sumando',   B: 'Sumando',    R: 'Resultado'   },
  resta: { A: 'Minuendo',  B: 'Sustraendo', R: 'Diferencia'  }
};
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

// ==== ZONAS (construcción y operaciones) ====

// Rectángulos lógicos (datos) y visuales (Konva)
let ZONES = null;                // objeto con tens/hund (construcción) o A/B/R (operaciones)
let zoneA=null, zoneB=null, zoneR=null;
let zoneARect=null, zoneBRect=null, zoneRRect=null;
let zoneTenRect=null, zoneHundRect=null;

const VIEW_M = GRID*3; // margen izquierdo
const VIEW_T = GRID*3; // margen superior
const GAP_V  = GRID*2; // separación vertical

// ---------- Construcción: zonas de decenas y centenas ----------
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

  zoneTenRect  = new Konva.Rect({
    x:tens.x, y:tens.y, width:tens.w, height:tens.h,
    stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL
  });
  const tenLbl = new Konva.Text({ x:tens.x+6, y:tens.y-22, text:tens.label, fontSize:16, fill: ZONE_STROKE });

  zoneHundRect = new Konva.Rect({
    x:hund.x, y:hund.y, width:hund.w, height:hund.h,
    stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL
  });
  const hunLbl = new Konva.Text({ x:hund.x+6, y:hund.y-22, text:hund.label, fontSize:16, fill: ZONE_STROKE });

  uiLayer.add(zoneTenRect, tenLbl, zoneHundRect, hunLbl);
  uiLayer.draw();
}

// ---------- Operaciones (suma/resta): A / B / Resultado ----------
function computeZonesSumas(){
  const v = visibleWorldRect();

  // banda máx. de 40 celdas de ancho, 3 columnas
  const bandW = Math.min(v.w - VIEW_M*2, GRID*40);
  const colW  = Math.max(GRID*10, Math.floor(bandW/3) - GRID);
  const colH  = GRID*12;

  const baseX = toCell(v.x + VIEW_M);
  const baseY = toCell(v.y + VIEW_T);

  zoneA = { x: baseX + 0*(colW+GRID), y: baseY, w: colW, h: colH, label: "A" };
  zoneB = { x: baseX + 1*(colW+GRID), y: baseY, w: colW, h: colH, label: "B" };
  zoneR = { x: baseX + 2*(colW+GRID), y: baseY, w: colW, h: colH, label: "Resultado" };

  ZONES = { A: zoneA, B: zoneB, R: zoneR };
}

function drawZonesSumas(){
  uiLayer.destroyChildren();

  // Etiquetas: si estás en resta, renombra a Minuendo / Sustraendo / Diferencia
  const enResta = (document.getElementById('sum-info')?.textContent || '').trim().startsWith('Resta:');

  const labelA = enResta ? 'Minuendo (A)'     : 'Sumando A';
  const labelB = enResta ? 'Sustraendo (B)'   : 'Sumando B';
  const labelR = enResta ? 'Diferencia'       : 'Resultado';

  zoneA.label = labelA;
  zoneB.label = labelB;
  zoneR.label = labelR;

  zoneARect = new Konva.Rect({ x:zoneA.x, y:zoneA.y, width:zoneA.w, height:zoneA.h,
    stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL, name:'zonaA' });
  const aLbl = new Konva.Text({ x:zoneA.x+6, y:zoneA.y-22, text:labelA, fontSize:16, fill: ZONE_STROKE });

  zoneBRect = new Konva.Rect({ x:zoneB.x, y:zoneB.y, width:zoneB.w, height:zoneB.h,
    stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL, name:'zonaB' });
  const bLbl = new Konva.Text({ x:zoneB.x+6, y:zoneB.y-22, text:labelB, fontSize:16, fill: ZONE_STROKE });

  zoneRRect = new Konva.Rect({ x:zoneR.x, y:zoneR.y, width:zoneR.w, height:zoneR.h,
    stroke: ZONE_STROKE, strokeWidth:2, cornerRadius:6, fill: ZONE_FILL, name:'zonaR' });
  const rLbl = new Konva.Text({ x:zoneR.x+6, y:zoneR.y-22, text:labelR, fontSize:16, fill: ZONE_STROKE });

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
function setMiniStatus(texto){
  const el = document.getElementById('mini-status');
  if (el) el.textContent = texto || '';
}

function setPanelOpen(open){
  const panel = document.getElementById('panel');
  const btn   = document.getElementById('panel-toggle');
  const strip = document.getElementById('details-strip');
  const caret = document.getElementById('details-caret');

  if (!panel) return;
  panel.classList.toggle('open', !!open);

  // ARIA + textos
  if (btn){
    btn.textContent = open ? '⬇︎ Ocultar detalles' : '⬆︎ Detalles';
    btn.setAttribute('aria-expanded', String(open));
  }
  if (strip) strip.setAttribute('aria-expanded', String(open));
  if (caret) caret.textContent = open ? '⬇︎' : '⬆︎';

  // Si reajustas el canvas según alto, llama a tu función
  if (typeof sizeStageToContainer === 'function') sizeStageToContainer();
}

function setSumDifficulty(level){
  if (!SUM_DIFFICULTY_LEVELS[level]) return;
  currentSumDifficulty = level;
  try { localStorage.setItem('bloques.sumDifficulty', level); } catch {}
  renderSumDifficultyUI();
}

function renderSumDifficultyUI(){
  const map = {
    basico:   document.getElementById('btn-sumdiff-basico'),
    avanzado: document.getElementById('btn-sumdiff-avanzado'),
    experto:  document.getElementById('btn-sumdiff-experto')
  };
  Object.entries(map).forEach(([lvl,btn])=>{
    if (!btn) return;
    btn.classList.toggle('active', lvl === currentSumDifficulty);
  });

  const ind = document.getElementById('sumdiff-indicator');
  if (ind){
    const max = SUM_DIFFICULTY_LEVELS[currentSumDifficulty];
    const label = currentSumDifficulty[0].toUpperCase()+currentSumDifficulty.slice(1);
    ind.textContent = `Nivel sumas: ${label} (0–${max})`;
  }
}
const cduToNum = o => (o.hundreds*100 + o.tens*10 + o.units);

// ¿Hay alguna llevada en la suma por columnas?
function hasCarry(a, b){
  let carry = 0;
  while (a > 0 || b > 0){
    const da = a % 10, db = b % 10;
    if (da + db + carry >= 10) return true;
    carry = Math.floor((da + db + carry) / 10);
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

// Generador de operandos según nivel de sumas
function genSumOperands(level){
  const MAX_TRIES = 200;

  if (level === 'basico'){
    // 0–9 sin llegar a decenas: a+b < 10 (sin llevada)
    const a = randInt(0, 9);
    const b = randInt(0, 9 - a);
    return {a, b};
  }

  if (level === 'avanzado'){
    // 0–99 con llevada y resultado ≤ 100
    // Llevada si: (a%10 + b%10 >= 10) o (a+b === 100)
    for (let i=0;i<MAX_TRIES;i++){
      const a = randInt(0, 99);
      const b = randInt(0, 99);
      const s = a + b;
      const unitsCarry = (a % 10) + (b % 10) >= 10;
      if (s <= 100 && (unitsCarry || s === 100)) return {a, b};
    }
    // Fallback seguro
    return {a:55, b:45}; // 100 con llevada
  }

  // experto
  for (let i=0;i<MAX_TRIES;i++){
    const a = randInt(0, 999);
    const b = randInt(0, 999);
    if (hasCarry(a, b)) return {a, b};
  }
  // Fallback con llevada clara
  return {a:500, b:600};
}
// ====== TACHADO ======
function isStriked(g){ return !!g.getAttr('striked'); }
function updateStrikeVisual(g){
  g.find('.strike').forEach(n=>n.destroy());
  if (!isStriked(g)) { g.draw(); return; }
  const s=typeSize(pieceType(g));
  const l1 = new Konva.Line({ points:[2,2, s.w-2, s.h-2], stroke:'#cc0000', strokeWidth:3, listening:false, name:'strike' });
  const l2 = new Konva.Line({ points:[s.w-2,2, 2, s.h-2], stroke:'#cc0000', strokeWidth:3, listening:false, name:'strike' });
  g.add(l1,l2);
  g.draw();
}

// Reemplaza la versión anterior
function setDetailsStrip(html){
  const el = document.getElementById('details-text');
  if (el) el.innerHTML = html || 'Detalles…';   // <- innerHTML
}

function syncDetailsStripWithPanel(){
  const strip = document.getElementById('details-strip');
  const panel = document.getElementById('panel');
  const caret = document.getElementById('details-caret');
  if (!strip || !panel || !caret) return;
  const open = panel.classList.contains('open');
  strip.setAttribute('aria-expanded', String(open));
  caret.textContent = open ? '⬇︎' : '⬆︎';
}
function setStriked(g, val){ g.setAttr('striked', val?1:0); updateStrikeVisual(g); updateStatus(); }
function toggleStrike(g){ setStriked(g, !isStriked(g)); }
function attachStrikeHandlers(g){
  g.on('click', (e)=>{
    if (e.evt && (e.evt.ctrlKey || e.evt.metaKey || e.evt.altKey)){
      toggleStrike(g);
      e.cancelBubble = true;
    }
  });
  g.on('contextmenu', (e)=>{
    e.evt.preventDefault();
    toggleStrike(g);
    e.cancelBubble = true;
  });
  g.on('dragend', ()=>{ if (isStriked(g)) updateStrikeVisual(g); });
}
// ——— Forzar listeners del panel (idempotente) ———
function ensurePanelListeners() {
  const panel  = document.getElementById('panel');
  const strip  = document.getElementById('details-strip');
  const caret  = document.getElementById('details-caret');
  const btn    = document.getElementById('panel-toggle');
  if (!panel) return;

  function togglePanel() {
    const open = panel.classList.toggle('open');

    // sincroniza la flecha en la franja
    if (caret) caret.textContent = open ? '⬇︎' : '⬆︎';

    // sincroniza el texto del botón
    if (btn) {
      btn.textContent = open ? '⬇︎ Ocultar detalles' : '⬆︎ Detalles';
      btn.setAttribute('aria-expanded', String(open));
    }

    // accesibilidad para el panel
    panel.setAttribute('aria-hidden', String(!open));
  }

  // 👇 aquí conectas los dos triggers
  strip?.addEventListener('click', togglePanel);
  btn?.addEventListener('click', togglePanel);
}
// ===== SPAWN visible sin solapes =====
const SPAWN = { baseX:0, baseY:0, curX:0, curY:0, rowH:GRID*2, band:{x:0,y:0,w:0,h:0} };

function computeSpawnBandInView(){
  const v = visibleWorldRect();
  const pad=GRID, gap=GRID*3;

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

  const right = clampBand(ref.x+ref.w+gap, ref.y+pad, (v.x+v.w)-(ref.x+ref.w+gap)-pad, Math.min(ref.h-2*pad, v.h-2*pad));
  if (ok(right)) return right;

  const below = clampBand(ref.x, ref.y+ref.h+gap, Math.min(v.w-2*pad, ref.w), (v.y+v.h)-(ref.y+ref.h+gap)-pad);
  if (ok(below)) return below;

  const left = clampBand(v.x+pad, ref.y+pad, (ref.x-gap)-(v.x+pad), Math.min(ref.h-2*pad, v.h-2*pad));
  if (ok(left)) return left;

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
    if (SPAWN.curY + h > SPAWN.band.y + SPAWN.band.h) SPAWN.curY = SPAWN.baseY;
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
  for (let i=0;i<pcs.length;i++){
    const g = pcs[i];
    if (isStriked(g)) continue; // ignora tachados
    const tp=pieceType(g);
    if(tp==='unit')u++; else if(tp==='ten')t++; else if(tp==='hundred')h++;
  }
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
// Reemplaza COMPLETA tu updateStatus() por esta
function updateStatus(){
  if (modo === 'construccion'){
    const {units,tens,hundreds,total}=countAll();
    const enLetras=numEnLetras(total);

    // ---- Estado superior
    const st=document.getElementById('status');
    if(st){
      st.innerHTML =
        `Total: ${total} — ` +
        `<span class="c">${hundreds}</span> centenas, ` +
        `<span class="d">${tens}</span> decenas, ` +
        `<span class="u">${units}</span> unidades — (${enLetras})`;
    }

    // ---- Panel inferior (desglose)
    const b=document.getElementById('breakdown');
    if(b){
      b.innerHTML = `
        <div class="label"><span class="c">C</span>entenas</div><div class="value"><span class="c">${hundreds}</span> × 100 = ${hundreds*100}</div>
        <div class="label"><span class="d">D</span>ecenas</div><div class="value"><span class="d">${tens}</span> × 10 = ${tens*10}</div>
        <div class="label"><span class="u">U</span>nidades</div><div class="value"><span class="u">${units}</span> × 1 = ${units}</div>
        <div class="label">Total</div><div class="value">${total}</div>
        <div class="label">En letras</div><div class="value">${enLetras}</div>`;
    }

    // Mini‑resumen (texto plano)
    setMiniStatus(`Total: ${total}  |  ${hundreds}c  ${tens}d  ${units}u  (${enLetras})`);

    // Franja inferior (con HTML y colores)
    setDetailsStrip(
      `Construcción — ` +
      `<span class="c">C</span>:${hundreds} (${hundreds*100}) · ` +
      `<span class="d">D</span>:${tens} (${tens*10}) · ` +
      `<span class="u">U</span>:${units} (${units})  |  ` +
      `Total ${total} (${enLetras})`
    );

    if(challengeNumber!==null && total===challengeNumber){
      const ch=document.getElementById('challenge'); const msg=`🎉 ¡Correcto! Has formado ${enLetras}`;
      if(ch) ch.textContent=msg; speak(msg); challengeNumber=null;
    }
    return;
  }

  // ===== MODO SUMAS/RESTAS =====
  const a = countInRect(zoneA);
  const b = countInRect(zoneB);
  const r = countInRect(zoneR);

  const isResta = (typeof oper!=='undefined' && oper==='resta');
  const L = (typeof LABELS !== 'undefined' && LABELS[oper]) ? LABELS[oper] : {A:'A',B:'B',R:'Resultado'};

  // Estado superior
  const st=document.getElementById('status');
  if(st){
    st.innerHTML = isResta
      ? `${L.A}: ${a.total}  −  ${L.B}: ${b.total}  =  ${L.R}: ${r.total}`
      : `${L.A}: ${a.total}  +  ${L.B}: ${b.total}  =  ${L.R}: ${r.total}`;
  }

  // Panel inferior
  const bd=document.getElementById('breakdown');
  if (bd){
    bd.innerHTML = isResta
      ? `
        <div class="label">${L.A} (c=×100,d=×10,u=×1)</div><div class="value"><span class="c">${a.hundreds}</span>c, <span class="d">${a.tens}</span>d, <span class="u">${a.units}</span>u → ${a.total}</div>
        <div class="label">${L.B} (c=×100,d=×10,u=×1)</div><div class="value"><span class="c">${b.hundreds}</span>c, <span class="d">${b.tens}</span>d, <span class="u">${b.units}</span>u → ${b.total}</div>
        <div class="label">A−B</div><div class="value">${a.total - b.total}</div>
        <div class="label">${L.R}</div><div class="value">${r.total}</div>
      `
      : `
        <div class="label">${L.A} (c=×100,d=×10,u=×1)</div><div class="value"><span class="c">${a.hundreds}</span>c, <span class="d">${a.tens}</span>d, <span class="u">${a.units}</span>u → ${a.total}</div>
        <div class="label">${L.B} (c=×100,d=×10,u=×1)</div><div class="value"><span class="c">${b.hundreds}</span>c, <span class="d">${b.tens}</span>d, <span class="u">${b.units}</span>u → ${b.total}</div>
        <div class="label">A+B</div><div class="value">${a.total + b.total}</div>
        <div class="label">${L.R}</div><div class="value">${r.total}</div>
      `;
  }

  // Mini‑resumen (texto plano)
  setMiniStatus(
    `${isResta ? 'A−B' : 'A+B'}  |  A=${a.total}  B=${b.total}  ${L.R}=${r.total}  ·  ` +
    `A: ${a.hundreds}c-${a.tens}d-${a.units}u · ` +
    `B: ${b.hundreds}c-${b.tens}d-${b.units}u`
  );

  // Franja inferior (HTML con colores)
  setDetailsStrip(
    `${isResta ? 'Restas' : 'Sumas'} — ` +
    `${L.A}: <span class="c">${a.hundreds}</span>c <span class="d">${a.tens}</span>d <span class="u">${a.units}</span>u (=${a.total})  ·  ` +
    `${L.B}: <span class="c">${b.hundreds}</span>c <span class="d">${b.tens}</span>d <span class="u">${b.units}</span>u (=${b.total})  ·  ` +
    `${L.R}: <span class="c">${r.hundreds}</span>c <span class="d">${r.tens}</span>d <span class="u">${r.units}</span>u (=${r.total})`
  );

  // Mensaje guía/reto
  const ch = document.getElementById('challenge');
  if (ch){
    if (!isResta){
      ch.textContent = (r.total === a.total + b.total && (a.total>0 || b.total>0))
        ? `🎉 ¡Perfecto! ${a.total} + ${b.total} = ${r.total}`
        : `➕ Construye: A + B = ${L.R}`;
    } else {
      ch.textContent = `➖ Construye: A − B = ${L.R}`;
    }
    const mini = document.getElementById('mini-status');
if (mini){
  const max = DIFFICULTY_LEVELS[currentDifficulty];
  const label = currentDifficulty[0].toUpperCase()+currentDifficulty.slice(1);
  mini.textContent += `  ·  Nivel: ${label} (1–${max})`;
}
  }
}

// ===== Reordenaciones construcción =====
function centerInRectBox(b, z){ const cx=b.x+b.w/2, cy=b.y+b.h/2; return (cx>=z.x && cx<=z.x+z.w && cy>=z.y && cy<=z.y+z.h); }
function reorderTensZone(){
  if(!ZONES?.tens) return;
  const z=ZONES.tens, units=[];
  const arr=childrenGroups();
  for (let i=0;i<arr.length;i++){ const g=arr[i]; if (pieceType(g)==='unit' && !isStriked(g) && centerInRectBox(boxForGroup(g), ZONES.tens)) units.push(g); }
  units.sort((a,b)=> (a.y()-b.y()) || (a.x()-b.x()));
  for (let i=0;i<units.length;i++) units[i].position(snap(z.x + Math.min(i,9)*GRID, z.y));
  pieceLayer.batchDraw(); updateStatus();
}
function reorderHundredsZone(){
  if(!ZONES?.hund) return;
  const z=ZONES.hund, tens=[], units=[];
  const arr=childrenGroups();
  for (let i=0;i<arr.length;i++){
    const g=arr[i], b=boxForGroup(g);
    if (!centerInRectBox(b, ZONES.hund)) continue;
    const t=pieceType(g); 
    if(t==='ten' && !isStriked(g)) tens.push(g); 
    else if(t==='unit' && !isStriked(g)) units.push(g);
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
    const g=arr[i];
    if (isStriked(g)) continue; // ignora tachadas
    const b=boxForGroup(g), tp=pieceType(g);
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
  onDragEnd(g);
  attachStrikeHandlers(g);
  pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}
function createTen(x,y){
  const w=10*GRID,h=GRID;
  let pos; if (x==null||y==null){ const r=findSpawnRect(w,h); pos={x:r.x,y:r.y}; advanceSpawn(w,h);} else pos=snap(x,y);
  const g=new Konva.Group({ x:pos.x,y:pos.y, draggable:true, name:'ten' }); g.setAttr('btype','ten'); addChipRectTo(g,w,h,COLORS.ten);
  onDragEnd(g);
  attachStrikeHandlers(g);
  onDouble(g, ()=>{ 
    if (isStriked(g)) return;
    const start=snap(g.x(),g.y()); 
    g.destroy(); 
    for(let k=0;k<10;k++) createUnit(start.x+k*GRID, start.y); 
    pieceLayer.draw(); checkBuildZones(); updateStatus(); 
  });
  pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}
function createHundred(x,y){
  const w=10*GRID,h=10*GRID;
  let pos; if (x==null||y==null){ const r=findSpawnRect(w,h); pos={x:r.x,y:r.y}; advanceSpawn(w,h);} else pos=snap(x,y);
  const g=new Konva.Group({ x:pos.x,y:pos.y, draggable:true, name:'hundred' }); g.setAttr('btype','hundred'); addChipRectTo(g,w,h,COLORS.hundred);
  onDragEnd(g);
  attachStrikeHandlers(g);
  onDouble(g, ()=>{ 
    if (isStriked(g)) return;
    const start=snap(g.x(),g.y()); 
    g.destroy(); 
    for(let row=0;row<10;row++) createTen(start.x, start.y+row*GRID); 
    pieceLayer.draw(); checkBuildZones(); updateStatus(); 
  });
  pieceLayer.add(g); pieceLayer.draw(); checkBuildZones(); updateStatus(); return g;
}

// ===== Construcción: composición automática (ignorando tachados) =====
function composeTensInZone(){
  if(modo!=='construccion' || !ZONES?.tens) return false;
  let changed=false;
  const rows=new Map();
  const arr=childrenGroups();
  for (let i=0;i<arr.length;i++){
    const n=arr[i]; if (pieceType(n)!=='unit' || isStriked(n)) continue;
    const b=boxForGroup(n); if (!centerInRectBox(b, ZONES.tens)) continue;
    const rowY=toCell(b.y); if(!rows.has(rowY)) rows.set(rowY, new Map());
    rows.get(rowY).set(toCell(b.x), n);
  }
  rows.forEach((mapX,rowY)=>{
    const xs=[...mapX.keys()].sort((a,b)=>a-b);
    for(let i=0;i<=xs.length-10;i++){
      let ok=true; for(let k=0;k<10;k++){ if(!mapX.has(xs[i]+k*GRID)){ ok=false; break; } }
      if(ok){
        const nodes=[]; for(let k=0;k<10;k++) nodes.push(mapX.get(xs[i]+k*GRID));
        nodes.forEach(n=>n.destroy());
        createTen(xs[i],rowY);
        changed=true;
      }
    }
  });
  if(!changed){
    const pool=[];
    const arr2=childrenGroups();
    for (let i=0;i<arr2.length;i++){
      const n=arr2[i]; if (pieceType(n)!=='unit' || isStriked(n)) continue;
      if(centerInRectBox(boxForGroup(n), ZONES.tens)) pool.push(n);
    }
    if(pool.length>=10){
      const a=snap(pool[0].x(),pool[0].y());
      for(let i=0;i<10;i++) pool[i].destroy();
      createTen(a.x,a.y);
      changed=true;
    }
  }
  if(changed){ reorderTensZone(); pieceLayer.draw(); }
  return changed;
}
function composeHundredsInZone(){
  if(modo!=='construccion' || !ZONES?.hund) return false;
  let changed=false;

  // 10u -> 1d
  while(true){
    const units=[]; const arr=childrenGroups();
    for(let i=0;i<arr.length;i++){
      const n=arr[i]; if(pieceType(n)!=='unit' || isStriked(n)) continue;
      if(centerInRectBox(boxForGroup(n), ZONES.hund)) units.push(n);
    }
    if(units.length<10) break;
    const a=snap(units[0].x(), units[0].y());
    for(let i=0;i<10;i++) units[i].destroy();
    createTen(a.x,a.y); changed=true;
  }

  // 10d -> 1c
  while(true){
    const tens=[]; const arr=childrenGroups();
    for(let i=0;i<arr.length;i++){
      const n=arr[i]; if(pieceType(n)!=='ten' || isStriked(n)) continue;
      if(centerInRectBox(boxForGroup(n), ZONES.hund)) tens.push(n);
    }
    if(tens.length<10) break;
    const a=snap(tens[0].x(), tens[0].y());
    for(let i=0;i<10;i++) tens[i].destroy();
    createHundred(a.x,a.y); changed=true;
  }

  if(changed){ reorderHundredsZone(); pieceLayer.draw(); }
  return changed;
}
function checkBuildZones(){
  if (modo!=='construccion'){ updateStatus(); return; }
  let changed; do{ changed=false; if(composeTensInZone()) changed=true; if(composeHundredsInZone()) changed=true; }while(changed);
  reorderTensZone(); reorderHundredsZone(); updateStatus();
}

// ======== CORRECCIÓN DE SUMAS (C-D-U con acarreo) ========
// Usamos directamente countInRect(zoneA/B/R)
function normalizarCDU({c,d,u}){
  let carryD = Math.floor(u/10); u = u%10; d += carryD;
  let carryC = Math.floor(d/10); d = d%10; c += carryC;
  return {c,d,u};
}
function comprobarSumaPasoAPaso(a,b,r){
  // a/b/r son {hundreds, tens, units, total}
  const aN = normalizarCDU({c:a.hundreds,d:a.tens,u:a.units});
  const bN = normalizarCDU({c:b.hundreds,d:b.tens,u:b.units});
  const rN = normalizarCDU({c:r.hundreds,d:r.tens,u:r.units});

  const errores = [];

  const sumaU = aN.u + bN.u;
  const uEsperada = sumaU % 10;
  const carryU = Math.floor(sumaU/10);
  if (rN.u !== uEsperada) errores.push(`En unidades debería quedar ${uEsperada}, no ${rN.u}.`);

  const sumaD = aN.d + bN.d + carryU;
  const dEsperada = sumaD % 10;
  const carryD = Math.floor(sumaD/10);
  if (rN.d !== dEsperada) errores.push(`En decenas debería quedar ${dEsperada}, no ${rN.d}.`);

  const cEsperada = aN.c + bN.c + carryD;
  if (rN.c !== cEsperada) errores.push(`En centenas debería quedar ${cEsperada}, no ${rN.c}.`);

  const okGlobal = (a.hundreds*100 + a.tens*10 + a.units) + (b.hundreds*100 + b.tens*10 + b.units)
                 === (r.hundreds*100 + r.tens*10 + r.units);
  if (!okGlobal && errores.length===0) errores.push('La suma total no coincide.');

  return { correcto: errores.length===0, errores };
}
function mostrarErrores(lista){
  const el = document.querySelector('#panel-correccion');
  if (!el) return;
  el.innerHTML = '';
  if (lista.length===0){ el.innerHTML='<div class="ok">✅ ¡Correcto!</div>'; return; }
  const ul=document.createElement('ul');
  for (const msg of lista){ const li=document.createElement('li'); li.textContent=msg; ul.appendChild(li); }
  el.appendChild(ul);
}
function resaltarZonaResultado(ok){
  if (!zoneRRect) return;
  // halo superpuesto (no interfiere)
  let halo = uiLayer.findOne('.halo-correccion');
  if (!halo){
    halo = new Konva.Rect({
      x: zoneRRect.x(), y: zoneRRect.y(),
      width: zoneRRect.width(), height: zoneRRect.height(),
      strokeWidth: 3, cornerRadius: 8, listening:false, name:'halo-correccion'
    });
    uiLayer.add(halo);
  }
  halo.stroke(ok ? '#2ecc71' : '#ff3b30');
  halo.opacity(0.9);
  halo.visible(true);
  uiLayer.batchDraw();
  setTimeout(()=>{ halo.visible(false); uiLayer.batchDraw(); }, 2200);
}
function corregirActual(){
  if (modo!=='sumas'){ 
    mostrarErrores(['Cambia a modo sumas para corregir.']); 
    return false; 
  }

  const aZ = countInRect(zoneA);
  const bZ = countInRect(zoneB);
  const rZ = countInRect(zoneR);

  const aNum = cduToNum(aZ);
  const bNum = cduToNum(bZ);
  const rNum = cduToNum(rZ);

  const errores = [];

  if (currentOp){
    if (currentOp.type === 'suma'){
      if (aNum !== currentOp.a) errores.push(`En A debes construir ${currentOp.a}, no ${aNum}.`);
      if (bNum !== currentOp.b) errores.push(`En B debes construir ${currentOp.b}, no ${bNum}.`);
      if (rNum !== aNum + bNum) errores.push(`El resultado debería ser ${aNum + bNum}, no ${rNum}.`);
      // Si A y B son correctos, da feedback de acarreo a nivel CDU
      if (errores.length === 0){
        const paso = comprobarSumaPasoAPaso(aZ, bZ, rZ);
        if (!paso.correcto) errores.push(...paso.errores);
      }
    } else { // resta
      if (aNum !== currentOp.a) errores.push(`En A debes construir ${currentOp.a}, no ${aNum}.`);
      if (bNum !== currentOp.b) errores.push(`En B debes construir ${currentOp.b}, no ${bNum}.`);
      if (rNum !== aNum - bNum) errores.push(`El resultado debería ser ${aNum - bNum}, no ${rNum}.`);
      // (Opcional: podrías implementar comprobación paso a paso con préstamos)
    }
  } else {
    // Sin ejercicio activo: retrocompatibilidad (solo chequeo de coherencia entre zonas)
    if (oper === 'suma'){
      const paso = comprobarSumaPasoAPaso(aZ, bZ, rZ);
      if (!paso.correcto) errores.push(...paso.errores);
    } else {
      // Resta sin ejercicio activo: chequeo básico
      if (rNum !== aNum - bNum) errores.push(`El resultado debería ser ${aNum - bNum}, no ${rNum}.`);
    }
  }

  const ok = errores.length === 0;
  resaltarZonaResultado(ok);
  mostrarErrores(errores);
  return ok;
}

// ====== Helpers UI de modo ======
function setUIForMode(){
  const btnConstruccion = document.getElementById('btn-mode-construccion');
  const btnSumas        = document.getElementById('btn-mode-suma');
  const modeHint        = document.getElementById('mode-hint');

  const btnChallenge = document.getElementById('btn-challenge');
  const challengeTxt = document.getElementById('challenge');

  const sumInfo   = document.getElementById('sum-info');
  const btnNewSum = document.getElementById('btn-new-sum');
  const btnNewSub = document.getElementById('btn-new-sub');

  const enSumas = (modo === 'sumas');

  // Mostrar/ocultar según modo
const btnUnit    = document.getElementById('btn-unit');
  const btnTen     = document.getElementById('btn-ten');
  const btnHundred = document.getElementById('btn-hundred');
  if (btnUnit)    btnUnit.style.display    = 'inline-block';
  if (btnTen)     btnTen.style.display     = 'inline-block';
  if (btnHundred) btnHundred.style.display = 'inline-block';


  if (btnChallenge) btnChallenge.style.display = enSumas ? 'none' : 'inline-block';
  if (challengeTxt){
    challengeTxt.style.display = enSumas ? 'none' : 'inline';
    if (enSumas) challengeTxt.textContent = '';
  }
  if (sumInfo)   sumInfo.style.display   = enSumas ? 'inline'       : 'none';
  if (btnNewSum) btnNewSum.style.display = enSumas ? 'inline-block' : 'none';
  if (btnNewSub) btnNewSub.style.display = enSumas ? 'inline-block' : 'none';

  // Zonas según modo
  if (enSumas){
    computeZonesSumas();
    drawZonesSumas();
    if (modeHint) modeHint.textContent = 'Modo sumas/restas: construye A, B y el Resultado.';
  } else {
    computeZonesConstruccion();
    drawZonesConstruccion();
    if (modeHint) modeHint.textContent = 'Modo construcción: crea y compón bloques libremente.';
  }

  // Marcar pestañas activas
  btnConstruccion?.classList.toggle('active', !enSumas);
  btnSumas?.classList.toggle('active', enSumas);

  // Reposicionar SPAWN y refrescar estado
  
  resetSpawnBase();
  updateStatus();
  syncDetailsStripWithPanel();
  ensureMiniStatus();   
}
function setDifficulty(level){
  if (!DIFFICULTY_LEVELS[level]) return;
  currentDifficulty = level;
  try { localStorage.setItem('bloques.difficulty', level); } catch {}
  renderDifficultyUI();
}

function renderSumDifficultyUI(){
  const map = {
    basico:   document.getElementById('btn-sumdiff-basico'),
    avanzado: document.getElementById('btn-sumdiff-avanzado'),
    experto:  document.getElementById('btn-sumdiff-experto')
  };
  Object.entries(map).forEach(([lvl,btn])=>{
    if (!btn) return;
    btn.classList.toggle('active', lvl === currentSumDifficulty);
  });

  const ind = document.getElementById('sumdiff-indicator');
  if (ind){
    let desc = '';
    if (currentSumDifficulty === 'basico')   desc = '0–9 (sin decenas)';
    if (currentSumDifficulty === 'avanzado') desc = '0–99 (con llevadas, total ≤ 100)';
    if (currentSumDifficulty === 'experto')  desc = '0–999 (con llevadas)';
    ind.textContent = `Nivel sumas: ${desc}`;
  }
}
function enterMode(m){
  modo = (m === 'sumas') ? 'sumas' : 'construccion';
  uiLayer.destroyChildren();
  setUIForMode(); // recalcula zonas + SPAWN + status
}
function enterConstruccionMode(){ enterMode('construccion'); }
function enterSumasMode(){ enterMode('sumas'); }
// ==== Grupos de controles por modo ====
const CONTROL_GROUPS = {
  buildOnly: [
    'btn-challenge', 'btn-diff-inicial', 'btn-diff-medio', 'btn-diff-avanzado',
    'btn-unit', 'btn-ten', 'btn-hundred', 'btn-say'
  ],
  sumOnly: [
    'btn-new-sum', 'btn-new-sub', 'btn-corregir',
    'btn-sumdiff-basico', 'btn-sumdiff-avanzado', 'btn-sumdiff-experto'
  ],
  common: [
    'btn-clear', 'btn-zoom-in', 'btn-zoom-out', 'btn-reset-view', 'btn-toggle-topbar',
    'btn-mode-construccion', 'btn-mode-suma'
  ],
  // spans/indicadores (no son <button>)
  buildIndicators: ['diff-indicator'],
  sumIndicators:   ['sumdiff-indicator']
};

function showEls(ids, displayMode){
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = displayMode;
  });
}

// Llama a esto siempre que cambie el modo
function updateControlsVisibility(){
  const inBuild = (modo === 'construccion');
  const inSum   = (modo === 'sumas');

  // Botones
  showEls(CONTROL_GROUPS.buildOnly, inBuild ? 'inline-block' : 'none');
  showEls(CONTROL_GROUPS.sumOnly,   inSum   ? 'inline-block' : 'none');
  showEls(CONTROL_GROUPS.common,    'inline-block');

  // Indicadores <span>
  showEls(CONTROL_GROUPS.buildIndicators, inBuild ? 'inline' : 'none');
  showEls(CONTROL_GROUPS.sumIndicators,   inSum   ? 'inline' : 'none');
}
// ====== Generadores de ejercicios ======
function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
function ensureCarry(a, b) { return (a % 10) + (b % 10) >= 10; }
function avoidCarry(a, b)  { return (a % 10) + (b % 10) < 10;  }

function pickSumOperands(diff) {
  if (!diff || diff === 'auto') diff = 'media';

  // fácil: 1–9 + 1–9 (sin acarreo)
  if (diff === 'facil') {
    const a = randInt(1, 9), b = randInt(1, 9);
    return [a, b];
  }

  // media: 10–99 sin acarreo en unidades
  if (diff === 'media') {
    let a, b, guard = 0;
    do {
      a = randInt(10, 99);
      b = randInt(10, 99);
      guard++;
    } while (!avoidCarry(a, b) && guard < 200);
    return [a, b];
  }

  // dificil: 10–99 con acarreo garantizado
  if (diff === 'dificil') {
    let a, b, guard = 0;
    do {
      a = randInt(10, 99);
      b = randInt(10, 99);
      guard++;
    } while (!ensureCarry(a, b) && guard < 200);
    return [a, b];
  }

  // experto: 100–999 (mixto; no forzamos ni evitamos acarreo)
  if (diff === 'experto') {
    const a = randInt(100, 999);
    const b = randInt(100, 999);
    return [a, b];
  }

  // fallback
  return [randInt(10, 99), randInt(10, 99)];
}

function pickSubOperands(diff) {
  if (!diff || diff === 'auto') diff = 'media';

  // fácil: 2 cifras sin préstamo (A ≥ B, unidades sin préstamo)
  if (diff === 'facil') {
    let a, b, guard = 0;
    do {
      a = randInt(10, 99);
      b = randInt(10, a);
      guard++;
    } while ((a % 10) < (b % 10) && guard < 200); // evita préstamo en U
    return [a, b];
  }

  // media: 2 cifras, permitimos préstamo a veces (no forzado)
  if (diff === 'media') {
    const a = randInt(10, 99);
    const b = randInt(10, a);
    return [a, b];
  }

  // dificil: 2 cifras con préstamo garantizado en unidades
  if (diff === 'dificil') {
    let a, b, guard = 0;
    do {
      a = randInt(10, 99);
      b = randInt(10, a);
      guard++;
    } while ((a % 10) >= (b % 10) && guard < 200); // fuerza préstamo en U
    return [a, b];
  }

  // experto: 3 cifras (puede haber múltiples préstamos)
  if (diff === 'experto') {
    let a = randInt(100, 999);
    let b = randInt(100, a);
    return [a, b];
  }

  // fallback
  let a = randInt(10, 99);
  let b = randInt(10, a);
  return [a, b];
}
// Llama: setDifficulty('facil'|'media'|'dificil'|'experto'|'auto')
function setDifficulty(level) {
  const levels = new Set(['auto','facil','media','dificil','experto']);
  difficulty = levels.has(level) ? level : 'auto';

  // (Opcional) marca botones si existen
  ['btn-diff-facil','btn-diff-media','btn-diff-dificil','btn-diff-experto','btn-diff-auto']
    .forEach(id => document.getElementById(id)?.classList.remove('active'));
  const mapId = {
    auto:'btn-diff-auto', facil:'btn-diff-facil', media:'btn-diff-media',
    dificil:'btn-diff-dificil', experto:'btn-diff-experto'
  };
  const el = document.getElementById(mapId[difficulty]);
  if (el) el.classList.add('active');
}
window.setDifficulty = setDifficulty; // por si lo quieres tocar desde consola/UI

function newSum(a=null, b=null){
  oper = 'suma';
  if (modo!=='sumas') enterMode('sumas');

  // Elegir operandos por dificultad si no vienen dados
  if (a===null || b===null) {
    [a, b] = pickSumOperands(difficulty);
  }

  // Limpia piezas
  pieceLayer.destroyChildren(); pieceLayer.draw();

  // Recuerda operación activa (para corregir contra A y B)
  currentOp = { type:'suma', a, b };

  const info = document.getElementById('sum-info');
  if (info){
    info.style.display = 'inline';
    info.textContent = `Suma: ${a} + ${b}. Construye ${a} en “${LABELS.suma.A} (A)”, ${b} en “${LABELS.suma.B} (B)” y deja el total en “${LABELS.suma.R}”.`;
  }

  computeZonesSumas(); 
  drawZonesSumas(); 
  resetSpawnBase();
  updateStatus();
  try{ speak(`Nueva suma: ${a} más ${b}`);}catch{}
}

function newSub(a=null, b=null){
  oper = 'resta';
  if (modo!=='sumas') enterMode('sumas');

  // Elegir operandos por dificultad si no vienen dados
  if (a===null || b===null) {
    [a, b] = pickSubOperands(difficulty);
  }

  // Garantiza A ≥ B
  if (b > a) [a, b] = [b, a];

  pieceLayer.destroyChildren(); pieceLayer.draw();

  // Recuerda operación activa
  currentOp = { type:'resta', a, b };

  const info = document.getElementById('sum-info');
  if (info){
    info.style.display = 'inline';
    info.textContent = `Resta: ${a} − ${b}. Construye ${a} en “${LABELS.resta.A} (A)”, ${b} en “${LABELS.resta.B} (B)” y deja el resultado en “${LABELS.resta.R}”.`;
  }

  computeZonesSumas(); 
  drawZonesSumas(); 
  resetSpawnBase();
  updateStatus();
  try{ speak(`Nueva resta: ${a} menos ${b}`);}catch{}
}
// === Asegurar mini-resumen visible en la barra ===
function ensureMiniStatus(){
  const topbar = document.getElementById('topbar');
  if (!topbar) return null;

  // 1) Espaciador flexible para empujar a la derecha
  let spacer = document.getElementById('topbar-spacer');
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.id = 'topbar-spacer';
    spacer.style.flex = '1 1 auto';
  }

  // 2) Panel de corrección y mini-status
  let corr = document.getElementById('panel-correccion');
  let mini = document.getElementById('mini-status');
  if (!mini) {
    mini = document.createElement('div');
    mini.id = 'mini-status';
    mini.style.fontSize = '14px';
    mini.style.whiteSpace = 'nowrap';
    mini.style.color = '#1f2340';
  }

  // 3) Insertar en orden: [controles] [spacer] [mini-status] [panel-correccion]
  const controls = document.getElementById('controls');

  if (controls) {
    // Asegura que el spacer quede justo después de los controles
    if (!spacer.parentNode) topbar.insertBefore(spacer, controls.nextSibling);
    else if (spacer.previousElementSibling !== controls)
      topbar.insertBefore(spacer, controls.nextSibling);
  } else {
    if (!spacer.parentNode) topbar.appendChild(spacer);
  }

  // Coloca mini-status antes del panel de corrección
  if (corr) {
    corr.style.marginLeft = '0'; // evita que "expulse" al mini-status
    if (mini.parentNode !== topbar || mini.nextElementSibling !== corr) {
      topbar.insertBefore(mini, corr);
    }
  } else {
    if (!mini.parentNode) topbar.appendChild(mini);
  }

  return mini;
}
function togglePanel(forceOpen = null){
  const panel = document.getElementById('panel');
  if (!panel) return;

  const caret = document.getElementById('details-caret');
  const btn   = document.getElementById('panel-toggle');
  const strip = document.getElementById('details-strip');

  const newOpen = (forceOpen === null)
    ? !panel.classList.contains('open')
    : !!forceOpen;

  panel.classList.toggle('open', newOpen);

  // Accesibilidad + UI
  if (strip) strip.setAttribute('aria-expanded', newOpen ? 'true' : 'false');
  if (caret) caret.textContent = newOpen ? '⬇︎' : '⬆︎';
  if (btn){
    btn.textContent = newOpen ? '⬇︎ Ocultar detalles' : '⬆︎ Detalles';
    btn.setAttribute('aria-expanded', String(newOpen));
  }
  panel.setAttribute('aria-hidden', String(!newOpen));

  if (typeof syncDetailsStripWithPanel === 'function') syncDetailsStripWithPanel();
  if (typeof sizeStageToContainer === 'function')      sizeStageToContainer();
}
// ====== Wire UI (delegación) ======
function wireUI(){
  // Evita el menú contextual en el canvas (usamos clic derecho para tachar)
  document.getElementById('container')?.addEventListener('contextmenu', e=> e.preventDefault());

  const $ = id => document.getElementById(id);
  const controls = $('controls');
  if (!controls) { console.error('❌ #controls no encontrado'); return; }

  // Asegura mini‑resumen y espaciado correcto en la topbar
  ensureMiniStatus();

  // --- Delegación primaria: SOLO botones dentro de #controls
  controls.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if (!btn || !controls.contains(btn)) return;

    switch(btn.id){
      case 'btn-mode-construccion':
        modo = 'construccion';
        setUIForMode();
        syncDetailsStripWithPanel();
        break;

      case 'btn-mode-suma':
        modo = 'sumas';
        setUIForMode();
        syncDetailsStripWithPanel();
        break;

      case 'btn-unit':    createUnit();    break;
      case 'btn-ten':     createTen();     break;
      case 'btn-hundred': createHundred(); break;

      case 'btn-new-sum': newSum(); break;
      case 'btn-new-sub': newSub(); break;

      case 'btn-clear':
        pieceLayer.destroyChildren();
        pieceLayer.draw();
        updateStatus();
        resetSpawnBase();
        syncDetailsStripWithPanel();
        break;

      case 'btn-zoom-in':  zoomStep(+1); break;
      case 'btn-zoom-out': zoomStep(-1); break;

      // ===== Dificultad SUMAS/RESTAS =====
      case 'btn-sumdiff-basico':
        setSumDifficulty('basico');
        renderSumDifficultyUI();
        if (modo==='sumas'){ computeZonesSumas(); drawZonesSumas(); resetSpawnBase(); updateStatus(); }
        break;

      case 'btn-sumdiff-avanzado':
        setSumDifficulty('avanzado');
        renderSumDifficultyUI();
        if (modo==='sumas'){ computeZonesSumas(); drawZonesSumas(); resetSpawnBase(); updateStatus(); }
        break;

      case 'btn-sumdiff-experto':
        setSumDifficulty('experto');
        renderSumDifficultyUI();
        if (modo==='sumas'){ computeZonesSumas(); drawZonesSumas(); resetSpawnBase(); updateStatus(); }
        break;

      // ===== Dificultad CONSTRUCCIÓN (retos) =====
      case 'btn-diff-inicial':
        setDifficulty('inicial');
        renderDifficultyUI();
        if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); resetSpawnBase(); updateStatus(); }
        break;

      case 'btn-diff-medio':
        setDifficulty('medio');
        renderDifficultyUI();
        if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); resetSpawnBase(); updateStatus(); }
        break;

      case 'btn-diff-avanzado':
        setDifficulty('avanzado');
        renderDifficultyUI();
        if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); resetSpawnBase(); updateStatus(); }
        break;

      case 'btn-reset-view':
        world.scale = 1;
        world.x = stage.width()/2  - WORLD_W/2;
        world.y = stage.height()/2 - WORLD_H/2;
        applyWorldTransform();
        if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); }
        else                      { computeZonesSumas();       drawZonesSumas();       }
        resetSpawnBase(); updateStatus();
        syncDetailsStripWithPanel();
        break;

      case 'btn-challenge': {
        if (modo!=='construccion') return;
        const max = DIFFICULTY_LEVELS[currentDifficulty] || 999;
        const n = Math.floor(Math.random()*max) + 1;
        challengeNumber = n;

        const ch = $('challenge');
        if (ch){
          const label = currentDifficulty[0].toUpperCase()+currentDifficulty.slice(1);
          ch.textContent = `🎯 (${label}) Forma el número: ${n}`;
        }
        speak(`Forma el número ${numEnLetras(n)}`);
        break;
      }

      case 'btn-say': {
        const {units,tens,hundreds,total}=countAll();
        if (total===0) return;
        hablarDescompYLetras(hundreds,tens,units,total,1100);
        break;
      }

      case 'btn-corregir':
        corregirActual();
        break;

      case 'btn-toggle-topbar': {
        const bar = $('topbar');
        if (!bar) return;
        const hidden = bar.style.display !== 'none';
        bar.style.display = hidden ? 'none' : 'flex';
        btn.textContent = hidden ? 'Mostrar barra' : 'Ocultar barra';
        sizeStageToContainer();
        break;
      }

      default:
        // No-op
        break;
    }
  });

  // --- Respaldo opcional: si pusiste botones de dificultad FUERA de #controls
  document.addEventListener('click', (e)=>{
    const b = e.target.closest('button');
    if (!b) return;
    switch(b.id){
      case 'btn-sumdiff-basico':
      case 'btn-sumdiff-avanzado':
      case 'btn-sumdiff-experto':
        if (!controls.contains(b)) {
          setSumDifficulty(b.id==='btn-sumdiff-basico'?'basico':b.id==='btn-sumdiff-avanzado'?'avanzado':'experto');
          renderSumDifficultyUI();
          if (modo==='sumas'){ computeZonesSumas(); drawZonesSumas(); resetSpawnBase(); updateStatus(); }
        }
        break;

      case 'btn-diff-inicial':
      case 'btn-diff-medio':
      case 'btn-diff-avanzado':
        if (!controls.contains(b)) {
          setDifficulty(b.id==='btn-diff-inicial'?'inicial':b.id==='btn-diff-medio'?'medio':'avanzado');
          renderDifficultyUI();
          if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); resetSpawnBase(); updateStatus(); }
        }
        break;
    }
  });

  // Atajo teclado: T = toggle topbar
  window.addEventListener('keydown', (ev)=>{
    if ((ev.key==='t' || ev.key==='T') && !ev.metaKey && !ev.ctrlKey && !ev.altKey){
      const bar = $('topbar');
      const btn = $('btn-toggle-topbar');
      if (!bar) return;
      const hidden = bar.style.display !== 'none';
      bar.style.display = hidden ? 'none' : 'flex';
      if (btn) btn.textContent = hidden ? 'Mostrar barra' : 'Ocultar barra';
      sizeStageToContainer();
    }
  });

  // Estado inicial coherente
  setUIForMode();
  renderDifficultyUI?.();
  renderSumDifficultyUI?.();
  syncDetailsStripWithPanel?.();
}

// Pan & zoom
let isPanning=false, lastPointerPos=null;
stage.on('mousedown touchstart', (e)=>{
  if (e.target && e.target.getLayer && e.target.getLayer() === pieceLayer) return;
  isPanning = true;
  lastPointerPos = stage.getPointerPosition();
  if (e.evt) e.evt.preventDefault();      // 👈 evita scroll iOS
});

stage.on('mousemove touchmove', (e)=>{
  if(!isPanning) return;
  if (e.evt) e.evt.preventDefault();      // 👈 evita scroll iOS
  const pos = stage.getPointerPosition();
  if(!pos || !lastPointerPos) return;
  const dx = pos.x - lastPointerPos.x;
  const dy = pos.y - lastPointerPos.y;
  world.x += dx;
  world.y += dy;
  applyWorldTransform();
  lastPointerPos = pos;
  resetSpawnBase();
});

stage.on('mouseup touchend', (e)=>{
  isPanning=false;
  lastPointerPos=null;
  if (e.evt) e.evt.preventDefault();      // opcional; mantiene simetría
});
stage.on('wheel', (e)=>{
  e.evt.preventDefault();
  const old = world.scale;
  const p = stage.getPointerPosition();
  const m = { x:(p.x-world.x)/old, y:(p.y-world.y)/old };
  let s = e.evt.deltaY > 0 ? old/SCALE_BY : old*SCALE_BY;
  s = Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));
  world.scale = s;
  world.x = p.x - m.x*s;
  world.y = p.y - m.y*s;
  applyWorldTransform();
  resetSpawnBase();
});
stage.on('dblclick dbltap', ()=>{
  const p = stage.getPointerPosition();
  const old = world.scale;
  const m = { x:(p.x-world.x)/old, y:(p.y-world.y)/old };
  let s = Math.min(SCALE_MAX, old*1.25);
  world.scale = s;
  world.x = p.x - m.x*s;
  world.y = p.y - m.y*s;
  applyWorldTransform();
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
    i++; const s=start + (end-start)*(i/steps);
    zoomAt({x:stage.width()/2,y:stage.height()/2}, s);
    if(i>=steps){ clearInterval(timer);
      if (modo==='construccion'){ computeZonesConstruccion(); drawZonesConstruccion(); } else { computeZonesSumas(); drawZonesSumas(); }
      resetSpawnBase(); updateStatus();
    }
  }, dt*1000);
}

// Resize & boot
// === Ajusta el stage al tamaño real del #container (CSS calc ya descuenta la franja) ===
function sizeStageToContainer(){
  const c = document.getElementById('container');
  if (!c) return;
  stage.width(c.clientWidth);
  stage.height(c.clientHeight);
  stage.batchDraw();
}

function relayout(){
  sizeStageToContainer(); // usa el alto real del contenedor
  drawGrid();

  if (modo === 'construccion'){
    computeZonesConstruccion();
    drawZonesConstruccion();
  } else {
    computeZonesSumas();
    drawZonesSumas();
  }

  applyWorldTransform();
  resetSpawnBase();
  pieceLayer.draw();
  updateStatus();

  // Mantén caret/aria en sync
  if (typeof syncDetailsStripWithPanel === 'function') syncDetailsStripWithPanel();
}

document.addEventListener('DOMContentLoaded', () => {
  // Listeners ÚNICOS para abrir/cerrar el panel
  const strip = document.getElementById('details-strip');
  const btn   = document.getElementById('panel-toggle');

  strip?.addEventListener('click', () => togglePanel());
  btn?.addEventListener('click',   () => togglePanel());

  // Resize
  window.addEventListener('resize', relayout);

  // ===== Boot =====
  sizeStageToContainer();
  drawGrid();
  computeZonesConstruccion();   // arranca en construcción
  drawZonesConstruccion();
  applyWorldTransform();
  resetSpawnBase();

  ensureMiniStatus();           // mini‑resumen en topbar
  wireUI();                     // listeners de controles

  if (typeof syncDetailsStripWithPanel === 'function') syncDetailsStripWithPanel();

  updateStatus();
  pieceLayer.draw();
  startIntro();
});