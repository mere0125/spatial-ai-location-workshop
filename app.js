const canvas = document.querySelector("#map");
const ctx = canvas.getContext("2d");
const data = window.CAMPUS_DATA;

const palette = {
  ink: "#24231f", roof: "#f8f4e9", roofDim: "#e2ded4", side: "rgba(36,35,31,.10)",
  line: "rgba(36,35,31,.18)", road: "rgba(36,35,31,.28)", path: "rgba(36,35,31,.13)",
  red: "#d94b38", blue: "#526fc1", green: "#4b9b73", violet: "#8f69ad", yellow: "#d6a915",
};

const namedBuildings = new Map(data.buildings.filter(b => b.name).map(b => [b.name, b]));
function centerOf(points) {
  const usable = points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1] ? points.slice(0, -1) : points;
  return { x: usable.reduce((s, p) => s + p[0], 0) / usable.length, y: usable.reduce((s, p) => s + p[1], 0) / usable.length };
}
data.buildings.forEach(b => b.center = centerOf(b.points));

function building(name) {
  const result = namedBuildings.get(name);
  if (!result) throw new Error(`Missing mapped building: ${name}`);
  return result;
}
function stationPoint() {
  const stations = data.pois.filter(p => p.name.includes("116th Street–Columbia University"));
  const preferred = stations.find(p => p.kind === "station") || stations[0];
  return { x: preferred.point[0], y: preferred.point[1] };
}

const anchors = [
  { id: "studio", name: "Avery Hall / studio", short: "STUDIO", color: palette.red, point: building("Avery Hall").center, radius: 115, note: "deadline pressure" },
  { id: "research", name: "Butler Library / research", short: "RESEARCH", color: palette.blue, point: building("Butler Library").center, radius: 105, note: "research rabbit hole" },
  { id: "food", name: "John Jay Hall / food", short: "FOOD", color: palette.green, point: building("John Jay Hall").center, radius: 95, note: "late dinner" },
  { id: "exit", name: "116th Street subway / way home", short: "EXIT", color: palette.violet, point: stationPoint(), radius: 95, note: "the way home" },
  { id: "idea", name: "Low Library / one good idea", short: "IDEA", color: palette.yellow, point: building("Low Memorial Library").center, radius: 90, note: "one good idea" },
];

const labelNames = ["Avery Hall", "Low Memorial Library", "Butler Library", "John Jay Hall"];
const labelBuildings = labelNames.map(building);

const thoughtSeeds = [
  ["last train", "exit", 25, -18],
  ["section model", "studio", -26, 34], ["one more rendering", "studio", 42, -20],
  ["citation I forgot", "research", -18, -24], ["noodles", "food", 32, 28],
  ["a better entrance", "idea", -34, 18],
  ["email professor", "studio", 55, 42], ["call home", "exit", -22, 22],
];
const extraNames = ["missing stair", "coffee first", "change the section", "save the file", "tomorrow's critique", "tiny breakthrough"];
let thoughts = [];
let thoughtSerial = 0;
let playing = true;
let elapsed = 0;
let lastFrame = performance.now();
let renderedBuildings = [];
let selectedPoint = null;

const camera = { angle: -0.37, zoom: 1.05, cx: 0, cy: 0 };
const pointer = { down: false, x: 0, y: 0, moved: 0, startAngle: 0 };

function makeThought(name, targetId, ox = 0, oy = 0) {
  const anchor = anchors.find(a => a.id === targetId);
  return {
    id: `thought-${++thoughtSerial}`, name, targetId,
    x: anchor.point.x + ox, y: anchor.point.y + oy,
    vx: (Math.random() - .5) * .6, vy: (Math.random() - .5) * .6,
    phase: Math.random() * Math.PI * 2, history: [],
  };
}
function resetThoughts() {
  thoughts = thoughtSeeds.map(seed => makeThought(...seed));
  fillSelects();
}

