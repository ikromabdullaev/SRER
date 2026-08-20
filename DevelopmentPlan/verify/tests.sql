-- Behavioural verification of the fixes applied to SCHEMA.md.
-- Every row printed at the end must read PASS.

create table test_results (name text, actual text, expected text);
grant all on test_results to anon;

-- ---------------------------------------------------------------- RLS, anon
set role anon;

insert into test_results
  select 'anon sees only published articles', count(*)::text, '4' from articles;
insert into test_results
  select 'anon cannot see the draft (table)', count(*)::text, '0'
  from articles where slug = 'secret-draft-article';
insert into test_results
  select 'anon cannot see draft translations', count(*)::text, '0'
  from article_translations where title = 'Secret draft article';
insert into test_results
  select 'anon cannot see the draft (VIEW)', count(*)::text, '0'
  from published_articles_localised where slug = 'secret-draft-article';
insert into test_results
  select 'view exposes 4 articles x 3 locales', count(*)::text, '12'
  from published_articles_localised;
insert into test_results
  select 'anon cannot see draft author links', count(*)::text, '5'
  from article_authors;
insert into test_results
  select 'anon can read author name columns', count(*)::text, '3'
  from (select id, family_name, given_name from authors) a;
insert into test_results
  select 'anon cannot see draft issue', count(*)::text, '1' from issues;
insert into test_results
  select 'anon cannot read proposals', count(*)::text, '0' from proposals;

reset role;

-- -------------------------------------------------- field-level fallback
-- uz-only article requested in ru: falls back to primary_language (uz)
insert into test_results
  select 'uz-only article: ru request falls back',
         title || ' / ' || title_locale::text || ' / ' || translation_missing::text,
         'Ozbekiston iqtisodiyoti / uz / true'
  from published_articles_localised
  where slug = 'ozbekiston-iqtisodiyoti' and requested_locale = 'ru';

-- half-filled ru row: ru title kept, abstract falls through to en
insert into test_results
  select 'half-filled row: title stays ru', title_locale::text, 'ru'
  from published_articles_localised
  where slug = 'inflation-targeting-in-transition' and requested_locale = 'ru';
insert into test_results
  select 'half-filled row: abstract falls to en', abstract_locale::text, 'en'
  from published_articles_localised
  where slug = 'inflation-targeting-in-transition' and requested_locale = 'ru';
insert into test_results
  select 'half-filled row: NOT flagged missing', translation_missing::text, 'false'
  from published_articles_localised
  where slug = 'inflation-targeting-in-transition' and requested_locale = 'ru';

-- empty keywords array must not defeat the fallback (the cardinality fix)
insert into test_results
  select 'empty keywords fall through to en',
         array_to_string(keywords, ',') || ' / ' || keywords_locale::text,
         'inflation / en'
  from published_articles_localised
  where slug = 'inflation-targeting-in-transition' and requested_locale = 'ru';

-- uz request on the ru-primary article: no uz row, primary ru, then en
insert into test_results
  select 'ru-primary article: uz request chain',
         title_locale::text || '/' || abstract_locale::text, 'ru/en'
  from published_articles_localised
  where slug = 'inflation-targeting-in-transition' and requested_locale = 'uz';

-- online-first article has no issue: must still appear, with null volume
insert into test_results
  select 'online-first article is visible',
         count(*)::text || ' / ' || coalesce(max(volume)::text, 'null'), '3 / null'
  from published_articles_localised where slug = 'remittances-and-consumption';

-- ------------------------------------------------------- generated column
insert into test_results
  select 'search_vector populated for all rows',
         count(*) filter (where search_vector is null)::text, '0'
  from article_translations;
insert into test_results
  select 'uz row uses simple config (no stemming)',
         (search_vector @@ to_tsquery('simple', 'iqtisodiyot'))::text
         || (search_vector @@ to_tsquery('simple', 'iqtisodiyotning'))::text,
         'truefalse'
  from article_translations
  where article_id = '00000000-0000-0000-0000-0000000000d3' and locale = 'uz';
