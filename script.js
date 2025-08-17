/* ====== Parámetros ====== */
const GRID = 32;        // Cuadrícula invisible 32x32
const UNIT_SIZE = 30;   // Tamaño visual del bloque (ligeramente menor que GRID)
const COLORS = {
  unit: "blue",
  ten: "red",
  hundred: "green",
};
const DOUBLE_TAP_MS = 300;

/* ====== Escenario (canvas) ====== */
const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

/* ====== Utilidades ====== */
function snapToGrid(x, y) {
  return {
    x: Math.round(x / GRID) * GRID,
    y: Math.round(y / GRID) * GRID,
  };
}

function speak(text) {
  try {
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = "es-ES";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(ut);
  } catch {}
}

function centerPos() {
  return { x: Math.floor(stage.width() / 2), y: Math.floor(stage.height() / 2) };
}

function updateStatus() {
  const { units, tens, hundreds, total } = countAll();
  const status = document.getElementById("status");
  status.innerText = `Total: ${total}  —  ${hundreds} centenas, ${tens} decenas, ${units} unidades`;
}

/* Contador de piezas y total */
function countAll() {
  let units = 0, tens = 0, hundreds = 0;
  layer.children.each((node) => {
    const t = node.getAttr("btype");
    if (t === "unit") units += 1;
    else if (t === "ten") tens += 1;
    else if (t === "hundred") hundreds += 1;
  });
  return { units, tens, hundreds, total: units + 10 * tens + 100 * hundreds };
}

/* ====== Creación de piezas ====== */
function commonDragBehavior(shape) {
  shape.on("dragend", () => {
    const pos = snapToGrid(shape.x(), shape.y());
    shape.position(pos);
    layer.draw();
    updateStatus();
  });
}

/* Doble toque/clic robusto en móvil y PC */
function addDoubleTapHandler(shape, onDoubleTap) {
  let lastTap = 0;
  let lastClick = 0;

  // Móvil: pointerdown (toque)
  shape.on("pointerdown", () => {
    const now = Date.now();
    if (now - lastTap < DOUBLE_TAP_MS) {
      onDoubleTap();
    }
    lastTap = now;
  });

  // PC: dblclick
  shape.on("dblclick", () => onDoubleTap());

  // Por si algún navegador no lanza dblclick:
  shape.on("click", () => {
    const now = Date.now();
    if (now - lastClick < DOUBLE_TAP_MS) onDoubleTap();
    lastClick = now;
  });
}

/* Unidades: cuadrado 30x30 */
function createUnit(x, y) {
  const { x: gx, y: gy } = snapToGrid(x, y);

  const rect = new Konva.Rect({
    x: gx,
    y: gy,
    width: UNIT_SIZE,
    height: UNIT_SIZE,
    fill: COLORS.unit,
    draggable: true,
  });
  rect.setAttr("btype", "unit");

  commonDragBehavior(rect);
  // Una unidad no se descompone.
  layer.add(rect);
  layer.draw();
  updateStatus();
  return rect;
}

/* Decena: barra horizontal de 10 unidades (10*UNIT_SIZE x UNIT_SIZE) */
function createTen(x, y) {
  const { x: gx, y: gy } = snapToGrid(x, y);

  const rect = new Konva.Rect({
    x: gx,
    y: gy,
    width: 10 * UNIT_SIZE,
    height: UNIT_SIZE,
    fill: COLORS.ten,
    draggable: true,
  });
  rect.setAttr("btype", "ten");

  commonDragBehavior(rect);

  addDoubleTapHandler(rect, () => {
    // Descomponer decena -> 10 unidades
    const start = snapToGrid(rect.x(), rect.y());
    rect.destroy();

    for (let k = 0; k < 10; k++) {
      createUnit(start.x + k * GRID, start.y);
    }
    layer.draw();
    updateStatus();
  });

  layer.add(rect);
  layer.draw();
  updateStatus();
  return rect;
}

/* Centena: bloque 10x10 (10*UNIT_SIZE por lado) */
function createHundred(x, y) {
  const { x: gx, y: gy } = snapToGrid(x, y);

  const rect = new Konva.Rect({
    x: gx,
    y: gy,
    width: 10 * UNIT_SIZE,
    height: 10 * UNIT_SIZE,
    fill: COLORS.hundred,
    draggable: true,
  });
  rect.setAttr("btype", "hundred");

  commonDragBehavior(rect);

  addDoubleTapHandler(rect, () => {
    // Descomponer centena -> 10 decenas (en columnas)
    const start = snapToGrid(rect.x(), rect.y());
    rect.destroy();

    for (let row = 0; row < 10; row++) {
      createTen(start.x, start.y + row * GRID);
    }
    layer.draw();
    updateStatus();
  });

  layer.add(rect);
  layer.draw();
  updateStatus();
  return rect;
}

/* APIs de botones */
function addUnit() {
  const { x, y } = centerPos();
  createUnit(x, y);
}
function addTen() {
  const { x, y } = centerPos();
  createTen(x - (5 * GRID), y); // centrada
}
function addHundred() {
  const { x, y } = centerPos();
  createHundred(x - (5 * GRID), y - (5 * GRID)); // centrada
}
function clearAll() {
  layer.destroyChildren();
  layer.draw();
  updateStatus();
}

