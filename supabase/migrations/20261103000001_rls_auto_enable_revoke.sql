-- Stackr — rls_auto_enable() nicht mehr über die REST-API aufrufbar
-- =============================================================================
-- Der Security-Advisor meldet die SECURITY-DEFINER-Funktion als von anon und
-- authenticated über /rest/v1/rpc/rls_auto_enable ausführbar. Sie ist ein
-- Event-Trigger-Helfer (schaltet RLS bei CREATE TABLE ein) und muss nicht
-- öffentlich sein. Der Event-Trigger selbst läuft davon unabhängig weiter.
-- Wiederholbar.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
