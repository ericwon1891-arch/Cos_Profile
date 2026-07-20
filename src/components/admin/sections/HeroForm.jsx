import { useState } from 'react'
import TextField from '../fields/TextField'
import TextAreaField from '../fields/TextAreaField'
import ListField from '../fields/ListField'
import ImageField from '../fields/ImageField'

export default function HeroForm({ data, onSave }) {
  const [form, setForm] = useState(data)

  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <ImageField
        label="배경 사진"
        value={form.photo}
        onChange={v => update('photo', v)}
        hint="권장 크기: 1920×1600px 이상, 인물은 중앙에 배치 (모바일/데스크톱 양쪽에서 잘림), 용량 1MB 이하"
      />
      <TextField label="상단 라벨" value={form.label} onChange={v => update('label', v)} />
      <TextField label="이름" value={form.name} onChange={v => update('name', v)} />
      <TextField label="서브타이틀" value={form.subtitle} onChange={v => update('subtitle', v)} />
      <TextAreaField label="인용구" value={form.quote} onChange={v => update('quote', v)} rows={3} />
      <ListField
        label="퀵팩트"
        items={form.facts}
        onChange={items => update('facts', items)}
        newItem={{ label: '', value: '' }}
        addLabel="퀵팩트 추가"
        renderItem={({ item, index, onChange }) => (
          <div className="grid grid-cols-2 gap-2">
            <TextField label="라벨" value={item.label} onChange={v => onChange(index, { ...item, label: v })} />
            <TextField label="값" value={item.value} onChange={v => onChange(index, { ...item, value: v })} />
          </div>
        )}
      />
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">저장</button>
    </form>
  )
}
