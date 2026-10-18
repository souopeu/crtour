-- E5-7 (R72): new message type. Alone in this file: a new enum value cannot be used in the same transaction.
alter type public.tipo_mensagem_passeio add value if not exists 'um_ano';
