-- Row Level Security: every user sees and changes only their own analyses.
--
-- Users never create an account: the app uses Supabase anonymous sign-in, so
-- each browser gets its own auth.uid() and the "authenticated" role.
-- The "anon" role (no session at all) gets no access.

alter table public.images enable row level security;
alter table public.image_colors enable row level security;

-- Table privileges ----------------------------------------------------------
-- Supabase grants ALL on new public tables to anon/authenticated by default.
-- Narrow that down so that even a wrong policy cannot expose too much.

revoke all on table public.images, public.image_colors from anon, authenticated;

grant select, insert, delete on table public.images to authenticated;
-- Only the CSV path may change after insert (set once the upload finishes).
grant update (summary_csv_path) on table public.images to authenticated;

grant select, insert, delete on table public.image_colors to authenticated;
-- Results are immutable; the user may only flag a colour and add a note.
grant update (user_flagged, user_note) on table public.image_colors to authenticated;

-- images --------------------------------------------------------------------

create policy "images: owner can select"
  on public.images for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "images: owner can insert"
  on public.images for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "images: owner can update"
  on public.images for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "images: owner can delete"
  on public.images for delete to authenticated
  using (owner_id = (select auth.uid()));

-- image_colors (access goes through the parent image) -----------------------

create policy "image_colors: owner can select"
  on public.image_colors for select to authenticated
  using (exists (
    select 1 from public.images i
    where i.id = image_colors.image_id and i.owner_id = (select auth.uid())
  ));

create policy "image_colors: owner can insert"
  on public.image_colors for insert to authenticated
  with check (exists (
    select 1 from public.images i
    where i.id = image_colors.image_id and i.owner_id = (select auth.uid())
  ));

create policy "image_colors: owner can update"
  on public.image_colors for update to authenticated
  using (exists (
    select 1 from public.images i
    where i.id = image_colors.image_id and i.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.images i
    where i.id = image_colors.image_id and i.owner_id = (select auth.uid())
  ));

create policy "image_colors: owner can delete"
  on public.image_colors for delete to authenticated
  using (exists (
    select 1 from public.images i
    where i.id = image_colors.image_id and i.owner_id = (select auth.uid())
  ));
