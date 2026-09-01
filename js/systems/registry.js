// Реестр систем правил RPG

const SystemRegistry = {
  _systems: {},

  register(system) {
    if (!system?.id) return;
    this._systems[system.id] = system;
  },

  get(id) {
    return this._systems[id] || this._systems.dnd5e || Object.values(this._systems)[0];
  },

  list() {
    return Object.values(this._systems).map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description
    }));
  },

  getDefault() { return 'dnd5e'; }
};

if (typeof window !== 'undefined') {
  window.SystemRegistry = SystemRegistry;
  if (typeof DnD5eSystem !== 'undefined') SystemRegistry.register(DnD5eSystem);
  if (typeof Pathfinder2eSystem !== 'undefined') SystemRegistry.register(Pathfinder2eSystem);
  if (typeof GenericSystem !== 'undefined') SystemRegistry.register(GenericSystem);
}