/* ====== Composición automática ======
   - 10 unidades alineadas -> 1 decena
   - 10 decenas en columna o 100 unidades (10x10) -> 1 centena
*/
function indexByGrid() {
  const grid = new Map(); // key "gx,gy" -> node
  layer.children.each((node) => {
    const t = node.getAttr("btype");
    if (!t) return;
    const pos = snapToGrid(node.x(), node.y());
    const key = `${pos.x},${pos.y}`;
    grid.set(key, node);
  });
  return grid;
}

function removeNodes(nodes) {
  nodes.forEach((n) => n.destroy());
}

function tryComposeTensFromUnits(grid) {
  // Buscar secuencias horizontales de 10 unidades contiguas
  const composed = [];
  grid.forEach((node, key) => {
    if (node.getAttr("btype") !== "unit") return;
    const [xStr, yStr] = key.split(",");
    const x0 = +xStr, y0 = +yStr;

    // Chequear 10 unidades desde x0 hacia derecha
    const seq = [];
    for (let k = 0; k < 10; k++) {
      const keyK = `${x0 + k * GRID},${y0}`;
      const n = grid.get(keyK);
      if (!n || n.getAttr("btype") !== "unit") { return; }
      seq.push(n);
    }

    // Si llegamos aquí, hay 10 unidades contiguas
    composed.push({ x: x0, y: y0, nodes: seq });
  });

  // Crear decenas y eliminar unidades
  composed.forEach(({ x, y, nodes }) => {
    // Evitar componer dos veces la misma zona: si alguno ya está destruido, salta
    if (nodes.some((n) => n.destroyed())) return;
    removeNodes(nodes);
    createTen(x, y);
  });

  return composed.length > 0;
}

function tryComposeHundredsFromTens(grid) {
  // Buscar 10 decenas apiladas verticalmente (misma X, paso GRID)
  const composed = [];
  grid.forEach((node, key) => {
    if (node.getAttr("btype") !== "ten") return;
    const [xStr, yStr] = key.split(",");
    const x0 = +xStr, y0 = +yStr;

    const seq = [];
    for (let r = 0; r < 10; r++) {
      const keyR = `${x0},${y0 + r * GRID}`;
      const n = grid.get(keyR);
      if (!n || n.getAttr("btype") !== "ten") return;
      // Asegurar que todas las decenas tienen el mismo ancho y posX
      seq.push(n);
    }
    composed.push({ x: x0, y: y0, nodes: seq });
  });

  composed.forEach(({ x, y, nodes }) => {
    if (nodes.some((n) => n.destroyed())) return;
    removeNodes(nodes);
    createHundred(x, y);
  });

  return composed.length > 0;
}

function tryComposeHundredsFromUnits(grid) {
  // Buscar bloque 10x10 de unidades
  const composed = [];
  grid.forEach((node, key) => {
    if (node.getAttr("btype") !== "unit") return;
    const [xStr, yStr] = key.split(",");
    const x0 = +xStr, y0 = +yStr;

    const all = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const keyRC = `${x0 + c * GRID},${y0 + r * GRID}`;
        const n = grid.get(keyRC);
        if (!n || n.getAttr("btype") !== "unit") return;
        all.push(n);
      }
    }
    composed.push({ x: x0, y: y0, nodes: all });
  });

  composed.forEach(({ x, y, nodes }) => {
    if (nodes.some((n) => n.destroyed())) return;
    removeNodes(nodes);
    createHundred(x, y);
  });

  return composed.length > 0;
}

function autoCompose() {
  // Iterar hasta que no se pueda componer más
  let changed = false;
  do {
    changed = false;
    let grid = indexByGrid();
    if (tryComposeTensFromUnits(grid)) changed = true;

    grid = indexByGrid();
    if (tryComposeHundredsFromTens(grid)) changed = true;

    grid = indexByGrid();
    if (tryComposeHundredsFromUnits(grid)) changed = true;
  } while (changed);

  layer.draw();
  updateStatus();
}

/* ====== Lectura y reto ====== */
function sayCurrent() {
  const { units, tens, hundreds, total } = countAll();
  const texto =
    `Tienes ${hundreds} centenas, ${tens} decenas y ${units} unidades. ` +
    `Total: ${total}.`;
  speak(texto);
}

let challengeTarget = null;

function newChallenge() {
  challengeTarget = Math.floor(Math.random() * 900) + 100; // 100–999
  const el = document.getElementById("challenge");
  el.textContent = `Forma el número ${challengeTarget}`;
  speak(`Reto: forma el número ${challengeTarget}`);
}

/* ====== Resize ====== */
function resize() {
  stage.width(window.innerWidth);
  stage.height(window.innerHeight);
  layer.draw();
}
window.addEventListener("resize", resize);

/* ====== Arranque ====== */
updateStatus();
// Sugerencia: llamar a newChallenge() si quieres empezar con reto.
// newChallenge();