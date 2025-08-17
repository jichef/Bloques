// script.js — Bloques interactivos con Konva

const GRID = 32;
const UNIT_SIZE = GRID;
const COLORS = { unit: "blue", ten: "red", hundred: "green" };

const stage = new Konva.Stage({
  container: "container",
  width: window.innerWidth,
  height: window.innerHeight * 0.7,
});

const layer = new Konva.Layer();
stage.add(layer);

// --- Utilidades de cuadrícula
function snapToGrid(x, y) {
  return {
    x: Math.round(x / GRID) * GRID,
    y: Math.round(y / GRID) * GRID,
  };
}

// --- Crear bloques
function createUnit(x, y) {
  const p = snapToGrid(x, y);
  const rect = new Konva.Rect({
    x: p.x,
    y: p.y,
    width: UNIT_SIZE,
    height: UNIT_SIZE,
    fill: COLORS.unit,
    draggable: true,
    name: "unit",
  });
  rect.setAttr("btype", "unit");
  commonDragBehavior(rect);
  layer.add(rect);
  layer.draw();
  updateStatus();
}

function createTen(x, y) {
  const p = snapToGrid(x, y);
  const rect = new Konva.Rect({
    x: p.x,
    y: p.y,
    width: 10 * GRID,
    height: GRID,
    fill: COLORS.ten,
    draggable: true,
    name: "ten",
  });
  rect.setAttr("btype", "ten");
  commonDragBehavior(rect);
  addDoubleTapHandler(rect, () => {
    const start = snapToGrid(rect.x(), rect.y());
    rect.destroy();
    for (let k = 0; k < 10; k++) createUnit(start.x + k * GRID, start.y);
    layer.draw();
    updateStatus();
  });
  layer.add(rect);
  layer.draw();
  updateStatus();
}

function createHundred(x, y) {
  const p = snapToGrid(x, y);
  const rect = new Konva.Rect({
    x: p.x,
    y: p.y,
    width: 10 * GRID,
    height: 10 * GRID,
    fill: COLORS.hundred,
    draggable: true,
    name: "hundred",
  });
  rect.setAttr("btype", "hundred");
  commonDragBehavior(rect);
  addDoubleTapHandler(rect, () => {
    const start = snapToGrid(rect.x(), rect.y());
    rect.destroy();
    for (let r = 0; r < 10; r++) createTen(start.x, start.y + r * GRID);
    layer.draw();
    updateStatus();
  });
  layer.add(rect);
  layer.draw();
  updateStatus();
}

// --- Comportamientos comunes
function commonDragBehavior(rect) {
  rect.on("dragend", () => {
    const p = snapToGrid(rect.x(), rect.y());
    rect.position(p);
    layer.draw();
    updateStatus();
  });
}

function addDoubleTapHandler(shape, callback) {
  let lastTap = 0;
  shape.on("touchend", () => {
    const now = Date.now();
    if (now - lastTap < 300) callback();
    lastTap = now;
  });
  shape.on("dblclick", callback);
}

// --- Contar bloques
function countAll() {
  let units = 0,
    tens = 0,
    hundreds = 0;
  layer.find("Rect").forEach((n) => {
    const t = n.name();
    if (t === "unit") units++;
    else if (t === "ten") tens++;
    else if (t === "hundred") hundreds++;
  });
  return { units, tens, hundreds, total: units + 10 * tens + 100 * hundreds };
}

// --- Actualizar estado y descomposición
function updateStatus() {
  const { units, tens, hundreds, total } = countAll();
  document.getElementById(
    "status"
  ).innerText = `Total: ${total} — ${hundreds} centenas, ${tens} decenas, ${units} unidades`;

  document.getElementById("desc-hundreds").innerText = `${hundreds} × 100 = ${
    hundreds * 100
  }`;
  document.getElementById("desc-tens").innerText = `${tens} × 10 = ${
    tens * 10
  }`;
  document.getElementById("desc-units").innerText = `${units} × 1 = ${units}`;
  document.getElementById("desc-total").innerText = total;
}

// --- Construir decenas y centenas automáticas
function autoCompose() {
  let { units, tens } = countAll();
  if (units >= 10) {
    const u = layer.findOne(".unit");
    if (u) {
      const start = snapToGrid(u.x(), u.y());
      // destruye 10 unidades
      let removed = 0;
      layer.find(".unit").forEach((uu) => {
        if (removed < 10) {
          uu.destroy();
          removed++;
        }
      });
      createTen(start.x, start.y);
    }
  } else if (tens >= 10) {
    const t = layer.findOne(".ten");
    if (t) {
      const start = snapToGrid(t.x(), t.y());
      let removed = 0;
      layer.find(".ten").forEach((tt) => {
        if (removed < 10) {
          tt.destroy();
          removed++;
        }
      });
      createHundred(start.x, start.y);
    }
  }
  updateStatus();
}

// --- Botones
document.getElementById("btn-unit").onclick = () =>
  createUnit(stage.width() / 2, stage.height() / 2);
document.getElementById("btn-ten").onclick = () =>
  createTen(stage.width() / 2, stage.height() / 2);
document.getElementById("btn-hundred").onclick = () =>
  createHundred(stage.width() / 2, stage.height() / 2);
document.getElementById("btn-compose").onclick = autoCompose;
document.getElementById("btn-clear").onclick = () => {
  layer.destroyChildren();
  layer.draw();
  updateStatus();
};

// --- Leer número
document.getElementById("btn-read").onclick = () => {
  const { total } = countAll();
  const utter = new SpeechSynthesisUtterance(total.toString());
  speechSynthesis.speak(utter);
};

// --- Reto aleatorio
document.getElementById("btn-challenge").onclick = () => {
  const num = Math.floor(Math.random() * 200) + 1;
  alert("Forma el número " + num);
};

// --- Inicial
updateStatus();