insert into test_results
  select 'en row stems (english config)',
         (search_vector @@ to_tsquery('english', 'trades'))::text, 'true'
  from article_translations
  where article_id = '00000000-0000-0000-0000-0000000000d1' and locale = 'en';

-- ------------------------------------------- deferrable author reordering
do $$
begin
  update article_authors set position = 2
    where article_id = '00000000-0000-0000-0000-0000000000d1'
      and author_id  = '00000000-0000-0000-0000-0000000000c1';
  update article_authors set position = 1
    where article_id = '00000000-0000-0000-0000-0000000000d1'
      and author_id  = '00000000-0000-0000-0000-0000000000c2';
  insert into test_results values ('author swap in one transaction', 'ok', 'ok');
exception when others then
  insert into test_results values ('author swap in one transaction', sqlerrm, 'ok');
end $$;

-- ------------------------------------------------- permitted metadata edit
do $$
declare before_ts timestamptz; after_ts timestamptz;
begin
  select updated_at into before_ts from articles
    where id = '00000000-0000-0000-0000-0000000000d1';
  perform pg_sleep(0.05);
  update articles set last_page = 23
    where id = '00000000-0000-0000-0000-0000000000d1';
  select updated_at into after_ts from articles
    where id = '00000000-0000-0000-0000-0000000000d1';
  insert into test_results values ('correcting a page range is allowed', 'ok', 'ok');
  insert into test_results values ('touch_updated_at fired',
    (after_ts > before_ts)::text, 'true');
exception when others then
  insert into test_results values ('correcting a page range is allowed', sqlerrm, 'ok');
end $$;

-- ------------------------------------------------ permanence guard triggers
do $$
declare cases text[][] := array[
  array['slug',    'update articles set slug = ''renamed'' where id = ''00000000-0000-0000-0000-0000000000d1'''],
  array['doi',     'update articles set doi = ''10.99999/hijack'' where id = ''00000000-0000-0000-0000-0000000000d1'''],
  array['pdf_url', 'update articles set pdf_url = ''https://elsewhere/x.pdf'' where id = ''00000000-0000-0000-0000-0000000000d1''']
];
  c text[];
begin
  foreach c slice 1 in array cases loop
    begin
      execute c[2];
      insert into test_results
        values ('published ' || c[1] || ' is immutable', 'UPDATE SUCCEEDED', 'rejected');
    exception when others then
      insert into test_results
        values ('published ' || c[1] || ' is immutable',
                case when sqlerrm like '%immutable%' then 'rejected' else sqlerrm end,
                'rejected');
    end;
  end loop;
end $$;

-- withdrawing then renaming must still be refused
do $$
begin
  update articles set state = 'withdrawn'
    where id = '00000000-0000-0000-0000-0000000000d4';
  begin
    update articles set slug = 'renamed-after-withdrawal'
      where id = '00000000-0000-0000-0000-0000000000d4';
    insert into test_results
      values ('withdrawn does not unlock the slug', 'UPDATE SUCCEEDED', 'rejected');
  exception when others then
    insert into test_results
      values ('withdrawn does not unlock the slug',
              case when sqlerrm like '%immutable%' then 'rejected' else sqlerrm end,
              'rejected');
  end;
  update articles set state = 'published'
    where id = '00000000-0000-0000-0000-0000000000d4';
end $$;

-- ----------------------------------------------------------------- report
select case when actual is not distinct from expected then 'PASS' else 'FAIL' end as result,
       name, actual, expected
from test_results
order by (actual is not distinct from expected), name;

do $$
declare failed int;
begin
  select count(*) into failed from test_results
   where actual is distinct from expected;
  if failed > 0 then
    raise exception '% test(s) FAILED', failed;
  end if;
  raise notice 'ALL % TESTS PASSED', (select count(*) from test_results);
end $$;
