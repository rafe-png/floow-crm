-- floow CRM — 024: etapa "Sem resposta" (pulmão de recontato)
-- Rodar SOZINHA no SQL Editor, ANTES da 025.

alter type lead_status add value if not exists 'sem_resposta' after 'desqualificado';
