// 장르별 코어루프 프리셋 — 각 장르의 대표적인 레벨디자인/성장 루프를 수치로 옮긴 출발점.
// 사용자는 프리셋을 불러온 뒤 자원·수익원·강화 트랙을 자유롭게 추가/삭제/조정한다.

export const LOOP_PRESETS = {
  "RPG 사냥 파밍": {
    hint: "몬스터 처치 → 전리품 판매 → 장비 강화. 전투가 유일한 수익원인 정통 루프.",
    config: {
      resources: [{ id: "gold", name: "골드", emoji: "🪙" }],
      combat: { base_attack: 25, attack_speed: 1.2, crit_chance: 0.15, crit_mult: 1.8, enemy_hp: 600, enemy_def: 12 },
      sources: [
        { id: "hunt", name: "필드 사냥", type: "kill", rewards: [{ resource: "gold", amount: 12, chance: 0.7 }] },
      ],
      tracks: [
        { id: "t_atk", name: "무기 강화", effect: { stat: "attack", mode: "pct", value: 0.08 }, cost: { resource: "gold", base: 60, growth: 1.15 }, level: 0 },
        { id: "t_aps", name: "공속 룬", effect: { stat: "attack_speed", mode: "add", value: 0.08 }, cost: { resource: "gold", base: 90, growth: 1.2 }, level: 0 },
        { id: "t_crit", name: "치명타 보석", effect: { stat: "crit_chance", mode: "add", value: 0.03 }, cost: { resource: "gold", base: 120, growth: 1.22 }, level: 0 },
        { id: "t_greed", name: "탐욕의 반지(드랍률)", effect: { stat: "drop_chance", mode: "pct", value: 0.06 }, cost: { resource: "gold", base: 150, growth: 1.25 }, level: 0 },
      ],
    },
  },

  "방치형(인크리멘탈)": {
    hint: "자동 생산이 주 수익. 생산 배수를 눈덩이처럼 불리는 지수 성장 루프.",
    config: {
      resources: [{ id: "gold", name: "골드", emoji: "🪙" }, { id: "gem", name: "젬", emoji: "💎" }],
      combat: { base_attack: 30, attack_speed: 1.0, crit_chance: 0.05, crit_mult: 1.5, enemy_hp: 400, enemy_def: 5 },
      sources: [
        { id: "mine", name: "자동 광산", type: "idle", rewards: [{ resource: "gold", amount: 3, chance: 1 }] },
        { id: "boss", name: "보스 자동전투", type: "kill", rewards: [{ resource: "gold", amount: 20, chance: 1 }, { resource: "gem", amount: 0.2, chance: 0.3 }] },
      ],
      tracks: [
        { id: "t_prod", name: "광산 증설", effect: { stat: "idle_rate", mode: "pct", value: 0.15 }, cost: { resource: "gold", base: 100, growth: 1.12 }, level: 0 },
        { id: "t_atk", name: "용병 고용(공격력)", effect: { stat: "attack", mode: "pct", value: 0.1 }, cost: { resource: "gold", base: 150, growth: 1.16 }, level: 0 },
        { id: "t_all", name: "황금 손길(전체 수익)", effect: { stat: "income", mode: "pct", value: 0.05 }, cost: { resource: "gem", base: 5, growth: 1.3 }, level: 0 },
      ],
    },
  },

  "로그라이크 런": {
    hint: "한 번의 런(사이클) 클리어 → 메타 재화 → 영구 강화 → 다음 런이 빨라짐.",
    config: {
      resources: [{ id: "soul", name: "영혼(메타)", emoji: "👻" }, { id: "gold", name: "런 골드", emoji: "🪙" }],
      combat: { base_attack: 40, attack_speed: 1.5, crit_chance: 0.2, crit_mult: 2.0, enemy_hp: 900, enemy_def: 20 },
      sources: [
        { id: "run", name: "던전 런 클리어", type: "cycle", cycle_sec: 420, rewards: [{ resource: "soul", amount: 30, chance: 1 }, { resource: "gold", amount: 200, chance: 1 }] },
        { id: "elite", name: "엘리트 처치", type: "kill", rewards: [{ resource: "soul", amount: 1.5, chance: 0.5 }] },
      ],
      tracks: [
        { id: "t_atk", name: "영구 공격력", effect: { stat: "attack", mode: "pct", value: 0.07 }, cost: { resource: "soul", base: 20, growth: 1.18 }, level: 0 },
        { id: "t_speed", name: "런 속도(지도 해금)", effect: { stat: "cycle_speed", mode: "pct", value: 0.05 }, cost: { resource: "soul", base: 40, growth: 1.22 }, level: 0 },
        { id: "t_crit", name: "저주받은 검(치명)", effect: { stat: "crit_chance", mode: "add", value: 0.025 }, cost: { resource: "soul", base: 35, growth: 1.2 }, level: 0 },
        { id: "t_loot", name: "수집가(런 보상)", effect: { stat: "income", mode: "pct", value: 0.06 }, cost: { resource: "gold", base: 300, growth: 1.15 }, level: 0 },
      ],
    },
  },

  "타워 디펜스": {
    hint: "웨이브 클리어 보상으로 타워(DPS)를 강화해 더 어려운 웨이브를 버티는 루프.",
    config: {
      resources: [{ id: "gold", name: "골드", emoji: "🪙" }],
      combat: { base_attack: 50, attack_speed: 2.0, crit_chance: 0.1, crit_mult: 1.6, enemy_hp: 2000, enemy_def: 30 },
      sources: [
        { id: "wave", name: "웨이브 클리어", type: "cycle", cycle_sec: 45, rewards: [{ resource: "gold", amount: 60, chance: 1 }] },
        { id: "leak", name: "몬스터 개별 처치", type: "kill", rewards: [{ resource: "gold", amount: 2, chance: 1 }] },
      ],
      tracks: [
        { id: "t_dmg", name: "타워 데미지", effect: { stat: "attack", mode: "pct", value: 0.1 }, cost: { resource: "gold", base: 80, growth: 1.14 }, level: 0 },
        { id: "t_rate", name: "연사 속도", effect: { stat: "attack_speed", mode: "pct", value: 0.06 }, cost: { resource: "gold", base: 100, growth: 1.18 }, level: 0 },
        { id: "t_bounty", name: "현상금(웨이브 보상)", effect: { stat: "income", mode: "pct", value: 0.05 }, cost: { resource: "gold", base: 140, growth: 1.2 }, level: 0 },
      ],
    },
  },

  "생존 크래프팅": {
    hint: "채집(행동) → 재료 → 도구 제작으로 채집 효율을 올리는 루프. 전투는 보조.",
    config: {
      resources: [{ id: "wood", name: "목재", emoji: "🪵" }, { id: "ore", name: "광석", emoji: "⛏️" }],
      combat: { base_attack: 15, attack_speed: 1.0, crit_chance: 0.05, crit_mult: 1.5, enemy_hp: 300, enemy_def: 5 },
      sources: [
        { id: "chop", name: "벌목", type: "action", actions_per_min: 12, rewards: [{ resource: "wood", amount: 2, chance: 1 }] },
        { id: "mine", name: "채광", type: "action", actions_per_min: 8, rewards: [{ resource: "ore", amount: 1, chance: 0.8 }] },
        { id: "beast", name: "야수 사냥", type: "kill", rewards: [{ resource: "wood", amount: 1, chance: 0.4 }, { resource: "ore", amount: 0.5, chance: 0.2 }] },
      ],
      tracks: [
        { id: "t_axe", name: "도끼 업그레이드", effect: { stat: "action_rate", mode: "pct", value: 0.1 }, cost: { resource: "wood", base: 30, growth: 1.16 }, level: 0 },
        { id: "t_pick", name: "곡괭이 업그레이드", effect: { stat: "drop_value", mode: "pct", value: 0.08 }, cost: { resource: "ore", base: 15, growth: 1.2 }, level: 0 },
        { id: "t_sword", name: "무기 제작(공격력)", effect: { stat: "attack", mode: "pct", value: 0.12 }, cost: { resource: "ore", base: 25, growth: 1.22 }, level: 0 },
      ],
    },
  },

  "모바일 수집형": {
    hint: "스태미나 사이클(소탕)로 재화 수급 → 캐릭터/장비 강화. 일일 루프 중심.",
    config: {
      resources: [{ id: "gold", name: "골드", emoji: "🪙" }, { id: "stone", name: "강화석", emoji: "🔷" }],
      combat: { base_attack: 120, attack_speed: 1.4, crit_chance: 0.25, crit_mult: 2.2, enemy_hp: 5000, enemy_def: 80 },
      sources: [
        { id: "sweep", name: "스태미나 소탕", type: "cycle", cycle_sec: 300, rewards: [{ resource: "gold", amount: 800, chance: 1 }, { resource: "stone", amount: 6, chance: 1 }] },
        { id: "daily", name: "일일 퀘스트", type: "action", actions_per_min: 0.5, rewards: [{ resource: "gold", amount: 500, chance: 1 }] },
      ],
      tracks: [
        { id: "t_lv", name: "캐릭터 레벨업", effect: { stat: "attack", mode: "pct", value: 0.06 }, cost: { resource: "gold", base: 1000, growth: 1.12 }, level: 0 },
        { id: "t_gear", name: "장비 강화", effect: { stat: "attack", mode: "pct", value: 0.09 }, cost: { resource: "stone", base: 10, growth: 1.25 }, level: 0 },
        { id: "t_crit", name: "치명타 각인", effect: { stat: "crit_mult", mode: "add", value: 0.08 }, cost: { resource: "stone", base: 15, growth: 1.3 }, level: 0 },
      ],
    },
  },
};
