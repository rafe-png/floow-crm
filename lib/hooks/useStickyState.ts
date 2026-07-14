"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * useState que LEMBRA o valor no localStorage (persiste entre navegações/reloads).
 * Usado nos filtros do funil pra não perder a seleção ao sair e voltar.
 *
 * Carrega depois de montar (não na inicialização) pra não quebrar o SSR nem causar
 * mismatch de hidratação: o primeiro render usa `initial`, e logo em seguida o valor
 * salvo entra.
 */
export function useStickyState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* storage indisponível/corrompido — segue com o valor padrão */
    }
  }, [key]);

  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignora storage cheio/bloqueado */
      }
    },
    [key],
  );

  return [value, set] as const;
}
