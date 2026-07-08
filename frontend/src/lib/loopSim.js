// 코어 루프 시뮬레이터 — 전투(킬)로 골드를 벌어 강화하고, 강화가 다음 전투를 빠르게 만드는
// 순환을 프론트에서 즉시 계산한다(결정론적 수식, AI 불필요 → 슬라이더 조작에 지연 없음).
// DPS/TTK 기본 공식은 백엔드 simulator/balance 라우터와 동일하게 맞춘다:
//   attack = base_attack * (1+growth_rate)^level, effective = max(attack-def, 1),
//   dps = effective * attacks_per_second, ttk = hp/dps

// 강화 단계당 효과량(고정 상수 — 슬라이더로 노출하기엔 지나치게 세부적인 값).
export const GOLD_MULT_PER_LEVEL = 0.12;   // 골드 획득량 강화 1단계 = +12%
export const CRIT_CHANCE_PER_LEVEL = 0.03; // 치명타 강화 1단계 = 크리티컬 확률 +3%p
export const CRIT_CHANCE_CAP = 0.95;

export function upgradeCost(base, growth, level) {
  return base * Math.pow(growth, level);
}

// 현재 강화 단계 기준 "한 킬"의 순간 스탯(공격력·DPS·TTK·킬당 골드).
export function combatSnapshot(p) {
  const attack = p.base_attack * Math.pow(1 + p.growth_rate, p.atk_level);
  const effective = Math.max(attack - p.monster_def, 1);
  const baseDps = effective * p.attacks_per_second;
  const critChance = Math.min(CRIT_CHANCE_CAP, p.crit_chance + p.crit_level * CRIT_CHANCE_PER_LEVEL);
  const critMultEff = 1 + critChance * (p.crit_mult - 1);
  const dps = baseDps * critMultEff;
  const ttk = p.monster_hp / Math.max(dps, 0.0001);
  const goldMultEff = 1 + p.gold_level * GOLD_MULT_PER_LEVEL;
  const goldPerKill = p.loot_chance * p.loot_value * p.sell_multiplier * goldMultEff;
  const killsPerMinute = 60 / Math.max(ttk, 0.0001);
  return {
    attack, effective, dps, ttk, critChance, critMultEff,
    goldMultEff, goldPerKill, killsPerMinute,
    goldPerMinute: goldPerKill * killsPerMinute,
  };
}

// 세 강화 트랙의 "다음 레벨" 비용 + 그 강화를 샀을 때 골드/분이 몇 % 개선되는지 미리보기.
export function upgradePreview(p) {
  const now = combatSnapshot(p);
  const tracks = [
    { key: "atk", label: "⚔ 공격력", level: p.atk_level, cost: upgradeCost(p.atk_cost_base, p.atk_cost_growth, p.atk_level), patch: { atk_level: p.atk_level + 1 } },
    { key: "gold", label: "💰 골드 획득량", level: p.gold_level, cost: upgradeCost(p.gold_cost_base, p.gold_cost_growth, p.gold_level), patch: { gold_level: p.gold_level + 1 } },
    { key: "crit", label: "🎲 확률/치명타", level: p.crit_level, cost: upgradeCost(p.crit_cost_base, p.crit_cost_growth, p.crit_level), patch: { crit_level: p.crit_level + 1 } },
  ];
  return tracks.map((t) => {
    const after = combatSnapshot({ ...p, ...t.patch });
    const gain = now.goldPerMinute > 0 ? (after.goldPerMinute / now.goldPerMinute - 1) * 100 : 0;
    return { ...t, goldPerMinuteAfter: after.goldPerMinute, gainPct: gain, loopsToAfford: now.goldPerKill > 0 ? Math.ceil(Math.max(0, t.cost) / now.goldPerKill) : Infinity };
  });
}

// 세션(연속 N킬) 시뮬레이션: 매 킬마다 골드를 얻고, 지갑이 충분하면 우선순위대로 자동 강화.
// priority: ["atk","gold","crit"] 순서(앞쪽을 우선 구매).
export function simulateSession(p0, loops, priority, autoBuy) {
  let p = { ...p0 };
  let wallet = 0, totalGold = 0, elapsed = 0;
  const bought = { atk: 0, gold: 0, crit: 0 };
  const rows = [];
  const costOf = (k) =>
    k === "atk" ? upgradeCost(p.atk_cost_base, p.atk_cost_growth, p.atk_level) :
    k === "gold" ? upgradeCost(p.gold_cost_base, p.gold_cost_growth, p.gold_level) :
    upgradeCost(p.crit_cost_base, p.crit_cost_growth, p.crit_level);
  const buy = (k) => {
    if (k === "atk") p.atk_level += 1;
    else if (k === "gold") p.gold_level += 1;
    else p.crit_level += 1;
    bought[k] += 1;
  };

  for (let i = 1; i <= loops; i++) {
    const snap = combatSnapshot(p);
    wallet += snap.goldPerKill;
    totalGold += snap.goldPerKill;
    elapsed += snap.ttk;

    if (autoBuy) {
      let bought_this_loop = true;
      while (bought_this_loop) {
        bought_this_loop = false;
        for (const k of priority) {
          const c = costOf(k);
          if (wallet >= c) { wallet -= c; buy(k); bought_this_loop = true; break; }
        }
      }
    }
    rows.push({
      loop: i, gold: Math.round(totalGold), wallet: Math.round(wallet),
      dps: Math.round(snap.dps * 10) / 10, ttk: Math.round(snap.ttk * 100) / 100,
      atk_level: p.atk_level, gold_level: p.gold_level, crit_level: p.crit_level,
    });
  }
  const first = rows[0], last = rows[rows.length - 1];
  return {
    rows, bought, totalGold, wallet, elapsed,
    ttkReductionPct: first && first.ttk > 0 ? (1 - last.ttk / first.ttk) * 100 : 0,
    final: p,
  };
}
