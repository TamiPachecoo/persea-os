-- Nay can prepare and edit a contract before the client fills in her
-- cadastro: until then the CONTRATANTE paragraph carries placeholders
-- ([CPF], [ENDEREÇO]…). The moment the cadastro is submitted, this fills in
-- the two parts that come from it — the CONTRATANTE PF/PJ paragraph and her
-- name on the signature line — leaving every other edit Nay made untouched.
-- Mirrors assembleContratanteLine() in app/shared/contract-merge.js.
-- Only touches contracts not yet sent for signature. Nay's "revisado" mark
-- is kept: filling in the cadastro data is not a change to her text.

create or replace function private.contratante_line(p public.party_info, fallback_name text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  nm text := coalesce(nullif(p.full_name, ''), nullif(fallback_name, ''));
  addr text := coalesce(nullif(p.address, ''), nullif(concat_ws(', ', nullif(p.street, ''), nullif(p.number, ''), nullif(p.complement, ''),
    nullif(p.neighborhood, ''), nullif(p.city, ''), nullif(p.state, '')), ''));
begin
  if p.party_type = 'PJ' then
    if coalesce(p.company_name, '') = '' or coalesce(p.cnpj, '') = '' then return null; end if;
    return format('CONTRATANTE PJ: %s, pessoa jurídica inscrita no CNPJ sob o nº %s, neste ato representada por %s, residente e domiciliado(a) em %s, e-mail: %s.',
      p.company_name, p.cnpj, coalesce(nm, ''), coalesce(addr, '[ENDEREÇO]'), coalesce(nullif(p.email, ''), '[E-MAIL]'));
  end if;
  return format('CONTRATANTE PF: %s, %s, %s, %s, inscrito(a) no CPF sob o nº %s, residente e domiciliado(a) em %s%s, telefone/WhatsApp: %s, e-mail: %s.',
    coalesce(nm, '[NOME COMPLETO]'), coalesce(nullif(p.nationality, ''), '[NACIONALIDADE]'), coalesce(nullif(p.marital_status, ''), '[ESTADO CIVIL]'),
    coalesce(nullif(p.profession, ''), '[PROFISSÃO]'), coalesce(nullif(p.cpf, ''), '[CPF]'), coalesce(addr, '[ENDEREÇO]'),
    case when coalesce(p.cep, '') <> '' then ', CEP ' || p.cep else '' end,
    coalesce(nullif(p.whatsapp, ''), '[TELEFONE]'), coalesce(nullif(p.email, ''), '[E-MAIL]'));
end $$;

create or replace function private.fill_contract_from_cadastro()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c record;
  line text;
  nm text;
  body text;
begin
  if not new.submitted or (tg_op = 'UPDATE' and old.submitted) or new.client_id is null then return new; end if;
  select full_name into nm from public.clients where id = new.client_id;
  line := private.contratante_line(new, nm);
  if line is null then return new; end if; -- incomplete PJ: Nay regenerates by hand, as before
  nm := coalesce(nullif(new.full_name, ''), nm);
  for c in select id, body_text from public.contracts
           where client_id = new.client_id and body_text is not null
             and autentique_document_id is null and sent_for_signature_at is null
             and status not in ('signed', 'completed')
  loop
    body := regexp_replace(c.body_text, '^CONTRATANTE P[FJ]:[^\n]*$', replace(line, '\', '\\'), 'n');
    body := regexp_replace(body, '^((Nayana Murta Martins|FATOR N Gestão de Imagem) {2,})[^\n]*$', '\1' || replace(coalesce(nm, ''), '\', '\\'), 'n');
    if body is distinct from c.body_text then
      perform set_config('persea.cadastro_fill', 'on', true);
      update public.contracts set body_text = body, updated_at = now() where id = c.id;
      perform set_config('persea.cadastro_fill', 'off', true);
      insert into public.client_activity_log (client_id, event_type, text, occurred_at)
      values (new.client_id, 'contract_cadastro_filled', 'Dados do cadastro incluídos automaticamente no contrato.', now());
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists trg_fill_contract_from_cadastro on public.party_info;
create trigger trg_fill_contract_from_cadastro after insert or update of submitted on public.party_info
  for each row execute function private.fill_contract_from_cadastro();

-- The review guard clears Nay's "revisado" whenever someone other than her
-- changes the text; the cadastro fill above is exempt.
create or replace function public.contracts_admin_review_guard()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  caller_role public.user_role;
begin
  if auth.uid() is null then
    return new;
  end if;
  select role into caller_role from public.profiles where id = auth.uid();
  if new.admin_reviewed_at is distinct from old.admin_reviewed_at
     and new.admin_reviewed_at is not null
     and caller_role is distinct from 'admin' then
    raise exception 'Apenas a Nay pode marcar o contrato como revisado.';
  end if;
  if new.body_text is distinct from old.body_text and caller_role is distinct from 'admin'
     and coalesce(current_setting('persea.cadastro_fill', true), 'off') <> 'on' then
    new.admin_reviewed_at := null;
    new.admin_reviewed_by := null;
  end if;
  return new;
end;
$function$;
