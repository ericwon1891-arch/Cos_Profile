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
        newItem={{ id: Date.now(), title: '', category: form.categories[1] ?? '', type: 'photo', src: '', thumbnail: '', photos: [] }}
        addLabel="캐릭터 추가"
        renderItem={({ item, index, onChange }) => (
          <>
            <TextField label="캐릭터/작품명" value={item.title} onChange={v => onChange(index, { ...item, title: v })} />
            <TextField label="카테고리" value={item.category} onChange={v => onChange(index, { ...item, category: v })} />
            <TextField label="타입 (photo/youtube/local)" value={item.type} onChange={v => onChange(index, { ...item, type: v })} />
            <ImageField
              label="사진 (카드 대표 사진)"
              value={item.thumbnail}
              onChange={v => onChange(index, { ...item, thumbnail: v, src: item.type === 'photo' ? v : item.src })}
              hint="권장 크기: 1280×720px (16:9), 용량 500KB 이하"
            />
            <ListField
              label="갤러리 사진 (타입이 photo일 때만 사용됨, 모달에서 넘겨보는 사진들 — 대표 사진과 별개, 대표 사진도 보이게 하려면 여기에 한 번 더 추가)"
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
            <TextField label="YouTube 영상 ID (type이 youtube일 때)" value={item.youtubeId || ''} onChange={v => onChange(index, { ...item, youtubeId: v })} />
            <TextField label="영상 파일 URL (type이 local일 때)" value={item.src} onChange={v => onChange(index, { ...item, src: v })} />
          </>
        )}
      />
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">저장</button>
    </form>
  )
}
