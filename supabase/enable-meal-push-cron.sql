-- 1) Ative as extensões pg_cron, pg_net e Vault no projeto Supabase.
-- 2) Troque os valores abaixo e execute uma única vez.
-- O Vault evita deixar chaves sensíveis gravadas diretamente no job.

select vault.create_secret(
  'https://SEU-PROJETO.supabase.co',
  'rotina_pet_project_url'
);

select vault.create_secret(
  'SUA_SUPABASE_PUBLISHABLE_KEY',
  'rotina_pet_publishable_key'
);

select cron.schedule(
  'send-meal-notifications-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'rotina_pet_project_url'
    ) || '/functions/v1/send-meal-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'rotina_pet_publishable_key'
      ),
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'rotina_pet_publishable_key'
      )
    ),
    body := jsonb_build_object('invoked_at', now())
  );
  $$
);
