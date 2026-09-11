const MAP_SIZE = 15360;
const router = new RoadRouter();
let recipes = [];
let shoppingData = [];
let routeWaypoints = [];
let routeLine = null;
let coordMarker = null;

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -4,
  maxZoom: 1,
  zoomSnap: 0.5,
  attributionControl: false
});

const mapBounds = [[0, 0], [MAP_SIZE, MAP_SIZE]];
map.fitBounds(mapBounds);
map.setMaxBounds(mapBounds);

function generateTopographyCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = "#11140e";
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.fillStyle = "#0a0c09";
  ctx.beginPath();
  ctx.moveTo(1024, 1024);
  ctx.lineTo(800, 1024);
  ctx.bezierCurveTo(750, 700, 500, 400, 300, 200);
  ctx.lineTo(100, 0);
  ctx.lineTo(1024, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#1b2118";
  ctx.lineWidth = 1;
  for (let i = 50; i < 1024; i += 64) {
    ctx.beginPath();
    ctx.arc(400, 600, i, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(700, 300, i * 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = "#252d21";
  ctx.lineWidth = 2;
  for (let c = 0; c <= 1024; c += 128) {
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, 1024); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(1024, c); ctx.stroke();
  }
  return canvas.toDataURL();
}

L.imageOverlay(generateTopographyCanvas(), mapBounds, { opacity: 1.0 }).addTo(map);

fetch('data/roads.json')
  .then((r) => r.json())
  .then((data) => {
    router.loadGraph(data);

    data.edges.forEach(([u, v]) => {
      const p1 = data.nodes[u];
      const p2 = data.nodes[v];
      L.polyline([[p1.z, p1.x], [p2.z, p2.x]], {
        color: '#8b734b',
        weight: 2.5,
        opacity: 0.75,
        dashArray: '4, 4'
      }).addTo(map);
    });

    for (const k in data.nodes) {
      const n = data.nodes[k];
      const dot = L.circleMarker([n.z, n.x], {
        radius: 3,
        color: '#c5a059',
        fillColor: '#0d0f0c',
        fillOpacity: 1,
        weight: 1.5
      }).addTo(map);
      dot.bindTooltip(`${n.name} [${n.x}, ${n.z}]`, { direction: 'top', className: 'tactical-tooltip' });
    }
  });

map.on('click', (e) => {
  const x = Math.round(e.latlng.lng);
  const z = Math.round(e.latlng.lat);
  if (x < 0 || x > MAP_SIZE || z < 0 || z > MAP_SIZE) return;

  const mode = document.getElementById('mapMode').value;
  if (mode === 'coord') {
    if (coordMarker) map.removeLayer(coordMarker);
    coordMarker = L.circleMarker([z, x], { radius: 6, color: '#e54242', fillColor: '#fff', fillOpacity: 0.8 }).addTo(map);
    document.getElementById('coordStatus').innerHTML = `GRID REF: <b>X ${x} | Z ${z}</b>`;
  } else {
    handleRoutePoint(x, z);
  }
});

function handleRoutePoint(x, z) {
  const match = router.findNearest(x, z);
  if (!match.id) return;

  routeWaypoints.push({ x, z, node: match.id });
  L.circleMarker([z, x], {
    radius: 6,
    color: routeWaypoints.length === 1 ? '#5d9948' : '#e54242',
    fillColor: '#000',
    fillOpacity: 0.8
  }).addTo(map);

  if (routeWaypoints.length === 2) {
    const start = routeWaypoints[0];
    const end = routeWaypoints[1];
    const path = router.findPath(start.node, end.node);

    if (path.length === 0) {
      document.getElementById('coordStatus').innerText = "NO ROAD LINK BETWEEN TARGET NODES";
      return;
    }

    const coords = [[start.z, start.x]];
    path.forEach((id) => coords.push([router.nodes[id].z, router.nodes[id].x]));
    coords.push([end.z, end.x]);

    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline(coords, { color: '#e5a93c', weight: 4, opacity: 0.9 }).addTo(map);

    let d = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      d += Math.hypot(coords[i][1] - coords[i + 1][1], coords[i][0] - coords[i + 1][0]);
    }
    document.getElementById('coordStatus').innerHTML = `DIST: <b>${(d / 1000).toFixed(2)} KM</b> | ETA RUN: <b>${Math.round(d / 260)} MIN</b>`;
  } else if (routeWaypoints.length > 2) {
    clearRouting();
    handleRoutePoint(x, z);
  }
}

function clearRouting() {
  routeWaypoints = [];
  if (routeLine) map.removeLayer(routeLine);
  if (coordMarker) map.removeLayer(coordMarker);
  map.eachLayer((l) => {
    if (l instanceof L.CircleMarker && !l._tooltip) map.removeLayer(l);
  });
  document.getElementById('coordStatus').innerText = "SELECT MAP POSITION";
}

fetch('data/recipes.json')
  .then((r) => r.json())
  .then((d) => {
    recipes = d;
    renderCrafting(recipes);
  });

function renderCrafting(list) {
  const c = document.getElementById('craftContainer');
  c.innerHTML = list.map((item) => `
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
  const m = recipes.filter((r) => r.name.toLowerCase().includes(needle) || r.ing.toLowerCase().includes(needle));

  box.style.display = 'block';
  box.innerHTML = m.slice(0, 6).map((r) => `
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
  renderCrafting(recipes.filter((r) => r.name === name));
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
    logs = count * 2;
    planks = count * 20;
    nails = count * 36;
    summary = `WALL FRAME + WOOD PANELS (UPPER/LOWER)`;
  } else if (type === 'metal-wall') {
    logs = count * 2;
    planks = count * 8;
    nails = count * 16;
    metal = count * 6;
    summary = `WALL FRAME + 6x METAL PLATES`;
  } else if (type === 'gate-wood') {
    logs = count * 2;
    planks = count * 20;
    nails = count * 36;
    wire = count * 1;
    summary = `WOOD WALL + 1x METAL WIRE (PLIERS NEEDED)`;
  } else if (type === 'gate-metal') {
    logs = count * 2;
    planks = count * 8;
    nails = count * 16;
    metal = count * 6;
    wire = count * 1;
    summary = `METAL WALL + 1x METAL WIRE (PLIERS NEEDED)`;
  } else if (type === 'watchtower') {
    logs = floors * 4;
    planks = (floors * 30) + (roof ? 10 : 0);
    nails = (floors * 60) + (roof ? 20 : 0);
    summary = `WATCHTOWER: ${floors} LEVEL(S)${roof ? ' + ROOF' : ''}`;
  }

  out.innerHTML = `
    <div style="font-size:11px; color:#8b734b; margin-bottom:8px;">${summary}</div>
    <div class="calc-grid">
      <div class="calc-val"><b>${logs}</b><span>LOGS</span></div>
      <div class="calc-val"><b>${planks}</b><span>PLANKS</span></div>
      <div class="calc-val"><b>${nails}</b><span>NAILS (${(nails / 70).toFixed(1)} BX)</span></div>
      ${metal > 0 ? `<div class="calc-val"><b>${metal}</b><span>SHEET METAL</span></div>` : ''}
      ${wire > 0 ? `<div class="calc-val"><b>${wire}</b><span>WIRE</span></div>` : ''}
    </div>
    <div style="margin-top:8px; font-size:10px; color:#68725e;">Log Conversion: ${Math.ceil(planks / 4)} logs if milled via Handsaw/Hacksaw</div>
  `;
}

function handleBuildTypeChange() {
  const type = document.getElementById('buildType').value;
  document.getElementById('towerFields').style.display = type === 'watchtower' ? 'block' : 'none';
  document.getElementById('wallFields').style.display = type === 'watchtower' ? 'none' : 'block';
  updateBuild();
}

fetch('data/items.json')
  .then((r) => r.json())
  .then((d) => { shoppingData = d; });

function handleShopInput(q) {
  const box = document.getElementById('shopSuggestions');
  if (!q.trim()) {
    box.style.display = 'none';
    return;
  }
  const m = shoppingData.filter((i) => i.toLowerCase().includes(q.toLowerCase()));
  box.style.display = 'block';
  box.innerHTML = m.slice(0, 5).map((i) => `
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
  document.querySelectorAll('.tab-page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach((b) => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  el.classList.add('active');
  if (id === 'map-page') map.invalidateSize();
}

window.tab = tab;
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
window.clearRouting = clearRouting;

renderShop();
handleBuildTypeChange();
