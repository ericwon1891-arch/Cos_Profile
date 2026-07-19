insert into site_content (section, data) values
('hero', $json${
  "photo": "/placeholder-hero.jpg",
  "label": "COSPLAYER / MODEL / MC",
  "name": "NANARY (나나리)",
  "subtitle": "Cosplayer · Model · MC · Content Creator",
  "quote": "행사의 분위기를 만드는 코스플레이어,\n그리고 팬들과 함께 호흡하는 콘텐츠 크리에이터.",
  "facts": [
    { "label": "키", "value": "160cm" },
    { "label": "활동지역", "value": "미정 (관리자 페이지에서 입력)" },
    { "label": "활동경력", "value": "코스프레 경력 8년" },
    { "label": "가능한 활동", "value": "모델 / MC / 행사 진행" },
    { "label": "가능한 활동", "value": "유튜브 · 치지직 · X · Instagram 운영" }
  ]
}$json$::jsonb),

('about', $json${
  "heading": "ABOUT ME",
  "body": "안녕하세요.\n코스플레이어 나나리입니다.\n\n10대 시절 성우를 꿈꾸며 노래 커버 활동을 시작했고, 자연스럽게 애니메이션과 게임을 사랑하는 '덕후'로 성장했습니다.\n\n현재는 코스프레를 중심으로 모델, 행사 MC, 콘텐츠 크리에이터로 활동하며 다양한 서브컬처 행사에서 팬들과 소통하고 있습니다.\n\n단순히 캐릭터를 재현하는 것을 넘어, 그 캐릭터가 가진 분위기와 매력을 표현하는 것을 가장 중요하게 생각합니다.\n\n귀엽고 사랑스러운 캐릭터부터 성숙하고 카리스마 있는 캐릭터까지 폭넓게 소화하기 위해 꾸준히 연구하고 있으며, 행사 현장에서는 관람객과 적극적으로 소통하며 즐거운 분위기를 만드는 것을 좋아합니다.\n\n또한 유튜브와 라이브 방송, SNS를 직접 운영하며 행사 및 브랜드를 자연스럽게 홍보하는 콘텐츠 제작도 함께 진행하고 있습니다.\n\n'행사가 끝난 뒤에도 기억에 남는 코스플레이어.'\n\n그것이 제가 추구하는 활동 방향입니다."
}$json$::jsonb),

('strength', $json${
  "heading": "STRENGTH",
  "items": [
    { "title": "행사 진행 경험", "description": "다양한 행사에서 모델 및 MC 경험을 바탕으로 관객과 자연스럽게 소통할 수 있습니다." },
    { "title": "콘텐츠 제작", "description": "촬영부터 편집, 업로드까지 직접 진행하여 행사 이후에도 SNS 홍보 콘텐츠 제작이 가능합니다." },
    { "title": "다양한 캐릭터 소화", "description": "귀여운 캐릭터부터 성숙한 캐릭터까지 폭넓은 콘셉트를 표현합니다." },
    { "title": "서브컬처 이해도", "description": "애니메이션·게임을 오래 즐겨온 덕후로서 작품과 캐릭터에 대한 이해도가 높습니다." },
    { "title": "책임감 있는 행사 참여", "description": "시간 약속과 행사 운영을 중요하게 생각하며 관계자들과 원활하게 소통합니다." }
  ]
}$json$::jsonb),

('career', $json${
  "heading": "CAREER",
  "years": [
    { "year": "2025", "entries": [
      { "event": "Game FESTA", "role": "모델" }
    ] },
    { "year": "2024", "entries": [
      { "event": "PCH 히로시마", "role": "한국 게스트" },
      { "event": "G-STAR", "role": "오덕포텐 모델 / MC" },
      { "event": "라그나로크 패션쇼", "role": "블랙스미스 모델" },
      { "event": "서울 서브컬처 팬밋업", "role": "모델" },
      { "event": "해양쓰레기 ZERO", "role": "한국 대표 참가" }
    ] }
  ]
}$json$::jsonb),

('characters', $json${
  "heading": "대표 캐릭터",
  "categories": ["전체", "카테고리 1", "카테고리 2", "카테고리 3"],
  "items": [
    { "id": 1, "title": "라크스 클라인", "category": "카테고리 1", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 2, "title": "니케", "category": "카테고리 1", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 3, "title": "브라운더스트2", "category": "카테고리 2", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 4, "title": "블루아카이브", "category": "카테고리 2", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 5, "title": "원신", "category": "카테고리 3", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 6, "title": "젠레스존제로", "category": "카테고리 3", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" }
  ]
}$json$::jsonb),

('available', $json${
  "heading": "AVAILABLE",
  "tags": ["게임 행사", "애니메이션 행사", "서브컬처 행사", "코스프레 모델", "홍보 모델", "무대 행사", "토크쇼", "MC", "팬밋업", "촬영", "인터뷰", "SNS 홍보"]
}$json$::jsonb),

('sns', $json${
  "heading": "SNS",
  "platforms": [
    { "name": "YouTube", "stats": [ { "label": "구독자", "value": "XX명" }, { "label": "조회수", "value": "XX만" } ], "url": "https://youtube.com/@REPLACE_ME" },
    { "name": "Instagram", "stats": [ { "label": "팔로워", "value": "X" } ], "url": "https://instagram.com/REPLACE_ME" },
    { "name": "Chzzk", "stats": [ { "label": "활동", "value": "라이브 방송" } ], "url": "https://chzzk.naver.com/REPLACE_ME" }
  ]
}$json$::jsonb),

('services', $json${
  "heading": "ADDITIONAL SERVICES",
  "items": ["행사 브이로그 제작", "행사 후기 업로드", "네이버 포스팅 작성", "SNS 홍보", "유튜브 업로드", "사진 리포트"]
}$json$::jsonb),

('personality', $json${
  "heading": "PERSONALITY",
  "traits": ["긍정적인 커뮤니케이션", "친화력 있는 행사 진행", "팬들과 적극적인 소통", "밝은 에너지", "책임감 있는 활동"]
}$json$::jsonb),

('contact', $json${
  "qrImage": "/placeholder-qr.png",
  "links": [
    { "label": "유튜브", "href": "https://youtube.com/@REPLACE_ME" },
    { "label": "인스타그램", "href": "https://instagram.com/REPLACE_ME" },
    { "label": "X", "href": "https://x.com/REPLACE_ME" },
    { "label": "이메일", "href": "mailto:REPLACE_ME@email.com" }
  ]
}$json$::jsonb)

on conflict (section) do update set data = excluded.data, updated_at = now();
