-- Colour analysis results.
--
-- images        one row per uploaded image (metadata + summary numbers)
-- image_colors  the top-N colours of an image, ranked by pixel count
--
-- The full list of unique colours can have hundreds of thousands of rows per
-- image, so it is NOT stored here – it goes to Storage as a CSV file
-- (bucket "reports", path stored in images.summary_csv_path).

create table public.images (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid()
                     references auth.users (id) on delete cascade,
  -- Images uploaded together share a batch_id.
  batch_id         uuid not null default gen_random_uuid(),
  file_name        text not null,
  format           text not null,
  width            integer not null,
  height           integer not null,
  total_pixels     bigint generated always as (width::bigint * height::bigint) stored,
  unique_colors    integer not null,
  include_alpha    boolean not null default false,
  color_space      text not null default 'srgb',
  summary_csv_path text,
  created_at       timestamptz not null default now(),

  constraint images_file_name_length
    check (char_length(file_name) between 1 and 255),
  constraint images_format_allowed
    check (format in ('png', 'jpeg', 'bmp', 'gif', 'webp', 'tiff')),
  constraint images_width_range
    check (width between 1 and 32768),
  constraint images_height_range
    check (height between 1 and 32768),
  constraint images_unique_colors_range
    check (unique_colors between 0 and width::bigint * height::bigint),
  constraint images_color_space_allowed
    check (color_space in ('srgb')),
  constraint images_summary_csv_path_length
    check (summary_csv_path is null or char_length(summary_csv_path) <= 512)
);

comment on table public.images is
  'One uploaded image and its colour statistics. Full colour list lives in Storage (summary_csv_path).';
comment on column public.images.batch_id is
  'Groups images that were uploaded together.';

create index images_owner_created_at_idx on public.images (owner_id, created_at desc);
create index images_batch_id_idx on public.images (batch_id);


create table public.image_colors (
  image_id     uuid not null references public.images (id) on delete cascade,
  rank         integer not null,
  r            smallint not null,
  g            smallint not null,
  b            smallint not null,
  -- NULL when the image was analysed without the alpha channel.
  a            smallint,
  hex          text generated always as (
                 '#' || upper(
                   lpad(to_hex(r::integer), 2, '0') ||
                   lpad(to_hex(g::integer), 2, '0') ||
                   lpad(to_hex(b::integer), 2, '0')
                 )
               ) stored,
  pixel_count  bigint not null,
  percent      numeric(13, 10) not null,
  -- Slide 16: the user marks a colour whose value/share we got wrong.
  user_flagged boolean not null default false,
  user_note    text,

  primary key (image_id, rank),
  constraint image_colors_color_unique
    unique nulls not distinct (image_id, r, g, b, a),
  constraint image_colors_rank_positive
    check (rank >= 1),
  constraint image_colors_rgb_range
    check (r between 0 and 255 and g between 0 and 255 and b between 0 and 255),
  constraint image_colors_alpha_range
    check (a is null or a between 0 and 255),
  constraint image_colors_pixel_count_positive
    check (pixel_count > 0),
  constraint image_colors_percent_range
    check (percent > 0 and percent <= 100),
  constraint image_colors_user_note_length
    check (user_note is null or char_length(user_note) <= 500)
);

comment on table public.image_colors is
  'Top-N colours of an image ranked by pixel count (rank 1 = most common).';
comment on column public.image_colors.user_flagged is
  'Set by the user when our result does not match the real colour (manual correction).';
