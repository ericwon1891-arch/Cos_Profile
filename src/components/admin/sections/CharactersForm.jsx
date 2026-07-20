import { useState } from 'react'
import TextField from '../fields/TextField'
import ImageField from '../fields/ImageField'
import ListField from '../fields/ListField'

export default function CharactersForm({ data, onSave }) {
  const [form, setForm] = useState(data)

  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <TextField label="제목" value={form.heading} onChange={v => update('heading', v)} />
      <ListField
        label="카테고리 (첫 번째는 '전체' 권장)"
        items={form.categories}
        onChange={items => update('categories', items)}
        newItem="카테고리"
        addLabel="카테고리 추가"
        renderItem={({ item, index, onChange }) => (
          <TextField label={`카테고리 ${index + 1}`} value={item} onChange={v => onChange(index, v)} />
        )}
      />
      <ListField
        label="캐릭터"
        items={form.items}
        onChange={items => update('items', items)}
        newItem={{ id: Date.now(), title: '', category: form.categories[1] ?? '', thumbnail: '', photos: [] }}
        addLabel="캐릭터 추가"
        renderItem={({ item, index, onChange }) => (
          <>
            <TextField label="캐릭터/작품명" value={item.title} onChange={v => onChange(index, { ...item, title: v })} />
            <TextField label="카테고리" value={item.category} onChange={v => onChange(index, { ...item, category: v })} />
            <ImageField
              label="사진 (카드 대표 사진)"
              value={item.thumbnail}
              onChange={v => onChange(index, { ...item, thumbnail: v })}
              hint="권장 크기: 1280×720px (16:9), 용량 500KB 이하"
            />
            <ListField
              label="갤러리 사진 (필수, 모달에서 순서대로 넘겨봄 — 영상이 있으면 마지막에 이어서 표시)"
              items={item.photos ?? []}
              onChange={photos => onChange(index, { ...item, photos })}
              newItem=""
              addLabel="갤러리 사진 추가"
              reorderable
              renderItem={({ item: photoUrl, index: photoIndex, onChange: onPhotoChange }) => (
                <ImageField
                  label={`사진 ${photoIndex + 1}`}
                  value={photoUrl}
                  onChange={v => onPhotoChange(photoIndex, v)}
                  hint="권장 크기: 1280×720px (16:9), 용량 500KB 이하"
                />
              )}
            />
            <TextField label="유튜브 영상 ID 또는 링크 (선택, 갤러리 마지막에 추가됨)" value={item.youtubeId || ''} onChange={v => onChange(index, { ...item, youtubeId: v })} />
            <TextField
              label="시작 시간 (초, 선택 — 유튜브 영상 있을 때만)"
              value={item.youtubeStart ?? ''}
              onChange={v => onChange(index, { ...item, youtubeStart: v === '' ? undefined : Number(v) })}
            />
            <TextField label="로컬 영상 파일 URL (선택, 유튜브 없을 때만)" value={item.localVideoSrc || ''} onChange={v => onChange(index, { ...item, localVideoSrc: v })} />
          </>
        )}
      />
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">저장</button>
    </form>
  )
}
