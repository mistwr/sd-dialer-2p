-- Já aplicada em produção (yqninaripblwhcfcwwnr) a 2026-11-06.
-- Idempotência das transcrições: a mesma frase (item do LiveKit) não é gravada duas vezes.
alter table public.voice_call_transcripts add column if not exists segment_id text;
create unique index if not exists voice_call_transcripts_call_segment_uniq on public.voice_call_transcripts (call_id, segment_id);
comment on column public.voice_call_transcripts.segment_id is 'ID do item no LiveKit (chat history). Garante idempotência: a mesma frase não é gravada duas vezes. NULL em linhas antigas/ao vivo.';
