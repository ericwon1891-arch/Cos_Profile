update site_content
set data = $json${
  "heading": "SNS",
  "platforms": [
    { "name": "YouTube", "stats": [ { "label": "구독자", "value": "1.9천명" } ], "url": "https://www.youtube.com/@nanary000" },
    { "name": "Instagram", "stats": [ { "label": "팔로워", "value": "6,297명" } ], "url": "https://www.instagram.com/cos_nanary/" },
    { "name": "X", "stats": [ { "label": "팔로워", "value": "17.9K" } ], "url": "https://x.com/nanary000" },
    { "name": "Chzzk", "stats": [ { "label": "활동", "value": "라이브 방송" } ], "url": "https://chzzk.naver.com/REPLACE_ME" }
  ]
}$json$::jsonb,
    updated_at = now()
where section = 'sns';
