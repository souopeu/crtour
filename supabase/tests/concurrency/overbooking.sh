#!/usr/bin/env bash
# Real concurrency test for the seat lock: many database sessions reserve the same departure at
# once. pgTAP runs in one session, so it cannot prove this. Requires the local Supabase (Docker).
# Usage: supabase/tests/concurrency/overbooking.sh [vagas|passageiros]   (exit code 0 = limit respected)
#   vagas       - many sellers reserve the same departure (capacity 5)
#   passageiros - many sessions add companions to one 3-person reservation (2 places)
#   pagamentos  - many sessions pay R$ 10 each on a R$ 30 reservation (3 payments fit)
#   mover       - many 1-person reservations move at once into a 5-seat departure of the same tour (R140)
set -euo pipefail

DB=${DB_CONTAINER:-supabase_db_crtour}
MODE=${1:-vagas}
WORKERS=${WORKERS:-12}
CAPACITY=5
[ "$MODE" = passageiros ] && { CAPACITY=2; WORKERS=8; }
[ "$MODE" = pagamentos ] && { CAPACITY=3; WORKERS=12; }
TAG="conc-$$-$(date +%s)"
UID_TEST=$(uuidgen | tr 'A-Z' 'a-z')
TMP=$(mktemp -d)
trap 'cleanup' EXIT

psql_() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA "$@"; }

cleanup() {
  psql_ -c "
    delete from public.pagamentos where agencia_id in (select agencia_id from public.membros where user_id = '$UID_TEST');
    delete from public.passageiros where agencia_id in (select agencia_id from public.membros where user_id = '$UID_TEST');
    delete from public.reservas where agencia_id in (select agencia_id from public.membros where user_id = '$UID_TEST');
    delete from public.saidas where agencia_id in (select agencia_id from public.membros where user_id = '$UID_TEST');
    delete from public.agencias where id in (select agencia_id from public.membros where user_id = '$UID_TEST');
    delete from auth.users where id = '$UID_TEST';" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}

# Committed fixtures (so every worker session sees them)
psql_ -c "insert into auth.users (id, email, raw_user_meta_data) values ('$UID_TEST', '$TAG@teste.dev', '{\"agencia_nome\":\"Concorrência\"}')" >/dev/null
read -r SAIDA CLIENTE < <(psql_ -F ' ' -c "
with a as (select agencia_id from public.membros where user_id = '$UID_TEST'),
p as (insert into public.passeios (agencia_id, nome) select agencia_id, 'P' from a returning id, agencia_id),
c as (insert into public.clientes (agencia_id, nome) select agencia_id, 'Cliente' from a returning id),
s as (insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos)
      select agencia_id, id, '2027-03-10', $CAPACITY, 1000 from p returning id)
select s.id, c.id from s, c;")
RESERVA=""
if [ "$MODE" = passageiros ] || [ "$MODE" = pagamentos ]; then
  RESERVA=$(psql_ -c "insert into public.reservas (agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos)
    select agencia_id, '$SAIDA', '$CLIENTE', 3, 3000 from public.saidas where id = '$SAIDA' returning id;" | head -1)
fi
MOVER=()
if [ "$MODE" = mover ]; then
  # One 1-person reservation per worker, all in another departure of the same tour; $SAIDA is the target.
  # shellcheck disable=SC2207 # ids have no spaces; macOS bash 3.2 has no mapfile
  MOVER=($(psql_ -c "
    with o as (insert into public.saidas (agencia_id, passeio_id, data, capacidade, preco_centavos)
               select agencia_id, passeio_id, '2027-03-03', $WORKERS, 1000 from public.saidas where id = '$SAIDA' returning id, agencia_id)
    insert into public.reservas (agencia_id, saida_id, cliente_id, qtd_pessoas, valor_total_centavos)
    select o.agencia_id, o.id, '$CLIENTE', 1, 1000 from o, generate_series(1, $WORKERS) returning id;"))
fi

for i in $(seq 1 "$WORKERS"); do
  if [ "$MODE" = passageiros ]; then CALL="select public.adicionar_passageiro('$RESERVA', 'Passageiro $i');"
  elif [ "$MODE" = pagamentos ]; then CALL="select public.registrar_pagamento('$RESERVA', 1000, 'parcela', 'pix', (now() at time zone 'America/Sao_Paulo')::date);"
  elif [ "$MODE" = mover ]; then CALL="select '${MOVER[$((i - 1))]}' from (select public.mover_reserva_saida('${MOVER[$((i - 1))]}', '$SAIDA')) m;"
  else CALL="select public.criar_reserva('$SAIDA', '$CLIENTE', 1);"; fi
  (
    docker exec -i "$DB" psql -U postgres -d postgres -tA -v ON_ERROR_STOP=1 > "$TMP/w$i.out" 2> "$TMP/w$i.err" <<SQL || true
begin;
select set_config('request.jwt.claims', '{"sub":"$UID_TEST","role":"authenticated"}', true);
set local role authenticated;
$CALL
select pg_sleep(0.3);   -- hold the transaction open so the others really overlap
commit;
SQL
  ) &
done
wait

count() { { grep -l "$1" "$TMP"/w*."$2" 2>/dev/null || true; } | wc -l | tr -d ' '; }
OK=$(count '^[0-9a-f-]\{36\}$' out)
NO_SEATS=$(count 'Não há vagas\|já têm nome\|excede o saldo' err)
if [ "$MODE" = passageiros ]; then
  SOLD=$(psql_ -c "select count(*) from public.passageiros where reserva_id = '$RESERVA';")
elif [ "$MODE" = pagamentos ]; then
  SOLD=$(psql_ -c "select count(*) from public.pagamentos where reserva_id = '$RESERVA';")
  PAGO=$(psql_ -c "select pago_centavos from public.v_reservas_saldo where id = '$RESERVA';")
  [ "$PAGO" -le 3000 ] || { echo "FAIL: OVERPAID ($PAGO > 3000)"; exit 1; }
else
  SOLD=$(psql_ -c "select coalesce(sum(qtd_pessoas),0) from public.reservas where saida_id = '$SAIDA' and situacao = 'ativa';")
fi
OTHER=$((WORKERS - OK - NO_SEATS))

echo "mode=$MODE workers=$WORKERS limit=$CAPACITY -> accepted=$OK refused=$NO_SEATS other_errors=$OTHER stored=$SOLD"

if [ "$SOLD" -gt "$CAPACITY" ]; then echo "FAIL: LIMIT EXCEEDED ($SOLD > $CAPACITY)"; exit 1; fi
if [ "$OK" -ne "$CAPACITY" ] || [ "$SOLD" -ne "$CAPACITY" ]; then echo "FAIL: expected exactly $CAPACITY accepted"; exit 1; fi
if [ "$OTHER" -ne 0 ]; then echo "FAIL: unexpected errors"; head -3 "$TMP"/w*.err; exit 1; fi
echo "PASS: exactly $CAPACITY accepted, the rest refused"
