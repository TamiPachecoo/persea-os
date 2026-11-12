-- Linguagem neutra nos contratos (há um cliente homem entrando no programa).
-- "a/o/da/do/pela/pelo/à/ao CONTRATANTE" vira "a/da/pela/à parte CONTRATANTE",
-- mantendo a caixa de cada palavra (títulos em maiúsculas continuam em
-- maiúsculas). Também troca "o cliente", "o(a) mentorado(a)" e as fórmulas
-- "inscrito(a)" / "residente e domiciliado(a)". FATOR N e Nayana (CONTRATADA)
-- continuam como estão.
create or replace function private.neutral_contract_text(t text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  pairs text[] := array[
    'o\(a\)','a', 'a\(o\)','a', 'do\(a\)','da', 'da\(o\)','da', 'ao\(à\)','à', 'à\(ao\)','à', 'pelo\(a\)','pela', 'no\(a\)','na',
    'pela','pela', 'pelo','pela', 'da','da', 'do','da', 'ao','à', 'à','à', 'na','na', 'no','na', 'a','a', 'o','a'];
  i int; v int; art text; dst text; w text; parte text;
  words text[] := array['CONTRATANTE', 'Contratante', 'contratante'];
  b constant text := '[^[:alnum:]À-ú_]';
begin
  if t is null then return null; end if;
  for i in 1 .. array_length(pairs, 1) / 2 loop
    for v in 1 .. 3 loop
      art := pairs[2 * i - 1]; dst := pairs[2 * i];
      if v = 2 then art := upper(left(art, 1)) || substr(art, 2); dst := upper(left(dst, 1)) || substr(dst, 2); end if;
      if v = 3 then art := upper(art); dst := upper(dst); end if;
      foreach w in array words loop
        parte := case when w = 'Contratante' then 'Parte'
                      when v = 3 and length(pairs[2 * i - 1]) > 1 and w = 'CONTRATANTE' then 'PARTE'
                      else 'parte' end;
        t := regexp_replace(t, '(^|' || b || ')' || art || '(\s+)' || w || '(' || b || '|$)',
                            '\1' || dst || '\2' || parte || ' ' || w || '\3', 'g');
      end loop;
    end loop;
  end loop;
  t := replace(t, 'o cliente recebe algumas atividades', 'a parte CONTRATANTE recebe algumas atividades');
  t := replace(t, 'com o(a) mentorado(a), o(a) mentor(a) responsável', 'com a pessoa mentorada, a pessoa mentora responsável');
  t := replace(t, 'com o mentorado,', 'com a pessoa mentorada,');
  t := replace(t, 'residente e domiciliado(a)', 'com residência e domicílio');
  t := replace(t, 'inscrito(a) no CPF', 'com inscrição no CPF');
  return t;
end $$;

-- The cadastro auto-fill writes the CONTRATANTE line too: same neutral wording.
create or replace function private.contratante_line(p public.party_info, fallback_name text)
returns text language plpgsql immutable set search_path to '' as $function$
declare
  nm text := coalesce(nullif(p.full_name, ''), nullif(fallback_name, ''));
  addr text := coalesce(nullif(p.address, ''), nullif(concat_ws(', ', nullif(p.street, ''), nullif(p.number, ''), nullif(p.complement, ''),
    nullif(p.neighborhood, ''), nullif(p.city, ''), nullif(p.state, '')), ''));
begin
  if p.party_type = 'PJ' then
    if coalesce(p.company_name, '') = '' or coalesce(p.cnpj, '') = '' then return null; end if;
    return format('CONTRATANTE PJ: %s, pessoa jurídica inscrita no CNPJ sob o nº %s, neste ato representada por %s, com residência e domicílio em %s, e-mail: %s.',
      p.company_name, p.cnpj, coalesce(nm, ''), coalesce(addr, '[ENDEREÇO]'), coalesce(nullif(p.email, ''), '[E-MAIL]'));
  end if;
  return format('CONTRATANTE PF: %s, %s, %s, %s, com inscrição no CPF sob o nº %s, com residência e domicílio em %s%s, telefone/WhatsApp: %s, e-mail: %s.',
    coalesce(nm, '[NOME COMPLETO]'), coalesce(nullif(p.nationality, ''), '[NACIONALIDADE]'), coalesce(nullif(p.marital_status, ''), '[ESTADO CIVIL]'),
    coalesce(nullif(p.profession, ''), '[PROFISSÃO]'), coalesce(nullif(p.cpf, ''), '[CPF]'), coalesce(addr, '[ENDEREÇO]'),
    case when coalesce(p.cep, '') <> '' then ', CEP ' || p.cep else '' end,
    coalesce(nullif(p.whatsapp, ''), '[TELEFONE]'), coalesce(nullif(p.email, ''), '[E-MAIL]'));
end $function$;
