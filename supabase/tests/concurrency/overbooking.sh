#!/usr/bin/env bash
# Real concurrency test for the seat lock: many database sessions reserve the same departure at
# once. pgTAP runs in one session, so it cannot prove this. Requires the local Supabase (Docker).
# Usage: supabase/tests/concurrency/overbooking.sh   (exit code 0 = no overbooking)
set -euo pipefail

DB=${DB_CONTAINER:-supabase_db_crtour}
WORKERS=${WORKERS:-12}
CAPACITY=5
TAG="conc-$$-$(date +%s)"
UID_TEST=$(uuidgen | tr 'A-Z' 'a-z')
TMP=$(mktemp -d)
trap 'cleanup' EXIT

psql_() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA "$@"; }

cleanup() {
  psql_ -c "
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

for i in $(seq 1 "$WORKERS"); do
  (
    docker exec -i "$DB" psql -U postgres -d postgres -tA -v ON_ERROR_STOP=1 > "$TMP/w$i.out" 2> "$TMP/w$i.err" <<SQL || true
begin;
select set_config('request.jwt.claims', '{"sub":"$UID_TEST","role":"authenticated"}', true);
set local role authenticated;
select public.criar_reserva('$SAIDA', '$CLIENTE', 1);
select pg_sleep(0.3);   -- hold the transaction open so the others really overlap
commit;
SQL
  ) &
done
wait

count() { { grep -l "$1" "$TMP"/w*."$2" 2>/dev/null || true; } | wc -l | tr -d ' '; }
OK=$(count '^[0-9a-f-]\{36\}$' out)
NO_SEATS=$(count 'Não há vagas' err)
SOLD=$(psql_ -c "select coalesce(sum(qtd_pessoas),0) from public.reservas where saida_id = '$SAIDA' and situacao = 'ativa';")
OTHER=$((WORKERS - OK - NO_SEATS))

echo "workers=$WORKERS capacity=$CAPACITY -> reserved_ok=$OK refused_no_seats=$NO_SEATS other_errors=$OTHER seats_sold=$SOLD"

if [ "$SOLD" -gt "$CAPACITY" ]; then echo "FAIL: OVERBOOKING ($SOLD > $CAPACITY)"; exit 1; fi
if [ "$OK" -ne "$CAPACITY" ] || [ "$SOLD" -ne "$CAPACITY" ]; then echo "FAIL: expected exactly $CAPACITY reservations"; exit 1; fi
if [ "$OTHER" -ne 0 ]; then echo "FAIL: unexpected errors"; head -3 "$TMP"/w*.err; exit 1; fi
echo "PASS: exactly $CAPACITY seats sold, the rest refused"
