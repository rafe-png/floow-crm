-- floow CRM — Fase 2.4-prep: local da reunião
-- Rodar no SQL Editor do Supabase.

create type local_reuniao as enum ('online', 'presencial');

alter table leads add column local local_reuniao;
