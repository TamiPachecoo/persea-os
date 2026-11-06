-- Part of a contract can be paid by permuta (a service or product instead
-- of money, e.g. botox sessions whose dates are agreed later). The plan
-- line carries method 'permuta'; receipts already accept it (payments has
-- no method check). Relatórios keep permuta out of cash figures.
alter table public.contract_payment_lines drop constraint if exists contract_payment_lines_method_check;
alter table public.contract_payment_lines add constraint contract_payment_lines_method_check
  check (method = any (array['cartao_credito', 'boleto', 'pix', 'transferencia', 'permuta']));
