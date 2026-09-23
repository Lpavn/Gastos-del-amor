-- Las reglas de categoría (category_rules) y transactions.merchant_key se
-- guardaban con el texto del comercio/alias tal cual venía del mail/foto,
-- que a veces incluye número de operación, sucursal o fecha — esos cambian
-- en cada compra al MISMO comercio, así que la comparación exacta contra la
-- regla guardada dejaba de matchear la próxima vez. Ver lib/merchantKey.ts.
-- Esta migración re-normaliza lo ya guardado (saca números y puntuación
-- suelta) para que las reglas ya creadas vuelvan a funcionar.
update transactions
set merchant_key = nullif(
  trim(regexp_replace(regexp_replace(regexp_replace(lower(merchant_key), '[0-9]', '', 'g'), '[*#()/_.,:;-]', ' ', 'g'), '\s+', ' ', 'g')),
  ''
)
where merchant_key is not null;

-- OJO: match_key es único. Si dos reglas distintas quedan con el mismo
-- texto normalizado (ej. dos alias que solo se diferenciaban por un
-- número), este update va a fallar por duplicado. Si pasa: mirá
-- `select match_key from category_rules order by match_key;`, borrá a mano
-- la regla vieja/repetida desde la app (o con un delete acá) y corré el
-- update de nuevo.
update category_rules
set match_key = nullif(
  trim(regexp_replace(regexp_replace(regexp_replace(lower(match_key), '[0-9]', '', 'g'), '[*#()/_.,:;-]', ' ', 'g'), '\s+', ' ', 'g')),
  ''
)
where match_key is not null;
