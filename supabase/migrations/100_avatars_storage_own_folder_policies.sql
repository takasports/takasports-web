-- 100_avatars_storage_own_folder_policies.sql  ·  F4 (drift de migraciones — back-fill)
--
-- Se aplicó DIRECTAMENTE en producción el 2026-06-29 (schema_migrations version
-- 20260629030601, name `avatars_storage_own_folder_policies`) SIN quedar en el
-- repo. Se versiona aquí a posteriori para que el repo refleje la BD. Idempotente.
--
-- Bucket público `avatars`: cada usuario AUTENTICADO puede subir/actualizar/borrar
-- SOLO en su propia carpeta ({uid}/...). La lectura ya es pública (bucket public),
-- así que no hace falta política de SELECT.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
