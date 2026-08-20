-- Seed set from DevelopmentPlan/SCHEMA.md -> Seed data.
--
-- Wrapped in an explicit transaction: articles carry a deferred constraint
-- trigger requiring a primary-language title, so an article and its
-- translations must commit together.
--
-- Auth rows exist only so `profiles` has something to reference. They carry no
-- usable password; real credentials arrive with build step 6.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated',
   'admin@example.org', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Admin One"}'::jsonb, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated',
   'editor@example.org', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Editor Two"}'::jsonb, '', '', '', '');

-- handle_new_user() mirrors both into profiles as 'editor'; promote one.
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';

insert into issues (id, volume, number, year, published_at, state) values
  ('00000000-0000-0000-0000-0000000000b1', 1, 1, 2026, now(), 'published'),
  ('00000000-0000-0000-0000-0000000000b2', 1, 2, 2026, null,  'draft');

insert into issue_translations (issue_id, locale, title, description) values
  ('00000000-0000-0000-0000-0000000000b1', 'en', null, 'The inaugural issue.'),
  ('00000000-0000-0000-0000-0000000000b1', 'ru', null, 'Первый выпуск.');

insert into authors (id, family_name, given_name, orcid, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'Karimov',  'Aziz',    '0000-0002-1825-0097', 'karimov@example.uz'),
  ('00000000-0000-0000-0000-0000000000c2', 'Ivanova',  'Elena',   null,                  'ivanova@example.ru'),
  ('00000000-0000-0000-0000-0000000000c3', 'Yusupova', 'Nilufar', null,                  null);

insert into author_translations (author_id, locale, display_name, affiliation) values
  ('00000000-0000-0000-0000-0000000000c1', 'en', 'Karimov, Aziz',      'Tashkent State University'),
  ('00000000-0000-0000-0000-0000000000c1', 'ru', 'Каримов, Азиз',      'Ташкентский государственный университет'),
  ('00000000-0000-0000-0000-0000000000c1', 'uz', 'Karimov, Aziz',      'Toshkent Davlat Universiteti'),
  ('00000000-0000-0000-0000-0000000000c2', 'en', 'Ivanova, Elena',     'HSE University'),
  ('00000000-0000-0000-0000-0000000000c2', 'ru', 'Иванова, Елена',     'НИУ ВШЭ'),
  ('00000000-0000-0000-0000-0000000000c3', 'uz', 'Yusupova, Nilufar',  'Toshkent Davlat Iqtisodiyot Universiteti'),
  ('00000000-0000-0000-0000-0000000000c3', 'en', 'Yusupova, Nilufar',  'Tashkent State University of Economics');

-- 1: en primary, all three translations, in the published issue
insert into articles (id, slug, issue_id, position, primary_language, pdf_url,
                      first_page, last_page, jel_codes, state, published_at,
                      received_at, accepted_at)
values ('00000000-0000-0000-0000-0000000000d1', 'trade-openness-and-growth',
        '00000000-0000-0000-0000-0000000000b1', 1, 'en',
        'http://127.0.0.1:54321/storage/v1/object/public/articles/v1/n1/trade-openness-and-growth.pdf',
        1, 22, '{F14,O47}', 'published', '2026-03-15T09:00:00Z',
        '2025-11-02', '2026-01-20');

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d1', 'en',
   'Trade openness and growth in Central Asia',
   'This paper examines the relationship between trade openness and economic growth across five Central Asian economies between 2000 and 2024.',
   '{trade,growth,"Central Asia"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ru',
   'Открытость торговли и экономический рост в Центральной Азии',
   'В статье рассматривается связь между открытостью торговли и экономическим ростом в пяти странах Центральной Азии.',
   '{торговля,рост}'),
  ('00000000-0000-0000-0000-0000000000d1', 'uz',
   'Markaziy Osiyoda savdo ochiqligi va iqtisodiy osish',
   'Maqolada Markaziy Osiyoning besh davlatida savdo ochiqligi va iqtisodiy osish ortasidagi bogliqlik tahlil qilinadi.',
   '{savdo,osish}');

