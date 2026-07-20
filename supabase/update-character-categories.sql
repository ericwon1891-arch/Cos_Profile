update site_content
set data = $json${
  "heading": "대표 캐릭터",
  "categories": ["전체", "게임", "애니메이션", "오리지널"],
  "items": [
    { "id": 1, "title": "라크스 클라인", "category": "애니메이션", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 2, "title": "니케", "category": "게임", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 3, "title": "브라운더스트2", "category": "게임", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 4, "title": "블루아카이브", "category": "게임", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 5, "title": "원신", "category": "게임", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" },
    { "id": 6, "title": "젠레스존제로", "category": "게임", "type": "photo", "src": "/placeholder-character.jpg", "thumbnail": "/placeholder-character.jpg" }
  ]
}$json$::jsonb,
    updated_at = now()
where section = 'characters';
