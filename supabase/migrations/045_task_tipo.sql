-- floow CRM — 045: tarefas tipadas (agenda diária + tarefa que nasce do funil).
-- Rodar no SQL Editor. Idempotente.
--
-- `tipo` padroniza a tarefa: qualificar | agendar | lembrete_reuniao | follow_up
-- | pos_venda | outro. Cada etapa do funil sugere um tipo ao mover o lead.
-- Tarefas passam a ser sempre vinculadas a um lead e agendadas (regra no app).

alter table tasks add column if not exists tipo text not null default 'outro';

-- Backfill: tenta inferir o tipo das tarefas antigas pelo título (best-effort).
update tasks set tipo = 'agendar'          where tipo = 'outro' and titulo ilike '%agend%';
update tasks set tipo = 'follow_up'        where tipo = 'outro' and (titulo ilike '%follow%' or titulo ilike '%retorn%');
update tasks set tipo = 'lembrete_reuniao' where tipo = 'outro' and (titulo ilike '%reuni%' or titulo ilike '%lembrete%');
update tasks set tipo = 'qualificar'       where tipo = 'outro' and titulo ilike '%qualific%';
