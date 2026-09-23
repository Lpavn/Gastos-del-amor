-- Las reglas de categoría (category_rules) y transactions.merchant_key se
-- guardaban con el texto del comercio/alias tal cual venía del mail/foto,
-- que a veces incluye número de operación, sucursal o fecha — esos cambian
-- en cada compra al MISMO comercio, así que la comparación exacta contra la
-- regla guardada dejaba de matchear la próxima vez. Ver lib/merchantKey.ts.
-- Esta migración re-normaliza lo ya guardado (saca números y puntuación
-- suelta de NOMBRES de comercio) para que las reglas ya creadas vuelvan a
-- funcionar.
--
-- Un valor guardado que es puro número (con o sin espacios/puntos/guiones
-- de formato) se trata como CBU/CVU y se deja tal cual: ahí el número ES el
-- identificador fijo (ej. una transferencia a un comercio sin alias con
-- nombre), no ruido variable de la operación puntual.
update transactions
set merchant_key = case
  when regexp_replace(merchant_key, '[\s.-]', '', 'g') ~ '^[0-9]{6,}$'
    then regexp_replace(merchant_key, '[\s.-]', '', 'g')
  else nullif(
    trim(regexp_replace(regexp_replace(regexp_replace(lower(merchant_key), '[0-9]', '', 'g'), '[*#()/_.,:;-]', ' ', 'g'), '\s+', ' ', 'g')),
    ''
  )
end
where merchant_key is not null;

-- OJO: match_key es único. Si dos reglas distintas quedan con el mismo
-- texto normalizado, este update va a fallar por duplicado. Si pasa: mirá
-- `select match_key from category_rules order by match_key;`, borrá a mano
-- la regla vieja/repetida desde la app (o con un delete acá) y corré el
-- update de nuevo.
update category_rules
set match_key = case
  when regexp_replace(match_key, '[\s.-]', '', 'g') ~ '^[0-9]{6,}$'
    then regexp_replace(match_key, '[\s.-]', '', 'g')
  else nullif(
    trim(regexp_replace(regexp_replace(regexp_replace(lower(match_key), '[0-9]', '', 'g'), '[*#()/_.,:;-]', ' ', 'g'), '\s+', ' ', 'g')),
    ''
  )
end
where match_key is not null;