-- 2: ru primary, ru + en. The ru row is deliberately HALF-FILLED (title, no
--    abstract, no keywords) to exercise field-level fallback.
insert into articles (id, slug, issue_id, position, primary_language, pdf_url,
                      first_page, last_page, jel_codes, state, published_at)
values ('00000000-0000-0000-0000-0000000000d2', 'inflation-targeting-in-transition',
        '00000000-0000-0000-0000-0000000000b1', 2, 'ru',
        'http://127.0.0.1:54321/storage/v1/object/public/articles/v1/n1/inflation-targeting-in-transition.pdf',
        23, 41, '{E31,E52}', 'published', '2026-03-15T09:00:00Z');

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d2', 'ru',
   'Таргетирование инфляции в переходных экономиках', null, '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'en',
   'Inflation targeting in transition economies',
   'An English abstract that the Russian page must be able to fall back to, because the Russian row has none.',
   '{inflation,"monetary policy"}');

-- 3: uz primary, uz only. The fallback article.
insert into articles (id, slug, issue_id, position, primary_language, pdf_url,
                      first_page, last_page, jel_codes, state, published_at)
values ('00000000-0000-0000-0000-0000000000d3', 'ozbekiston-iqtisodiyoti',
        '00000000-0000-0000-0000-0000000000b1', 3, 'uz',
        'http://127.0.0.1:54321/storage/v1/object/public/articles/v1/n1/ozbekiston-iqtisodiyoti.pdf',
        42, 60, '{O53}', 'published', '2026-03-15T09:00:00Z');

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d3', 'uz',
   'Ozbekiston iqtisodiyotining raqamli transformatsiyasi',
   'Ushbu maqolada Ozbekiston iqtisodiyotining raqamli transformatsiyasi jarayonlari tahlil qilinadi.',
   '{iqtisodiyot,raqamlashtirish}');

-- 4: online first. No issue, therefore no volume, number, or year.
insert into articles (id, slug, issue_id, position, primary_language, pdf_url,
                      jel_codes, state, published_at)
values ('00000000-0000-0000-0000-0000000000d4', 'remittances-and-household-consumption',
        null, null, 'en',
        'http://127.0.0.1:54321/storage/v1/object/public/articles/online-first/remittances-and-household-consumption.pdf',
        '{F24,D12}', 'published', '2026-06-01T09:00:00Z');

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d4', 'en',
   'Remittances and household consumption',
   'Published online ahead of issue assignment.', '{remittances,consumption}'),
  ('00000000-0000-0000-0000-0000000000d4', 'uz',
   'Pul otkazmalari va uy xojaligi isteemoli', null, '{}');

-- 5: draft. Must be invisible to the anon key, through tables and the view.
insert into articles (id, slug, issue_id, position, primary_language, pdf_url,
                      state, published_at)
values ('00000000-0000-0000-0000-0000000000d5', 'secret-draft-article',
        '00000000-0000-0000-0000-0000000000b2', 1, 'en', null, 'draft', null);

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d5', 'en', 'Secret draft article',
   'Not for the public.', '{secret}');

insert into article_authors (article_id, author_id, position, is_corresponding) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 1, true),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c2', 2, false),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 1, true),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c3', 1, true),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', 1, true),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c1', 1, true);

insert into proposals (name, email, affiliation, title, abstract, locale, state, source_ip) values
  ('Dilnoza Rakhimova', 'dilnoza@example.uz', 'TDIU',
   'Labour migration and rural incomes', 'A proposal abstract.', 'uz', 'new', '203.0.113.7'),
  ('Pyotr Sokolov', 'pyotr@example.ru', 'HSE University',
   'Exchange rate pass-through', 'Another proposal abstract.', 'ru', 'contacted', '203.0.113.8');

commit;
