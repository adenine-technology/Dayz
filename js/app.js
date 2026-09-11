const MAP_SIZE = 15360;
const router = new RoadRouter();

let waypoints = [];
let routePolyline = null;
let clickMarker = null;

// Leaflet coordinate setup: Lat is Z (North/South), Lng is X (East/West)
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -4,
  maxZoom: 2,
  zoomSnap: 0.5
});

const bounds = [[0, 0], [MAP_SIZE, MAP_SIZE]];
map.fitBounds(bounds);

fetch('data/roads.json')
  .then(res => res.json())
  .then(data => {
    router.loadGraph(data);
    // Render road network lines
    data.edges.forEach(([u, v]) => {
      const p1 = data.nodes[u];
      const p2 = data.nodes[v];
      L.polyline([[p1.z, p1.x], [p2.z, p2.x]], {
        color: '#444',
        weight: 2,
        opacity: 0.6
      }).addTo(map);
    });
  });

map.on('click', function(e) {
  const x = Math.round(e.latlng.lng);
  const z = Math.round(e.latlng.lat);

  if (x < 0 || x > MAP_SIZE || z < 0 || z > MAP_SIZE) return;

  const mode = document.getElementById('mapMode').value;

  if (mode === 'coord') {
    if (clickMarker) map.removeLayer(clickMarker);
    clickMarker = L.marker([z, x]).addTo(map);
    document.getElementById('coordDisplay').innerHTML = `Coord: <b>X: ${x} | Z: ${z}</b>`;
  } else {
    handleRoutingClick(x, z);
  }
});

function handleRoutingClick(x, z) {
  const nearest = router.findNearestNode(x, z);
  if (!nearest.id) return;

  waypoints.push({ x, z, node: nearest.id });
  L.circleMarker([z, x], { radius: 5, color: waypoints.length === 1 ? '#4caf50' : '#f44336' }).addTo(map);

  if (waypoints.length === 2) {
    calculateRoute();
  } else if (waypoints.length > 2) {
    resetRouting();
    waypoints.push({ x, z, node: nearest.id });
    L.circleMarker([z, x], { radius: 5, color: '#4caf50' }).addTo(map);
  }
}

function calculateRoute() {
  const start = waypoints[0];
  const end = waypoints[1];
  const path = router.findShortestPath(start.node, end.node);

  if (path.length === 0) {
    document.getElementById('coordDisplay').innerHTML = `No road connection found.`;
    return;
  }

  const latlngs = [[start.z, start.x]];
  path.forEach(id => {
    latlngs.push([router.nodes[id].z, router.nodes[id].x]);
  });
  latlngs.push([end.z, end.x]);

  if (routePolyline) map.removeLayer(routePolyline);
  routePolyline = L.polyline(latlngs, { color: '#00e5ff', weight: 4 }).addTo(map);

  let totalDist = 0;
  for (let i = 0; i < latlngs.length - 1; i++) {
    totalDist += Math.hypot(latlngs[i][1] - latlngs[i+1][1], latlngs[i][0] - latlngs[i+1][0]);
  }

  document.getElementById('coordDisplay').innerHTML = `Distance: <b>${(totalDist / 1000).toFixed(2)} km</b> (${Math.round(totalDist)}m)`;
}

function resetRouting() {
  waypoints = [];
  if (routePolyline) map.removeLayer(routePolyline);
  map.eachLayer(layer => {
    if (layer instanceof L.CircleMarker) map.removeLayer(layer);
  });
  document.getElementById('coordDisplay').innerHTML = `Tap Start Point then End Point`;
}

// Global functions for tabs and tools
window.switchTab = function(id, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
  if (id === 'map-tab') map.invalidateSize();
};

window.filterCrafting = function() {
  const val = document.getElementById('craftSearch').value.toLowerCase();
  document.querySelectorAll('#craftList .card').forEach(el => {
    el.style.display = el.getAttribute('data-name').includes(val) ? 'block' : 'none';
  });
};

window.calcBuild = function() {
  const count = parseInt(document.getElementById('fenceCount').value) || 0;
  const type = document.getElementById('plankOption').value;
  const logs = count * 2;
  const planks = type === 'wood' ? count * 20 : count * 8;
  const nails = type === 'wood' ? count * 36 : count * 16;
  document.getElementById('buildResults').innerHTML = `
    <b>Required:</b><br>
    - Logs: ${logs}<br>
    - Planks: ${planks} (${Math.ceil(planks / 4)} logs if milled)<br>
    - Nails: ${nails} (${(nails / 70).toFixed(1)} full boxes)
  `;
};

window.addShoppingItem = function() {
  const input = document.getElementById('shopInput');
  const txt = input.value.trim();
  if (!txt) return;
  const list = JSON.parse(localStorage.getItem('dayz_shop') || '[]');
  list.push({ text: txt, done: false });
  localStorage.setItem('dayz_shop', JSON.stringify(list));
  input.value = '';
  renderShopping();
};

window.toggleShopping = function(index) {
  const list = JSON.parse(localStorage.getItem('dayz_shop') || '[]');
  list[index].done = !list[index].done;
  localStorage.setItem('dayz_shop', JSON.stringify(list));
  renderShopping();
};

window.clearShopping = function() {
  localStorage.removeItem('dayz_shop');
  renderShopping();
};

function renderShopping() {
  const list = JSON.parse(localStorage.getItem('dayz_shop') || '[]');
  const container = document.getElementById('shopList');
  container.innerHTML = '';
  list.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'card' + (item.done ? ' done' : '');
    div.innerText = item.text;
    div.onclick = () => window.toggleShopping(idx);
    container.appendChild(div);
  });
}

renderShopping();
window.calcBuild();
