// Layout de reuniões que se sobrepõem no tempo: distribui em colunas lado a lado
// (igual Google Agenda) pra os cartões não ficarem um em cima do outro.
//
// Recebe itens com início/fim em minutos-do-dia e devolve, por id, a coluna que
// o cartão ocupa (`col`) e quantas colunas o "aglomerado" tem (`cols`).

export type OverlapItem = { id: string; startMin: number; endMin: number };
export type Placed = { col: number; cols: number };

export function computeOverlapColumns(items: OverlapItem[]): Map<string, Placed> {
  const res = new Map<string, Placed>();
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  let cluster: { id: string; col: number }[] = [];
  let colEnds: number[] = []; // fim (min) da última reunião de cada coluna do aglomerado
  let clusterEnd = -Infinity;

  const flush = () => {
    const cols = colEnds.length;
    for (const it of cluster) res.set(it.id, { col: it.col, cols });
    cluster = [];
    colEnds = [];
    clusterEnd = -Infinity;
  };

  for (const it of sorted) {
    // Se não sobrepõe nenhum do aglomerado atual, fecha o aglomerado.
    if (it.startMin >= clusterEnd) flush();

    // Acha a 1ª coluna livre (que terminou antes deste começar); senão, cria nova.
    let col = colEnds.findIndex((end) => end <= it.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.endMin);
    } else {
      colEnds[col] = it.endMin;
    }
    cluster.push({ id: it.id, col });
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return res;
}

// Estilo (left/width em %) do cartão a partir da coluna que ele ocupa.
export function overlapStyle(placed: Placed | undefined): { left: string; width: string } {
  const cols = placed?.cols ?? 1;
  const col = placed?.col ?? 0;
  const w = 100 / cols;
  return { left: `calc(${col * w}% + 2px)`, width: `calc(${w}% - 4px)` };
}
