/**
 * Deterministic plan diff (spec §6 Step 6, §12B). Pure domain code —
 * the AI never computes the diff; it only explains the result.
 * Categories are matched trimmed and case-insensitively; duplicate
 * category names pair in order.
 */
export interface PlanVersionSnapshot {
  items: { category: string; amountMinor: bigint | null }[];
}

export interface PlanDiffEntry {
  category: string;
  v1AmountMinor: bigint | null;
  v2AmountMinor: bigint | null;
  /** v2 − v1 in minor units; null when either side has no amount. */
  deltaMinor: bigint | null;
}

export interface PlanDiff {
  added: PlanDiffEntry[];
  removed: PlanDiffEntry[];
  changed: PlanDiffEntry[];
  unchanged: PlanDiffEntry[];
}

function key(category: string): string {
  return category.trim().toLowerCase();
}

export function diffPlans(v1: PlanVersionSnapshot, v2: PlanVersionSnapshot): PlanDiff {
  const v1ByKey = new Map<string, { category: string; amountMinor: bigint | null }[]>();
  for (const item of v1.items) {
    const list = v1ByKey.get(key(item.category)) ?? [];
    list.push(item);
    v1ByKey.set(key(item.category), list);
  }

  const paired: PlanDiffEntry[] = [];
  const added: PlanDiffEntry[] = [];
  for (const item of v2.items) {
    const candidates = v1ByKey.get(key(item.category));
    const candidate = candidates && candidates.length > 0 ? candidates.shift()! : null;
    if (candidate) {
      paired.push({
        category: candidate.category,
        v1AmountMinor: candidate.amountMinor,
        v2AmountMinor: item.amountMinor,
        deltaMinor:
          candidate.amountMinor === null || item.amountMinor === null
            ? null
            : item.amountMinor - candidate.amountMinor,
      });
    } else {
      added.push({
        category: item.category,
        v1AmountMinor: null,
        v2AmountMinor: item.amountMinor,
        deltaMinor: item.amountMinor,
      });
    }
  }

  const removed: PlanDiffEntry[] = [];
  for (const list of v1ByKey.values()) {
    for (const item of list) {
      removed.push({
        category: item.category,
        v1AmountMinor: item.amountMinor,
        v2AmountMinor: null,
        deltaMinor: item.amountMinor === null ? null : -item.amountMinor,
      });
    }
  }

  const changed: PlanDiffEntry[] = [];
  const unchanged: PlanDiffEntry[] = [];
  for (const entry of paired) {
    if (entry.v1AmountMinor !== entry.v2AmountMinor) {
      changed.push(entry);
    } else {
      unchanged.push(entry);
    }
  }

  return { added, removed, changed, unchanged };
}
