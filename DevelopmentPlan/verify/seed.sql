-- Seed set from SCHEMA.md -> Seed data. Fixed UUIDs so tests can reference them.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.org',  '{"full_name":"Admin One"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'editor@example.org', '{"full_name":"Editor Two"}');

-- handle_new_user() should have created both profiles as 'editor'.
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';

insert into issues (id, volume, number, year, published_at, state) values
  ('00000000-0000-0000-0000-0000000000b1', 1, 1, 2026, now(), 'published'),
  ('00000000-0000-0000-0000-0000000000b2', 1, 2, 2026, null,  'draft');

insert into authors (id, family_name, given_name, orcid, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'Karimov',  'Aziz',   '0000-0002-1825-0097', 'karimov@example.uz'),
  ('00000000-0000-0000-0000-0000000000c2', 'Ivanova',  'Elena',  null,                  'ivanova@example.ru'),
  ('00000000-0000-0000-0000-0000000000c3', 'Yusupova', 'Nilufar', null,                 null);

insert into author_translations (author_id, locale, display_name, affiliation) values
  ('00000000-0000-0000-0000-0000000000c1', 'en', 'Karimov, Aziz',   'Tashkent State University'),
  ('00000000-0000-0000-0000-0000000000c1', 'ru', E'Каримов, Азиз', E'Ташкентский гос. университет'),
  ('00000000-0000-0000-0000-0000000000c1', 'uz', 'Karimov, Aziz',   'Toshkent Davlat Universiteti'),
  ('00000000-0000-0000-0000-0000000000c2', 'ru', E'Иванова, Елена', E'МГУ'),
  ('00000000-0000-0000-0000-0000000000c3', 'uz', 'Yusupova, Nilufar', 'TDIU');

-- 1: en primary, all three translations, in the published issue
insert into articles (id, slug, doi, issue_id, position, primary_language, pdf_url,
                      first_page, last_page, state, published_at)
values ('00000000-0000-0000-0000-0000000000d1', 'trade-openness-and-growth',
        '10.99999/esu-je.1', '00000000-0000-0000-0000-0000000000b1', 1, 'en',
        'https://example.org/storage/v1/object/public/articles/v1/n1/trade-openness-and-growth.pdf',
        1, 22, 'published', now());

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d1', 'en', 'Trade openness and growth', 'An English abstract about trade openness.', '{trade,growth}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ru', E'Открытость торговли', E'Русская аннотация.', '{"торговля"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'uz', 'Savdo ochiqligi', 'Ozbekcha annotatsiya.', '{savdo}');

-- 2: ru primary, ru + en only. The ru row is deliberately HALF-FILLED:
--    title present, abstract null -> exercises field-level fallback.
insert into articles (id, slug, doi, issue_id, position, primary_language, pdf_url,
                      first_page, last_page, state, published_at)
values ('00000000-0000-0000-0000-0000000000d2', 'inflation-targeting-in-transition',
        '10.99999/esu-je.2', '00000000-0000-0000-0000-0000000000b1', 2, 'ru',
        'https://example.org/storage/v1/object/public/articles/v1/n1/inflation-targeting-in-transition.pdf',
        23, 41, 'published', now());

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d2', 'ru', E'Таргетирование инфляции', null, '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'en', 'Inflation targeting in transition', 'An English abstract that must be reachable from the ru page.', '{inflation}');

-- 3: uz primary, uz only -> the fallback article
insert into articles (id, slug, doi, issue_id, position, primary_language, pdf_url,
                      first_page, last_page, state, published_at)
values ('00000000-0000-0000-0000-0000000000d3', 'ozbekiston-iqtisodiyoti',
        '10.99999/esu-je.3', '00000000-0000-0000-0000-0000000000b1', 3, 'uz',
        'https://example.org/storage/v1/object/public/articles/v1/n1/ozbekiston-iqtisodiyoti.pdf',
        42, 60, 'published', now());

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d3', 'uz', 'Ozbekiston iqtisodiyoti', 'Faqat ozbek tilidagi annotatsiya.', '{iqtisodiyot}');

-- 4: online first -> no issue, therefore no volume/number/year
insert into articles (id, slug, doi, issue_id, position, primary_language, pdf_url,
                      state, published_at)
values ('00000000-0000-0000-0000-0000000000d4', 'remittances-and-consumption',
        '10.99999/esu-je.4', null, null, 'en',
        'https://example.org/storage/v1/object/public/articles/online-first/remittances-and-consumption.pdf',
        'published', now());

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d4', 'en', 'Remittances and consumption', 'Online first.', '{remittances}');

-- 5: draft -> must be invisible to anon, through the table AND the view
insert into articles (id, slug, doi, issue_id, position, primary_language, pdf_url,
                      state, published_at)
values ('00000000-0000-0000-0000-0000000000d5', 'secret-draft-article',
        null, '00000000-0000-0000-0000-0000000000b2', 1, 'en', null, 'draft', null);

insert into article_translations (article_id, locale, title, abstract, keywords) values
  ('00000000-0000-0000-0000-0000000000d5', 'en', 'Secret draft article', 'Not for the public.', '{secret}');

insert into article_authors (article_id, author_id, position, is_corresponding) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 1, true),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c2', 2, false),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 1, true),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c3', 1, true),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', 1, true),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c1', 1, true);

insert into proposals (name, email, affiliation, title, abstract, locale, state, source_ip) values
  ('Dilnoza R.', 'dilnoza@example.uz', 'TDIU', 'A proposal', 'Abstract text.', 'uz', 'new', '203.0.113.7'),
  ('Pyotr S.',   'pyotr@example.ru',   'HSE',  'Another one', 'More text.',    'ru', 'contacted', '203.0.113.8');
