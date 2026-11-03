// Pure CWL multi-day assignment engine. Never mutates stored member, lock or profile data.
export function planCwl({members = [], archivedMembers = [], locks = [], slots = 15, days = 7} = {}) {
  if (!Number.isInteger(days) || days < 1 || days > 7 || !Number.isInteger(slots) || slots < 1 || slots > 50)
    throw new RangeError('Ungültige Anzahl an CWL-Tagen oder Plätzen.');
  const roster = members.filter(m => m && m.id);
  const all = new Map([...archivedMembers, ...roster].filter(m => m && m.id).map(m => [m.id, m]));
  const counts = Object.fromEntries([...all.keys()].map(id => [id, 0]));
  const playedCounts = {...counts};
  const conflicts = [];
  const notices = [];
  const locked = Array.from({length: days}, (_, d) => !!locks[d]?.locked);
  const plans = Array.from({length: days}, (_, d) => ({day: d + 1, locked: locked[d], lineup: [], warnings: []}));
  const addConflict = text => { if (!conflicts.includes(text)) conflicts.push(text); };
  const participants = roster.filter(m => m.participating && m.cocSyncState !== 'former' && String(m.name || '').trim());
  const active = new Map(participants.map(m => [m.id, m]));
  const required = Array.from({length: days}, () => []);
  const available = new Map(participants.map(m => [m.id, []]));
  const lockedCount = new Map();
  const forcedCount = new Map();
  for (let d = 0; d < days; d++) {
    if (!locked[d]) continue;
    const lineup = Array.isArray(locks[d]?.lineup) ? [...locks[d].lineup] : [];
    plans[d].lineup = lineup;
    if (lineup.length !== slots) plans[d].warnings.push(`Gespielter Tag hat ${lineup.length} statt ${slots} Spieler.`);
    if (new Set(lineup).size !== lineup.length) plans[d].warnings.push('Gespielter Tag enthält doppelte Spieler.');
    for (const id of lineup) {
      counts[id] = (counts[id] || 0) + 1;
      playedCounts[id] = (playedCounts[id] || 0) + 1;
      lockedCount.set(id, (lockedCount.get(id) || 0) + 1);
    }
  }
  for (let d = 0; d < days; d++) {
    if (locked[d]) continue;
    const eligible = participants.filter(m => m.statuses?.[d] !== 'out');
    if (eligible.length < slots) addConflict(`Tag ${d + 1}: Nur ${eligible.length} von ${slots} benötigten Spielern verfügbar.`);
    for (const m of eligible) {
      if (m.fixed || m.statuses?.[d] === 'must') {
        required[d].push(m.id);
        forcedCount.set(m.id, (forcedCount.get(m.id) || 0) + 1);
      } else available.get(m.id).push(d);
    }
    if (required[d].length > slots) addConflict(`Tag ${d + 1}: ${required[d].length} Fix-/MUSS-Spieler für ${slots} Plätze.`);
  }
  const exact = new Map();
  for (const m of roster) {
    if (m.fixed || m.targetDays == null || m.targetDays === '') continue;
    const target = Number(m.targetDays);
    if (!Number.isInteger(target) || target < 1 || target >= days) {
      addConflict(`${m.name}: Einsatzziel ${String(m.targetDays)} ist bei ${days} Tagen nicht zulässig (maximal ${days - 1}; für alle Tage „Fix“ nutzen).`);
      continue;
    }
    const played = lockedCount.get(m.id) || 0;
    if (played > target) addConflict(`${m.name}: Bereits ${played} Einsätze gespielt, Ziel nur ${target}.`);
    if (!active.has(m.id)) continue; // Paused and departed players keep their settings, but receive no new assignments.
    const forced = forcedCount.get(m.id) || 0;
    const remaining = target - played - forced;
    if (remaining < 0) addConflict(`${m.name}: ${played + forced} gespielte/Fix-/MUSS-Einsätze überschreiten Ziel ${target}.`);
    if (remaining > (available.get(m.id)?.length || 0))
      addConflict(`${m.name}: Ziel ${target} nicht erreichbar – nur ${played + forced + (available.get(m.id)?.length || 0)} Einsätze möglich.`);
    exact.set(m.id, remaining);
  }
  const futureSeats = required.reduce((sum, ids, d) => sum + (locked[d] ? 0 : Math.max(0, slots - ids.length)), 0);
  const exactDemand = [...exact.values()].reduce((sum, n) => sum + Math.max(0, n), 0);
  if (exactDemand > futureSeats)
    addConflict(`Einsatzziele benötigen ${exactDemand} weitere Plätze, verfügbar sind nach Fix/MUSS nur ${futureSeats}.`);

  const assigned = Array.from({length: days}, () => []);
  if (!conflicts.length && futureSeats) {
    // Min-cost circulation with lower bounds: exact targets and daily slots are hard constraints.
    // Each optional nth assignment has rising cost: fair total counts across the whole CWL.
    const S = 0, T = 1, memberNode = new Map(), dayNode = new Map();
    let next = 2;
    for (const m of participants) if (available.get(m.id).length) memberNode.set(m.id, next++);
    for (let d = 0; d < days; d++) if (!locked[d] && slots > required[d].length) dayNode.set(d, next++);
    const SS = next++, TT = next++, graph = Array.from({length: next}, () => []), balance = new Array(next).fill(0);
    const addEdge = (u, v, capacity, cost = 0) => {
      const forward = {to: v, cap: capacity, cost, rev: graph[v].length};
      const reverse = {to: u, cap: 0, cost: -cost, rev: graph[u].length};
      graph[u].push(forward); graph[v].push(reverse);
      return forward;
    };
    const addLower = (u, v, lower, upper, cost = 0) => {
      if (upper < lower) throw new Error('Invalid flow bounds');
      balance[u] -= lower; balance[v] += lower;
      return addEdge(u, v, upper - lower, cost);
    };
    const assignmentEdges = [];
    for (const m of participants) {
      const node = memberNode.get(m.id);
      if (node == null) continue;
      const options = available.get(m.id);
      if (exact.has(m.id)) {
        const needed = exact.get(m.id);
        addLower(S, node, needed, needed);
      } else {
        const previously = (lockedCount.get(m.id) || 0) + (forcedCount.get(m.id) || 0);
        const weight = m.rotationWeight === 'preferred' ? -45 : m.rotationWeight === 'less' ? 45 : 0;
        const legacy = m.rotationWeight == null ? Math.max(0, Math.min(5, Number(m.priority) || 0)) : 0;
        for (let n = 1; n <= options.length; n++)
          addEdge(S, node, 1, 100 * (2 * (previously + n) - 1) + weight - 6 * legacy);
      }
      for (const d of options) {
        const day = dayNode.get(d);
        if (day == null) continue;
        const seed = [...String(m.id)].reduce((v, c) => (v * 31 + c.charCodeAt(0)) % 997, 0);
        assignmentEdges.push({id: m.id, day: d, edge: addEdge(node, day, 1, (seed + d * 17) % 7)});
      }
    }
    for (const [d, node] of dayNode) addLower(node, T, slots - required[d].length, slots - required[d].length);
    addEdge(T, S, futureSeats);
    let demand = 0;
    for (let i = 0; i < SS; i++) {
      if (balance[i] > 0) { addEdge(SS, i, balance[i]); demand += balance[i]; }
      else if (balance[i] < 0) addEdge(i, TT, -balance[i]);
    }
    // Successive shortest augmenting paths with nonnegative reduced costs.
    const potential = new Array(next).fill(0);
    let pushed = 0;
    while (pushed < demand) {
      const dist = new Array(next).fill(Infinity), prevNode = new Array(next).fill(-1), prevEdge = new Array(next).fill(-1);
      dist[SS] = 0;
      const heap = [[0, SS]];
      const push = entry => {
        heap.push(entry); let i = heap.length - 1;
        while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= entry[0]) break; heap[i] = heap[p]; i = p; }
        heap[i] = entry;
      };
      const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
          let i = 0;
          while (i * 2 + 1 < heap.length) {
            let c = i * 2 + 1;
            if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++;
            if (heap[c][0] >= last[0]) break;
            heap[i] = heap[c]; i = c;
          }
          heap[i] = last;
        }
        return top;
      };
      while (heap.length) {
        const [score, u] = pop();
        if (score !== dist[u]) continue;
        for (let i = 0; i < graph[u].length; i++) {
          const e = graph[u][i]; if (!e.cap) continue;
          const nd = score + e.cost + potential[u] - potential[e.to];
          if (nd < dist[e.to]) { dist[e.to] = nd; prevNode[e.to] = u; prevEdge[e.to] = i; push([nd, e.to]); }
        }
      }
      if (prevNode[TT] < 0) break;
      for (let v = 0; v < next; v++) if (dist[v] < Infinity) potential[v] += dist[v];
      let amount = demand - pushed;
      for (let v = TT; v !== SS; v = prevNode[v]) amount = Math.min(amount, graph[prevNode[v]][prevEdge[v]].cap);
      for (let v = TT; v !== SS; v = prevNode[v]) {
        const e = graph[prevNode[v]][prevEdge[v]];
        e.cap -= amount; graph[v][e.rev].cap += amount;
      }
      pushed += amount;
    }
    if (pushed !== demand) {
      addConflict('Einsatzziele, Tagesregeln und verfügbare Plätze lassen sich über alle Kriegstage nicht gleichzeitig erfüllen. Bitte die Regeln prüfen.');
    } else for (const {id, day, edge} of assignmentEdges) if (edge.cap === 0) assigned[day].push(id);
  }
  const order = new Map(roster.map((m, i) => [m.id, i]));
  const running = Object.fromEntries(Object.keys(counts).map(id => [id, 0]));
  for (let d = 0; d < days; d++) {
    const p = plans[d];
    p.startingCounts = {...running};
    if (!locked[d]) {
      p.lineup = [...new Set([...required[d], ...(!conflicts.length ? assigned[d] : [])])].sort((a, b) => (order.get(a) ?? 999999) - (order.get(b) ?? 999999));
      if (conflicts.length) p.warnings.push(...conflicts);
      if (p.lineup.length !== slots && !conflicts.length) p.warnings.push(`Nur ${p.lineup.length} von ${slots} Plätzen besetzt.`);
    }
    for (const id of p.lineup) if (!locked[d]) counts[id] = (counts[id] || 0) + 1;
    for (const id of p.lineup) running[id] = (running[id] || 0) + 1;
    const previous = d ? plans[d - 1].lineup : [];
    p.rein = d ? p.lineup.filter(id => !previous.includes(id)) : [];
    p.raus = d ? previous.filter(id => !p.lineup.includes(id)) : [];
  }
  if (!conflicts.length) {
    const totals = participants.filter(m => !m.fixed).map(m => counts[m.id] || 0);
    const min = Math.min(...totals), max = Math.max(...totals);
    if (totals.length > 1 && max - min >= 3)
      notices.push(`Die Rotation ist deutlich ungleich verteilt (${max}:${min}). Feste Einsatzziele und Verfügbarkeiten werden eingehalten.`);
  }
  return {ok: conflicts.length === 0, conflicts, notices, dayPlans: plans, counts, playedCounts};
}
