-- LOCAL STACK ONLY. Stand-ins for staging's seeded catalogue: one book above the
-- quality gate with real phrases (A19) and one below it (A14). Never run on staging,
-- where existing books must not be modified.
INSERT INTO books (id, title, author, category, language, "isFree", "isPublished") VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Libro local elegible', 'Autor local', 'classic', 'es', true, true),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Libro local bajo el umbral', 'Autor local', 'classic', 'es', true, true);
INSERT INTO sync_maps ("bookId", phrases, "syncCoverage") VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001',
   '[{"text":"Corta.","startTime":0,"endTime":1},
     {"text":"El viajero cruzó el puente viejo antes de que cayera la noche.","startTime":1,"endTime":5},
     {"text":"Nadie en el pueblo recordaba quién lo había construido.","startTime":5,"endTime":9}]'::jsonb, 0.95),
  ('aaaaaaaa-0000-4000-8000-000000000002', '[]'::jsonb, 0.5);
-- A pre-existing reader with a fragment, so A17's digest covers a real row.
INSERT INTO users (id, email, name) VALUES ('aaaaaaaa-0000-4000-8000-000000000003', 'existing-reader@local.invalid', 'Existing reader');
INSERT INTO fragments ("userId", "bookId", text, note) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'Nadie en el pueblo recordaba quién lo había construido.', 'A note');
