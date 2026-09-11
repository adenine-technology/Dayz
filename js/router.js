class RoadRouter {
  constructor() {
    this.nodes = {};
    this.adj = {};
  }

  loadGraph(data) {
    this.nodes = data.nodes;
    this.adj = {};
    for (const k in this.nodes) {
      this.adj[k] = [];
    }
    data.edges.forEach(([u, v]) => {
      if (this.nodes[u] && this.nodes[v]) {
        const d = Math.hypot(this.nodes[u].x - this.nodes[v].x, this.nodes[u].z - this.nodes[v].z);
        this.adj[u].push({ node: v, w: d });
        this.adj[v].push({ node: u, w: d });
      }
    });
  }

  findNearest(x, z) {
    let best = null;
    let min = Infinity;
    for (const [id, pt] of Object.entries(this.nodes)) {
      const d = Math.hypot(pt.x - x, pt.z - z);
      if (d < min) {
        min = d;
        best = id;
      }
    }
    return { id: best, dist: min };
  }

  findPath(start, end) {
    const dist = {};
    const prev = {};
    const q = new Set(Object.keys(this.nodes));

    for (const k of q) dist[k] = Infinity;
    dist[start] = 0;

    while (q.size > 0) {
      let u = null;
      let min = Infinity;
      for (const k of q) {
        if (dist[k] < min) {
          min = dist[k];
          u = k;
        }
      }
      if (!u || dist[u] === Infinity || u === end) break;
      q.delete(u);

      for (const e of this.adj[u]) {
        if (q.has(e.node)) {
          const alt = dist[u] + e.w;
          if (alt < dist[e.node]) {
            dist[e.node] = alt;
            prev[e.node] = u;
          }
        }
      }
    }

    const path = [];
    let cur = end;
    while (cur) {
      path.unshift(cur);
      cur = prev[cur];
    }
    return path[0] === start ? path : [];
  }
}
window.RoadRouter = RoadRouter;
