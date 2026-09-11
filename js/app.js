const MAP_SIZE = 15360;
const router = new RoadRouter();
let recipes = [];
let shoppingData = [];

let originPoint = null;
let destPoint = null;
let routeLine = null;
let originMarker = null;
let destMarker = null;
let tempTapPoint = null;

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -4,
  maxZoom: 2,
  zoomSnap: 0.25,
  attributionControl: false
});

const mapBounds = [[0, 0], [MAP_SIZE, MAP_SIZE]];
map.fitBounds(mapBounds);
map.setMaxBounds(mapBounds);

function generateMapTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = "#0c0f0a";
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.fillStyle = "#060805";
  ctx.beginPath();
  ctx.moveTo(1024, 1024); ctx.lineTo(820, 1024);
  ctx.bezierCurveTo(780, 750, 520, 420, 310, 210);
  ctx.lineTo(120, 0); ctx.lineTo(1024, 0);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = "#161b12";
  ctx.lineWidth = 1;
  for (let i = 40; i < 1024; i += 32) {
    ctx.beginPath(); ctx.arc(380, 620, i, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(700, 280, i * 0.7, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.strokeStyle = "#20271a";
  ctx.lineWidth = 1.5;
  for (let g = 0; g <= 1024; g += 64) {
    ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, 1024); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(1024, g); ctx.stroke();
  }
  return c.toDataURL();
}

L.imageOverlay(generateMapTexture(), mapBounds, { opacity: 1.0 }).addTo(map);

fetch('data/roads.json')
  .then(r => r.json())
  .then(data => {
    router.loadGraph(data);

    data.edges.forEach(([u, v]) => {
      const p1 = data.nodes[u];
      const p2 = data.nodes[v];
      L.polyline([[p1.z, p1.x], [p2.z, p2.x]], {
        color: '#7b6843',
        weight: 2,
        opacity: 0.55
      }).addTo(map);
    });

    for (const k in data.nodes) {
      const n = data.nodes[k];
      L.circleMarker([n.z, n.x], {
        radius: 2,
        color: '#bfa15f',
        fillColor: '#0a0c08',
        fillOpacity: 0.9,
        weight: 1
      }).addTo(map);
    }
  });

map.on('click', (e) => {
  const x = Math.round(e.latlng.lng);
  const z = Math.round(e.latlng.lat);
  if (x < 0 || x > MAP_SIZE || z < 0 || z > MAP_SIZE) return;

  tempTapPoint = { x, z };
  document.getElementById('manualX').value = x;
  document.getElementById('manualZ').value = z;
  document.getElementById('coordStatus').innerHTML = `SELECTED LOC: <b>X ${x} | Z ${z}</b>`;
});

function setOrigin() {
  const x = parseInt(document.getElementById('manualX').value);
  const z = parseInt(document.getElementById('manualZ').value);
  if (isNaN(x) || isNaN(z)) return;

  originPoint = { x, z };
  if (originMarker) map.removeLayer(originMarker);
  originMarker = L.circleMarker([z, x], {
    radius: 6, color: '#5a8a47', fillColor: '#fff', fillOpacity: 0.9, weight: 2
  }).addTo(map);

  document.getElementById('coordStatus').innerHTML = `ORIGIN SET: <b>X ${x} | Z ${z}</b>`;
  checkAndCalculateRoute();
}

function setDestination() {
  const x = parseInt(document.getElementById('manualX').value);
  const z = parseInt(document.getElementById('manualZ').value);
  if (isNaN(x) || isNaN(z)) return;

  destPoint = { x, z };
  if (destMarker) map.removeLayer(destMarker);
  destMarker = L.circleMarker([z, x], {
    radius: 6, color: '#c93b3b', fillColor: '#fff', fillOpacity: 0.9, weight: 2
  }).addTo(map);

  document.getElementById('coordStatus').innerHTML = `DEST SET: <b>X ${x} | Z ${z}</b>`;
  checkAndCalculateRoute();
}

function checkAndCalculateRoute() {
  if (!originPoint || !destPoint) return;

  const result = router.routeBetweenPoints(originPoint, destPoint);
  if (!result) {
    document.getElementById('coordStatus').innerText = "ERROR: UNABLE TO TRACE ROAD NETWORK";
    return;
  }

  if (routeLine) map.removeLayer(routeLine);
  routeLine = L.polyline(result.coords, {
    color: '#e5a93c',
    weight: 4,
    opacity: 0.95
  }).addTo(map);

  const km = (result.totalMeters / 1000).toFixed(2);
  const runMin = Math.round(result.totalMeters / 260);
  const driveMin = Math.round(result.totalMeters / 1100);

  document.getElementById('coordStatus').innerHTML = `DIST: <b>${km} KM</b> (${result.totalMeters}m) | RUN: <b>${runMin} MIN</b> | DRIVE: <b>${driveMin} MIN</b>`;
}

function resetAllRouting() {
  originPoint = null;
  destPoint = null;
  tempTapPoint = null;
  if (routeLine) map.removeLayer(routeLine);
  if (originMarker) map.removeLayer(originMarker);
  if (destMarker) map.removeLayer(destMarker);
  document.getElementById('manualX').value = '';
  document.getElementById('manualZ').value = '';
  document.getElementById('coordStatus').innerText = "TAP MAP OR TYPE COORDS";
}

fetch('data/recipes.json').then(r => r.json()).then(d => {
  recipes = d;
  renderCrafting(recipes);
});

function renderCrafting(list) {
  const c = document.getElementById('craftContainer');
  c.innerHTML = list.map(item => `
    <div class="tactical-card">
      <div class="card-head">
        <span class="card-title">${item.name}</span>
        <span class="card-badge">${item.category}</span>
      </div>
      <div class="card-body">${item.ing}</div>
    </div>
  `).join('');
}

function searchCrafting(q) {
  const box = document.getElementById('craftSuggestions');
  if (!q.trim()) {
    box.style.display = 'none';
    renderCrafting(recipes);
    return;
  }
  const needle = q.toLowerCase();
  const m = recipes.filter(r => r.name.toLowerCase().includes(needle) || r.ing.toLowerCase().includes(needle));
  box.style.display = 'block';
  box.innerHTML = m.slice(0, 6).map(r => `
    <div class="sugg-row" onclick="applyCraftFilter('${r.name.replace(/'/g, "\\'")}')">
      <span>${r.name}</span>
      <span style="opacity:0.5; font-size:10px;">${r.category}</span>
    </div>
  `).join('');
  renderCrafting(m);
}

function applyCraftFilter(name) {
  document.getElementById('craftInput').value = name;
  document.getElementById('craftSuggestions').style.display = 'none';
  renderCrafting(recipes.filter(r => r.name === name));
}

function updateBuild() {
  const type = document.getElementById('buildType').value;
  const count = Math.max(1, parseInt(document.getElementById('buildCount').value) || 1);
  const floors = parseInt(document.getElementById('towerFloors').value) || 1;
  const roof = document.getElementById('towerRoof').checked;
  const out = document.getElementById('buildOutput');

  let logs = 0, planks = 0, nails = 0, metal = 0, wire = 0;
  let summary = "";

  if (type === 'wood-wall') {
    logs = count * 2; planks = count * 20; nails = count * 36;
    summary = `WALL FRAME + WOOD PANELS`;
  } else if (type === 'metal-wall') {
    logs = count * 2; planks = count * 8; nails = count * 16; metal = count * 6;
    summary = `WALL FRAME + METAL PANELS`;
  } else if (type === 'gate-wood') {
    logs = count * 2; planks = count * 20; nails = count * 36; wire = count * 1;
    summary = `WOOD GATE + WIRE (PLIERS REQUIRED)`;
  } else if (type === 'gate-metal') {
    logs = count * 2; planks = count * 8; nails = count * 16; metal = count * 6; wire = count * 1;
    summary = `METAL GATE + WIRE (PLIERS REQUIRED)`;
  } else if (type === 'watchtower') {
    logs = floors * 4;
    planks = (floors * 30) + (roof ? 10 : 0);
    nails = (floors * 60) + (roof ? 20 : 0);
    summary = `WATCHTOWER: ${floors} STAGE(S)${roof ? ' + ROOF' : ''}`;
  }

  out.innerHTML = `
    <div style="font-size:11px; color:#c5a059; margin-bottom:8px;">${summary}</div>
    <div class="calc-grid">
      <div class="calc-val"><b>${logs}</b><span>LOGS</span></div>
      <div class="calc-val"><b>${planks}</b><span>PLANKS</span></div>
      <div class="calc-val"><b>${nails}</b><span>NAILS (${(nails / 70).toFixed(1)} BX)</span></div>
      ${metal > 0 ? `<div class="calc-val"><b>${metal}</b><span>SHEET METAL</span></div>` : ''}
      ${wire > 0 ? `<div class="calc-val"><b>${wire}</b><span>WIRE</span></div>` : ''}
    </div>
    <div style="margin-top:8px; font-size:10px; color:#6d7563;">Milling: Requires ${Math.ceil(planks / 4)} logs via Saw</div>
  `;
}

function handleBuildTypeChange() {
  const type = document.getElementById('buildType').value;
  document.getElementById('towerFields').style.display = type === 'watchtower' ? 'block' : 'none';
  document.getElementById('wallFields').style.display = type === 'watchtower' ? 'none' : 'block';
  updateBuild();
}

fetch('data/items.json').then(r => r.json()).then(d => { shoppingData = d; });

function handleShopInput(q) {
  const box = document.getElementById('shopSuggestions');
  if (!q.trim()) { box.style.display = 'none'; return; }
  const m = shoppingData.filter(i => i.toLowerCase().includes(q.toLowerCase()));
  box.style.display = 'block';
  box.innerHTML = m.slice(0, 6).map(i => `
    <div class="sugg-row" onclick="selectShopSuggestion('${i.replace(/'/g, "\\'")}')">
      <span>${i}</span>
    </div>
  `).join('');
}

function selectShopSuggestion(val) {
  document.getElementById('shopInput').value = val;
  document.getElementById('shopSuggestions').style.display = 'none';
  addShopItem();
}

function addShopItem() {
  const inp = document.getElementById('shopInput');
  const txt = inp.value.trim();
  if (!txt) return;
  const list = JSON.parse(localStorage.getItem('dayz_shop') || '[]');
  list.push({ text: txt, done: false });
  localStorage.setItem('dayz_shop', JSON.stringify(list));
  inp.value = '';
  document.getElementById('shopSuggestions').style.display = 'none';
  renderShop();
}

function toggleShop(idx) {
  const list = JSON.parse(localStorage.getItem('dayz_shop') || '[]');
  list[idx].done = !list[idx].done;
  localStorage.setItem('dayz_shop', JSON.stringify(list));
  renderShop();
}

function clearShop() {
  localStorage.removeItem('dayz_shop');
  renderShop();
}

function renderShop() {
  const list = JSON.parse(localStorage.getItem('dayz_shop') || '[]');
  const c = document.getElementById('shopContainer');
  c.innerHTML = list.map((item, idx) => `
    <div class="tactical-card ${item.done ? 'striked' : ''}" onclick="toggleShop(${idx})">
      <span>[${item.done ? 'X' : ' '}] ${item.text}</span>
    </div>
  `).join('');
}

function inspectNode(title, cause, treat) {
  const out = document.getElementById('medOut');
  out.innerHTML = `
    <div class="diag-header">${title}</div>
    <div class="diag-sec"><span>AGENT/CAUSE:</span> ${cause}</div>
    <div class="diag-sec"><span>PROTOCOL:</span> <b>${treat}</b></div>
  `;
}

function tab(id, el) {
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
  if (id === 'map-page') map.invalidateSize();
}

window.tab = tab;
window.setOrigin = setOrigin;
window.setDestination = setDestination;
window.resetAllRouting = resetAllRouting;
window.searchCrafting = searchCrafting;
window.applyCraftFilter = applyCraftFilter;
window.handleBuildTypeChange = handleBuildTypeChange;
window.updateBuild = updateBuild;
window.handleShopInput = handleShopInput;
window.selectShopSuggestion = selectShopSuggestion;
window.addShopItem = addShopItem;
window.toggleShop = toggleShop;
window.clearShop = clearShop;
window.inspectNode = inspectNode;

renderShop();
handleBuildTypeChange();
