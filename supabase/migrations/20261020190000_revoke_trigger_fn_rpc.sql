-- Advisor cleanup: trigger functions don't need to be callable over the API.
revoke execute on function public.enforce_admin_only_delivery() from public, anon, authenticated;
revoke execute on function public.enforce_client_brand_ideas_only_update() from public, anon, authenticated;
