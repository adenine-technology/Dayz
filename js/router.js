class RoadRouter {
  constructor() {
    this.nodes = {};
    this.adj = {};
    this.edges = [];
  }

  loadGraph(data) {
    this.nodes = data.nodes;
    this.adj = {};
    this.edges = [];
    for (const k in this.nodes) {
      this.adj[k] = [];
    }
    data.edges.forEach(([u, v]) => {
      if (this.nodes[u] && this.nodes[v]) {
        const d = Math.hypot(this.nodes[u].x - this.nodes[v].x, this.nodes[u].z - this.nodes[v].z);
        this.adj[u].push({ node: v, w: d });
        this.adj[v].push({ node: u, w: d });
        this.edges.push({ u, v, w: d });
      }
    });
  }

  getClosestPointOnSegment(p, a, b) {
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const apx = p.x - a.x;
    const apz = p.z - a.z;
    const ab2 = abx * abx + abz * abz;
    let t = ab2 === 0 ? 0 : (apx * abx + apz * abz) / ab2;
    t = Math.max(0, Math.min(1, t));
    return {
      x: Math.round(a.x + t * abx),
      z: Math.round(a.z + t * abz),
      t: t
    };
  }

  snapToRoad(x, z) {
    const target = { x, z };
    let bestDist = Infinity;
    let bestSnap = null;
    let bestEdge = null;

    for (const e of this.edges) {
      const p1 = this.nodes[e.u];
      const p2 = this.nodes[e.v];
      const proj = this.getClosestPointOnSegment(target, p1, p2);
      const d = Math.hypot(proj.x - x, proj.z - z);
      if (d < bestDist) {
        bestDist = d;
        bestSnap = proj;
        bestEdge = e;
      }
    }
    return { snapPoint: bestSnap, edge: bestEdge, dist: bestDist };
  }

  findAStar(startKey, endKey) {
    const gScore = {};
    const fScore = {};
    const cameFrom = {};
    const openSet = new Set(Object.keys(this.nodes));

    for (const k of openSet) {
      gScore[k] = Infinity;
      fScore[k] = Infinity;
    }

    gScore[startKey] = 0;
    fScore[startKey] = Math.hypot(
      this.nodes[startKey].x - this.nodes[endKey].x,
      this.nodes[startKey].z - this.nodes[endKey].z
    );

    while (openSet.size > 0) {
      let current = null;
      let minF = Infinity;
      for (const node of openSet) {
        if (fScore[node] < minF) {
          minF = fScore[node];
          current = node;
        }
      }

      if (!current || gScore[current] === Infinity) break;
      if (current === endKey) {
        const path = [];
        let curr = endKey;
        while (curr) {
          path.unshift(curr);
          curr = cameFrom[curr];
        }
        return path;
      }

      openSet.delete(current);

      for (const neighbor of this.adj[current]) {
        const tentG = gScore[current] + neighbor.w;
        if (tentG < gScore[neighbor.node]) {
          cameFrom[neighbor.node] = current;
          gScore[neighbor.node] = tentG;
          fScore[neighbor.node] = tentG + Math.hypot(
            this.nodes[neighbor.node].x - this.nodes[endKey].x,
            this.nodes[neighbor.node].z - this.nodes[endKey].z
          );
        }
      }
    }
    return [];
  }

  routeBetweenPoints(pA, pB) {
    const snapA = this.snapToRoad(pA.x, pA.z);
    const snapB = this.snapToRoad(pB.x, pB.z);
    if (!snapA.edge || !snapB.edge) return null;

    const candidatesA = [snapA.edge.u, snapA.edge.v];
    const candidatesB = [snapB.edge.u, snapB.edge.v];

    let shortest = null;
    let minLen = Infinity;

    for (const startNode of candidatesA) {
      for (const endNode of candidatesB) {
        const nodePath = this.findAStar(startNode, endNode);
        if (nodePath.length > 0) {
          let dist = Math.hypot(snapA.snapPoint.x - this.nodes[startNode].x, snapA.snapPoint.z - this.nodes[startNode].z);
          for (let i = 0; i < nodePath.length - 1; i++) {
            dist += Math.hypot(
              this.nodes[nodePath[i]].x - this.nodes[nodePath[i + 1]].x,
              this.nodes[nodePath[i]].z - this.nodes[nodePath[i + 1]].z
            );
          }
          dist += Math.hypot(snapB.snapPoint.x - this.nodes[endNode].x, snapB.snapPoint.z - this.nodes[endNode].z);

          if (dist < minLen) {
            minLen = dist;
            shortest = { nodePath, snapA: snapA.snapPoint, snapB: snapB.snapPoint };
          }
        }
      }
    }

    if (!shortest) return null;

    const fullCoords = [[pA.z, pA.x], [shortest.snapA.z, shortest.snapA.x]];
    shortest.nodePath.forEach(k => {
      fullCoords.push([this.nodes[k].z, this.nodes[k].x]);
    });
    fullCoords.push([shortest.snapB.z, shortest.snapB.x]);
    fullCoords.push([pB.z, pB.x]);

    let totalMeters = 0;
    for (let i = 0; i < fullCoords.length - 1; i++) {
      totalMeters += Math.hypot(fullCoords[i][1] - fullCoords[i + 1][1], fullCoords[i][0] - fullCoords[i + 1][0]);
    }

    return { coords: fullCoords, totalMeters: Math.round(totalMeters) };
  }
}
window.RoadRouter = RoadRouter;

