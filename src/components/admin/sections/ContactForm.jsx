import { useState } from 'react'
import TextField from '../fields/TextField'
import ImageField from '../fields/ImageField'
import ListField from '../fields/ListField'

export default function ContactForm({ data, onSave }) {
  const [form, setForm] = useState(data)

  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <ImageField label="QR 코드 이미지" value={form.qrImage} onChange={v => update('qrImage', v)} />
      <ListField
        label="링크"
        items={form.links}
        onChange={items => update('links', items)}
        newItem={{ label: '', href: '' }}
        addLabel="링크 추가"
        renderItem={({ item, index, onChange }) => (
          <div className="grid grid-cols-2 gap-2">
            <TextField label="라벨" value={item.label} onChange={v => onChange(index, { ...item, label: v })} />
            <TextField label="URL" value={item.href} onChange={v => onChange(index, { ...item, href: v })} />
          </div>
        )}
      />
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">저장</button>
    </form>
  )
}