function dimensions() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  return { w, h, base: Math.min(w / 980, h / 620), cx: w * .51 + camera.cx, cy: h * .55 + camera.cy };
}
function rotateWorld(x, y) {
  const c = Math.cos(camera.angle), s = Math.sin(camera.angle);
  return { x: x * c - y * s, y: x * s + y * c };
}
function project(point, z = 0) {
  const d = dimensions(), r = rotateWorld(point.x, point.y), scale = d.base * camera.zoom;
  return { x: d.cx + r.x * scale, y: d.cy - r.y * scale * .58 - z * scale * .72 };
}
function unproject(sx, sy) {
  const d = dimensions(), scale = d.base * camera.zoom;
  const rx = (sx - d.cx) / scale, ry = -(sy - d.cy) / (scale * .58);
  const c = Math.cos(-camera.angle), s = Math.sin(-camera.angle);
  return { x: rx * c - ry * s, y: rx * s + ry * c };
}
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point.y) !== (b[1] > point.y) && point.x < (b[0] - a[0]) * (point.y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function pointInScreenPolygon(point, polygon) {
  return pointInPolygon(point, polygon.map(p => [p.x, p.y]));
}
function compass(dx, dy) {
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  if (a >= -22.5 && a < 22.5) return "east";
  if (a >= 22.5 && a < 67.5) return "northeast";
  if (a >= 67.5 && a < 112.5) return "north";
  if (a >= 112.5 && a < 157.5) return "northwest";
  if (a >= 157.5 || a < -157.5) return "west";
  if (a >= -157.5 && a < -112.5) return "southwest";
  if (a >= -112.5 && a < -67.5) return "south";
  return "southeast";
}
function rgba(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${alpha})`;
}

function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawGrounds() {
  for (const ground of data.grounds) {
    ctx.beginPath();
    ground.points.forEach((p, i) => { const s = project({ x: p[0], y: p[1] }); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    ctx.closePath(); ctx.fillStyle = ground.kind === "pitch" ? "rgba(75,155,115,.08)" : "rgba(75,155,115,.13)"; ctx.fill();
  }
}
function drawRoutes() {
  const rank = { primary: 4, secondary: 3, tertiary: 2.5, residential: 1.8, service: 1.1, pedestrian: 1.2, footway: .65, path: .65, steps: .8 };
  for (const route of data.routes) {
    ctx.beginPath();
    route.points.forEach((p, i) => { const s = project({ x: p[0], y: p[1] }); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    ctx.strokeStyle = ["footway", "path", "steps"].includes(route.kind) ? palette.path : palette.road;
    ctx.lineWidth = rank[route.kind] || 1; ctx.stroke();
  }
}
function drawGrid() {
  ctx.save(); ctx.strokeStyle = "rgba(36,35,31,.055)"; ctx.lineWidth = 1;
  for (let n = -500; n <= 500; n += 50) {
    let a = project({ x: -550, y: n }), b = project({ x: 550, y: n }); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    a = project({ x: n, y: -550 }); b = project({ x: n, y: 550 }); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}
function drawFields() {
  for (const anchor of anchors) {
    const p = project(anchor.point), d = dimensions(), r = anchor.radius * d.base * camera.zoom;
    const pulse = 1 + Math.sin(elapsed * .0012 + anchors.indexOf(anchor)) * .07;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, .52);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r * pulse);
    gradient.addColorStop(0, rgba(anchor.color, .19)); gradient.addColorStop(.48, rgba(anchor.color, .075)); gradient.addColorStop(1, rgba(anchor.color, 0));
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = rgba(anchor.color, .48); ctx.lineWidth = 1; ctx.setLineDash([3, 8]);
    ctx.beginPath(); ctx.arc(0, 0, r * .72 * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}
function anchorForBuilding(b) {
  return anchors.find(a => distance(a.point, b.center) < 18);
}
function hatchPolygon(points, color, spacing = 7, alpha = .45) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  ctx.save();
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = .65;
  const reach = maxY - minY;
  for (let x = minX - reach; x < maxX + reach; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, maxY + 2); ctx.lineTo(x + reach, minY - 2); ctx.stroke();
  }
  ctx.restore();
}
function drawBuildings() {
  const sorted = [...data.buildings].sort((a, b) => {
    const ay = project(a.center).y, by = project(b.center).y;
    return ay - by;
  });
  renderedBuildings = [];
  for (const b of sorted) {
    const base = b.points.map(p => project({ x: p[0], y: p[1] }));
    const roof = b.points.map(p => project({ x: p[0], y: p[1] }, b.height));
    const anchor = anchorForBuilding(b);
    for (let i = 0; i < base.length - 1; i++) {
      const next = i + 1;
      ctx.beginPath(); ctx.moveTo(base[i].x, base[i].y); ctx.lineTo(base[next].x, base[next].y); ctx.lineTo(roof[next].x, roof[next].y); ctx.lineTo(roof[i].x, roof[i].y); ctx.closePath();
      ctx.fillStyle = anchor ? rgba(anchor.color, .10) : palette.side; ctx.fill();
      ctx.strokeStyle = "rgba(36,35,31,.42)"; ctx.lineWidth = .55; ctx.stroke();
    }
    ctx.beginPath(); roof.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.fillStyle = b.name ? palette.roof : palette.roofDim; ctx.globalAlpha = b.name ? .88 : .64; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = anchor ? anchor.color : "rgba(36,35,31,.62)"; ctx.lineWidth = anchor ? 1.15 : .65; ctx.stroke();
    if (anchor) hatchPolygon(roof, anchor.color, 6, .62);
    else if (b.name) hatchPolygon(roof, "#24231f", 10, .12);
    ctx.save(); ctx.translate(.8, .45);
    ctx.beginPath(); roof.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.strokeStyle = "rgba(217,75,56,.12)"; ctx.lineWidth = .55; ctx.stroke(); ctx.restore();
    renderedBuildings.push({ building: b, roof, base });
  }
}
function drawLabels() {
  if (canvas.clientWidth < 560) return;
  const small = canvas.clientWidth < 760;
  for (const b of labelBuildings) {
    if (small && !["Avery Hall", "Low Memorial Library"].includes(b.name)) continue;
    const p = project(b.center, b.height), anchor = anchorForBuilding(b);
    const label = b.name.replace(" Memorial", "").toUpperCase();
    ctx.font = "500 9px Courier New"; const width = ctx.measureText(label).width + 10;
    const lx = p.x + 12, ly = p.y - 13;
    ctx.strokeStyle = anchor ? anchor.color : "rgba(36,35,31,.45)"; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(lx, ly + 3); ctx.stroke();
    ctx.fillStyle = "rgba(248,245,237,.9)"; ctx.fillRect(lx - 3, ly - 8, width, 14);
    ctx.fillStyle = palette.ink; ctx.fillText(label, lx + 2, ly + 2);
  }
}
function drawAttentionTethers() {
  const body = building("Avery Hall"), origin = project(body.center, body.height + 7);
  const selectedValue = document.querySelector("#object-select").value;
  const selectedId = selectedValue.startsWith("thought:") ? selectedValue.split(":")[1] : "";
  thoughts.forEach((t, index) => {
    const end = project(t, 8), anchor = anchors.find(a => a.id === t.targetId), selected = t.id === selectedId;
    const bend = 22 + index * 2;
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y);
    ctx.bezierCurveTo(origin.x + (end.x - origin.x) * .34, origin.y - bend, origin.x + (end.x - origin.x) * .72, end.y - bend, end.x, end.y);
    ctx.strokeStyle = rgba(anchor.color, selected ? .9 : .28); ctx.lineWidth = selected ? 2.2 : .9;
    ctx.setLineDash(selected ? [] : [2, 4]); ctx.stroke(); ctx.setLineDash([]);
  });
  ctx.strokeStyle = palette.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(origin.x - 10, origin.y); ctx.lineTo(origin.x + 10, origin.y); ctx.stroke();
  ctx.font = "700 8px Courier New"; ctx.fillStyle = palette.ink; ctx.fillText("BODY / AVERY", origin.x + 12, origin.y - 9);
}
function drawThoughts() {
  const selectedValue = document.querySelector("#object-select").value;
  const selectedId = selectedValue.startsWith("thought:") ? selectedValue.split(":")[1] : "";
  for (const t of thoughts) {
    const anchor = anchors.find(a => a.id === t.targetId), p = project(t, 8 + Math.sin(elapsed * .003 + t.phase) * 3), selected = t.id === selectedId;
    ctx.strokeStyle = anchor.color; ctx.lineWidth = selected ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(p.x - (selected ? 7 : 4), p.y); ctx.lineTo(p.x + (selected ? 7 : 4), p.y); ctx.stroke();
    if (selected) {
      ctx.font = "700 8px Courier New"; const width = ctx.measureText(t.name.toUpperCase()).width + 12;
      ctx.fillStyle = "rgba(248,245,237,.94)"; ctx.fillRect(p.x + 9, p.y - 16, width, 15);
      ctx.fillStyle = palette.ink; ctx.fillText(t.name.toUpperCase(), p.x + 15, p.y - 6);
    }
  }
}
function drawSelected() {
  if (!selectedPoint) return;
  const p = project(selectedPoint, 3), age = (performance.now() - selectedPoint.time) % 1200;
  ctx.strokeStyle = rgba(palette.yellow, .85 - age / 1600); ctx.lineWidth = 1.4; ctx.setLineDash([3, 4]);
  const half = 8 + age * .018;
  ctx.beginPath(); ctx.moveTo(p.x - half, p.y); ctx.lineTo(p.x + half, p.y); ctx.stroke(); ctx.setLineDash([]);
}
function render(now) {
  const dt = Math.min(now - lastFrame, 35); lastFrame = now;
  if (playing) { elapsed += dt; updateThoughts(dt); }
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawGrid(); drawGrounds(); drawRoutes(); drawFields(); drawBuildings(); drawLabels(); drawAttentionTethers(); drawThoughts(); drawSelected();
  updateLiveResults(); updateClock(); requestAnimationFrame(render);
}

function updateThoughts(dt) {
  for (const [index, t] of thoughts.entries()) {
    const target = anchors.find(a => a.id === t.targetId), dx = target.point.x - t.x, dy = target.point.y - t.y;
    t.vx += dx * .000025 * dt + Math.cos(elapsed * .00045 + t.phase) * .001 * dt;
    t.vy += dy * .000025 * dt + Math.sin(elapsed * .00052 + t.phase) * .001 * dt;
    for (const [j, other] of thoughts.entries()) {
      if (index === j) continue; const ox = t.x - other.x, oy = t.y - other.y, d2 = ox * ox + oy * oy;
      if (d2 > 1 && d2 < 2200) { t.vx += ox / d2 * .014 * dt; t.vy += oy / d2 * .014 * dt; }
    }
    t.vx *= Math.pow(.985, dt / 16); t.vy *= Math.pow(.985, dt / 16);
    const mag = Math.hypot(t.vx, t.vy), cap = 1.25; if (mag > cap) { t.vx = t.vx / mag * cap; t.vy = t.vy / mag * cap; }
    t.x += t.vx * dt / 16; t.y += t.vy * dt / 16;
    if (Math.random() < .012) { t.history.push({ x: t.x, y: t.y }); if (t.history.length > 18) t.history.shift(); }
    if (distance(t, target.point) < 28 && Math.random() < .0004 * dt) t.targetId = anchors[Math.floor(Math.random() * anchors.length)].id;
  }
}
function updateClock() {
  const total = 23 * 3600 + 47 * 60 + Math.floor(elapsed / 1000);
  const h24 = Math.floor(total / 3600) % 24, min = Math.floor(total / 60) % 60, sec = total % 60;
  const h12 = h24 % 12 || 12;
  document.querySelector("#clock").textContent = `${String(h12).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")} ${h24 >= 12 ? "PM" : "AM"}`;
}

function buildingAt(point) { return data.buildings.find(b => pointInPolygon(point, b.points)); }
function nearestBuilding(point, namedOnly = true) {
  return data.buildings.filter(b => !namedOnly || b.name).map(b => ({ b, d: distance(point, b.center) })).sort((a, b) => a.d - b.d)[0];
}
function nearestAnchor(point) { return anchors.map(a => ({ a, d: distance(point, a.point) })).sort((a, b) => a.d - b.d)[0]; }
function occupancyAt(point) {
  const b = buildingAt(point), field = anchors.filter(a => distance(point, a.point) <= a.radius), nearThoughts = thoughts.filter(t => distance(point, t) < 24);
  return { building: b, fields: field, thoughts: nearThoughts };
}
function describePoint(point) {
  const occ = occupancyAt(point), nearest = nearestBuilding(point), field = nearestAnchor(point);
  if (occ.building) return { title: occ.building.name || "unnamed campus building", detail: occ.fields.length ? `inside ${occ.fields.map(f => f.note).join(" + ")}` : "architectural footprint" };
  if (occ.fields.length) return { title: occ.fields.map(f => f.short).join(" + ") + " field", detail: occ.fields.map(f => f.note).join(" · ") };
  return { title: `campus walk near ${nearest.b.name}`, detail: `${Math.round(nearest.d)} m away · closest emotional pull: ${field.a.note}` };
}
function coordinateText(point) { return `${Math.abs(Math.round(point.x))} m ${point.x >= 0 ? "E" : "W"} / ${Math.abs(Math.round(point.y))} m ${point.y >= 0 ? "N" : "S"}`; }

function fillSelects() {
  const objectSelect = document.querySelector("#object-select"), occupantSelect = document.querySelector("#occupant-select"), oldObject = objectSelect.value, oldOccupant = occupantSelect.value;
  objectSelect.innerHTML = `<optgroup label="moving thoughts">${thoughts.map(t => `<option value="thought:${t.id}">${t.name}</option>`).join("")}</optgroup><optgroup label="campus landmarks">${anchors.map(a => `<option value="anchor:${a.id}">${a.name}</option>`).join("")}</optgroup>`;
  occupantSelect.innerHTML = thoughts.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
  if ([...objectSelect.options].some(o => o.value === oldObject)) objectSelect.value = oldObject;
  if ([...occupantSelect.options].some(o => o.value === oldOccupant)) occupantSelect.value = oldOccupant;
}
function selectedReferent() {
  const value = document.querySelector("#object-select").value, [kind, id] = value.split(":");
  return kind === "thought" ? thoughts.find(t => t.id === id) : anchors.find(a => a.id === id)?.point;
}
function updateLiveResults() {
  const ref = selectedReferent();
  if (ref) {
    const info = describePoint(ref), label = ref.name || anchors.find(a => a.point === ref)?.name || "landmark";
    document.querySelector("#object-result").innerHTML = `<strong>${info.title}</strong>${label} · ${coordinateText(ref)}<br><small>${info.detail}</small>`;
  }
  const trackedValue = document.querySelector("#object-select").value;
  if (trackedValue.startsWith("thought:")) {
    const tracked = thoughts.find(t => t.id === trackedValue.split(":")[1]);
    if (tracked) {
      const pull = anchors.find(a => a.id === tracked.targetId), fromBody = distance(tracked, building("Avery Hall").center);
      document.querySelector("#live-sentence").textContent = `Right now, “${tracked.name}” is ${Math.round(fromBody)} m from my body, being pulled toward ${pull.note}.`;
    }
  }
  const thought = thoughts.find(t => t.id === document.querySelector("#occupant-select").value), anchor = anchors.find(a => a.id === document.querySelector("#anchor-select").value);
  if (thought && anchor) {
    const dx = thought.x - anchor.point.x, dy = thought.y - anchor.point.y;
    const sx = `${dx >= 0 ? "+" : ""}${Math.round(dx)}`, sy = `${dy >= 0 ? "+" : ""}${Math.round(dy)}`;
    document.querySelector("#frame-result").innerHTML = `<strong>${compass(dx, dy)} of ${anchor.name}</strong>${thought.name} is ${Math.round(Math.hypot(dx, dy))} m from this local origin.<br><small>local vector x=${sx} m · y=${sy} m</small>`;
  }

  const body = building("Avery Hall").center;
  const rms = Math.sqrt(thoughts.reduce((sum, item) => sum + distance(item, body) ** 2, 0) / thoughts.length);
  const counts = anchors.map(destination => thoughts.filter(item => item.targetId === destination.id).length);
  const entropy = -counts.reduce((sum, count) => {
    if (!count) return sum;
    const probability = count / thoughts.length;
    return sum + probability * Math.log(probability);
  }, 0) / Math.log(anchors.length);
  const strongestCount = Math.max(...counts);
  const strongest = anchors.filter((_, index) => counts[index] === strongestCount).map(item => item.short).join(" + ");
  document.querySelector("#dispersion").textContent = `${Math.round(rms)} m`;
  document.querySelector("#split-index").textContent = entropy.toFixed(2);
  document.querySelector("#strongest-pull").textContent = strongest;
}
function inspect(point, preferredBuilding = null) {
  selectedPoint = { ...point, time: performance.now() };
  const occ = occupancyAt(point), b = preferredBuilding || occ.building, info = describePoint(point);
  document.querySelector("#query-x").value = Math.round(point.x); document.querySelector("#query-y").value = Math.round(point.y);
  const occupants = [b?.name, ...occ.fields.map(f => f.note), ...occ.thoughts.map(t => t.name)].filter(Boolean);
  document.querySelector("#occupancy-result").innerHTML = `<strong>${b?.name || info.title}</strong>${occupants.length ? occupants.join(" · ") : "No named occupant at this point."}<br><small>${coordinateText(point)}</small>`;
  document.querySelector("#place-name").textContent = b?.name || info.title;
  const heightLabels = { "osm-height": "OSM height", "levels-estimate": "height estimated from OSM levels", "schematic-default": "schematic height (source missing)" };
  document.querySelector("#place-detail").textContent = b ? `${Math.round(b.height)} m ${heightLabels[b.heightSource] || "schematic height"} · ${info.detail}` : info.detail;
  document.querySelector("#place-coordinate").textContent = coordinateText(point);
  document.querySelector("#place-occupancy").textContent = occupants.slice(1).join(" · ") || "open campus ground";
  document.querySelector("#place-card").classList.add("open");
}
function infer(text) {
  const q = text.toLowerCase().trim(), avery = building("Avery Hall").center, low = building("Low Memorial Library").center, butler = building("Butler Library").center, food = anchors.find(a => a.id === "food").point, exit = stationPoint();
  let point, title, why;
  if (q.includes("avery") && q.includes("low")) { point = { x: (avery.x + low.x) / 2, y: (avery.y + low.y) / 2 }; title = "Avery–Low hinge"; why = "the metric midpoint between Avery Hall and Low Library"; }
  else if ((q.includes("food") || q.includes("hungry")) && (q.includes("far") || q.includes("studio"))) { point = food; title = "John Jay food field"; why = "food is strongest here, about " + Math.round(distance(food, avery)) + " m from Avery"; }
  else if (q.includes("deadline") || q.includes("pressure") || q.includes("studio")) { point = avery; title = "deadline maximum"; why = "the studio attraction peaks at Avery Hall"; }
  else if (q.includes("home") || q.includes("exit") || q.includes("subway")) { point = exit; title = "the way home"; why = "116th Street–Columbia University station"; }
  else if (q.includes("research") || q.includes("library") || q.includes("butler")) { point = butler; title = "research rabbit hole"; why = "Butler Library is the research-field origin"; }
  else if (q.includes("between")) { point = { x: (avery.x + exit.x) / 2, y: (avery.y + exit.y) / 2 }; title = "studio–exit threshold"; why = "halfway from Avery Hall to the subway"; }
  else { point = low; title = "one good idea"; why = "without a stable clue, the model returns to Low Library's idea field"; }
  selectedPoint = { ...point, time: performance.now() };
  document.querySelector("#description-result").innerHTML = `<strong>${title}</strong>${why}<br><small>${coordinateText(point)}</small>`;
  inspect(point);
}

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(t => { t.classList.toggle("active", t === tab); t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.dataset.view === tab.dataset.tab));
}));
document.querySelector("#play").addEventListener("click", event => { playing = !playing; event.currentTarget.textContent = playing ? "pause" : "resume"; });
document.querySelector("#add").addEventListener("click", () => { const used = new Set(thoughts.map(t => t.name)), name = extraNames.find(n => !used.has(n)) || `thought ${thoughts.length + 1}`, target = anchors[Math.floor(Math.random() * anchors.length)]; thoughts.push(makeThought(name, target.id, (Math.random() - .5) * 80, (Math.random() - .5) * 80)); fillSelects(); });
document.querySelector("#rotate-left").addEventListener("click", () => camera.angle -= .16);
document.querySelector("#rotate-right").addEventListener("click", () => camera.angle += .16);
document.querySelector("#reset-view").addEventListener("click", () => { camera.angle = -.37; camera.zoom = 1.05; camera.cx = 0; camera.cy = 0; });
document.querySelector("#close-place").addEventListener("click", () => document.querySelector("#place-card").classList.remove("open"));
document.querySelector("#object-select").addEventListener("change", updateLiveResults);
document.querySelector("#occupant-select").addEventListener("change", updateLiveResults);
document.querySelector("#anchor-select").addEventListener("change", updateLiveResults);
document.querySelector("#occupancy-query").addEventListener("click", () => inspect({ x: Number(document.querySelector("#query-x").value) || 0, y: Number(document.querySelector("#query-y").value) || 0 }));
document.querySelector("#resolve").addEventListener("click", () => infer(document.querySelector("#description-input").value));
document.querySelector("#description-input").addEventListener("keydown", event => { if (event.key === "Enter") infer(event.currentTarget.value); });
document.querySelectorAll(".prompts button").forEach(button => button.addEventListener("click", () => { document.querySelector("#description-input").value = button.textContent; infer(button.textContent); }));

