// Tipagem mínima do `chrome` usado. esbuild não faz typecheck; isto é só pra
// o editor não reclamar.
declare const chrome: {
  runtime: { id?: string };
  storage: {
    local: {
      get: (key: string) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (key: string) => Promise<void>;
    };
  };
};
