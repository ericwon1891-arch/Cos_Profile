update site_content
set data = $json${
  "qrImage": "/placeholder-qr.png",
  "links": [
    { "label": "유튜브", "href": "https://www.youtube.com/@nanary000" },
    { "label": "인스타그램", "href": "https://www.instagram.com/cos_nanary/" },
    { "label": "X", "href": "https://x.com/nanary000" },
    { "label": "이메일", "href": "mailto:nanary000@naver.com" }
  ]
}$json$::jsonb,
    updated_at = now()


where section = 'contact';
