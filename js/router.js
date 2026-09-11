class RoadRouter {
  constructor() {
    this.nodes = {};
    this.adj = {};
  }

  loadGraph(graphData) {
    this.nodes = graphData.nodes;
    this.adj = {};

    for (const key in this.nodes) {
      this.adj[key] = [];
    }

    graphData.edges.forEach(([u, v]) => {
      if (this.nodes[u] && this.nodes[v]) {
        const dist = this.euclidean(this.nodes[u], this.nodes[v]);
        this.adj[u].push({ node: v, weight: dist });
        this.adj[v].push({ node: u, weight: dist });
      }
    });
  }

  euclidean(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.z - p2.z);
  }

  findNearestNode(x, z) {
    let nearest = null;
    let minDist = Infinity;
    for (const [id, pt] of Object.entries(this.nodes)) {
      const d = Math.hypot(pt.x - x, pt.z - z);
      if (d < minDist) {
        minDist = d;
        nearest = id;
      }
    }
    return { id: nearest, dist: minDist };
  }

  findShortestPath(startKey, endKey) {
    const distances = {};
    const previous = {};
    const queue = new Set(Object.keys(this.nodes));

    for (const node of queue) {
      distances[node] = Infinity;
    }
    distances[startKey] = 0;

    while (queue.size > 0) {
      let curr = null;
      let minVal = Infinity;
      for (const node of queue) {
        if (distances[node] < minVal) {
          minVal = distances[node];
          curr = node;
        }
      }

      if (!curr || distances[curr] === Infinity) break;
      if (curr === endKey) break;

      queue.delete(curr);

      for (const edge of this.adj[curr]) {
        if (queue.has(edge.node)) {
          const alt = distances[curr] + edge.weight;
          if (alt < distances[edge.node]) {
            distances[edge.node] = alt;
            previous[edge.node] = curr;
          }
        }
      }
    }

    const path = [];
    let step = endKey;
    while (step) {
      path.unshift(step);
      step = previous[step];
    }
    return path[0] === startKey ? path : [];
  }
}

window.RoadRouter = RoadRouter;