canvas.addEventListener("wheel", event => { event.preventDefault(); camera.zoom = Math.max(.55, Math.min(2.3, camera.zoom * (event.deltaY > 0 ? .92 : 1.08))); }, { passive: false });
canvas.addEventListener("pointerdown", event => { pointer.down = true; pointer.x = event.clientX; pointer.y = event.clientY; pointer.moved = 0; pointer.startAngle = camera.angle; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener("pointermove", event => { if (!pointer.down) return; const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y; pointer.moved = Math.hypot(dx, dy); if (pointer.moved > 3) camera.angle = pointer.startAngle + dx * .005; });
canvas.addEventListener("pointerup", event => {
  if (!pointer.down) return; pointer.down = false;
  if (pointer.moved < 5) {
    const rect = canvas.getBoundingClientRect(), screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const hit = [...renderedBuildings].reverse().find(item => pointInScreenPolygon(screen, item.roof));
    const point = hit ? hit.building.center : unproject(screen.x, screen.y);
    inspect(point, hit?.building); document.querySelector('[data-tab="occupancy"]').click();
  }
});

document.querySelector("#anchor-select").innerHTML = anchors.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
window.addEventListener("resize", resize);
resetThoughts(); resize(); inspect(building("Avery Hall").center, building("Avery Hall"));
document.querySelector("#place-card").classList.remove("open");
requestAnimationFrame(render);
