// Tipagem mínima do `chrome` usado (storage). esbuild não faz typecheck;
// isto é só pra editor não reclamar.
declare const chrome: {
  storage: {
    local: {
      get: (key: string) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (key: string) => Promise<void>;
    };
  };
};
