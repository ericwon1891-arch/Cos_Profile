-- '대표 캐릭터' 섹션을 사진/영상 두 섹션으로 분리하는 마이그레이션.
-- 기존 site_content.section='characters' 행의 { heading, categories, items } 구조를
-- { sections: [ {id, heading, categories, items}, ... ] } 구조로 변환한다.
-- 영상 필드(youtubeId/localVideoSrc/레거시 type=local+src)가 있는 캐릭터는 '영상' 섹션으로,
-- 없는 캐릭터는 '사진' 섹션으로 자동 분류한다.
-- 실행 전 아래 select로 현재 값을 확인/백업해두는 것을 권장.

-- 실행 전 확인용:
-- select data from site_content where section = 'characters';

update site_content
set data = jsonb_build_object(
  'sections', jsonb_build_array(
    jsonb_build_object(
      'id', 'photo',
      'heading', '대표 캐릭터 - 사진',
      'categories', coalesce(data->'categories', '[]'::jsonb),
      'items', coalesce((
        select jsonb_agg(item)
        from jsonb_array_elements(coalesce(data->'items', '[]'::jsonb)) item
        where not (
          coalesce(item->>'youtubeId', '') <> ''
          or coalesce(item->>'localVideoSrc', '') <> ''
          or (coalesce(item->>'type', '') = 'local' and coalesce(item->>'src', '') <> '')
        )
      ), '[]'::jsonb)
    ),
    jsonb_build_object(
      'id', 'video',
      'heading', '대표 캐릭터 - 영상',
      'categories', coalesce(data->'categories', '[]'::jsonb),
      'items', coalesce((
        select jsonb_agg(item)
        from jsonb_array_elements(coalesce(data->'items', '[]'::jsonb)) item
        where (
          coalesce(item->>'youtubeId', '') <> ''
          or coalesce(item->>'localVideoSrc', '') <> ''
          or (coalesce(item->>'type', '') = 'local' and coalesce(item->>'src', '') <> '')
        )
      ), '[]'::jsonb)
    )
  )
),
updated_at = now()
where section = 'characters';

-- 실행 후 확인용:
-- select data from site_content where section = 'characters';
