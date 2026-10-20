-- E8-6 (R129): the four reminder kinds. Own file: a new enum value cannot be used in the transaction that adds it.
alter type public.tipo_aviso add value if not exists 'atividade_agora';
alter type public.tipo_aviso add value if not exists 'atividade_atrasada';
alter type public.tipo_aviso add value if not exists 'cobranca_vencendo';
alter type public.tipo_aviso add value if not exists 'saida_chegando';
