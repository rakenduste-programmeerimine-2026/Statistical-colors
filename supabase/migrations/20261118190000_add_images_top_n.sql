-- How many colours the user asked to see on upload (ImageAnalysis.topN, 1–5000,
-- same as TOP_N_MIN / TOP_N_MAX in src/core/analysis/upload-rules.ts).
--
-- It only sets the default number of colours on the results page. image_colors
-- stores up to 5000 colours regardless, so the page can show more (?top_n=) and
-- its filters reach beyond the chosen N.
--
-- Safe for code that is already deployed: the column has a default, and table
-- level INSERT/SELECT grants cover it. It is not updatable after insert (the
-- column UPDATE grants from the RLS migration do not include it).

alter table public.images
  add column top_n integer not null default 5000;

alter table public.images
  add constraint images_top_n_range check (top_n between 1 and 5000);

comment on column public.images.top_n is
  'Top N chosen on upload (1–5000): default number of colours shown. Up to 5000 colours are stored in image_colors regardless.';
