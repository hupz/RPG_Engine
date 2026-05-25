// Generic d20 — использует базовые реализации RuleSystem

class GenericRuleSystem extends RuleSystem {
  get id() { return 'generic'; }
  get label() { return 'Generic d20'; }
  get description() { return 'Универсальная d20-система без привязки к конкретной игре.'; }
}

const GenericSystem = new GenericRuleSystem();
if (typeof window !== 'undefined') window.GenericSystem = GenericSystem;
