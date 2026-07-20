import { useState } from 'react'
import TextField from '../fields/TextField'
import ListField from '../fields/ListField'

export default function ServicesForm({ data, onSave }) {
  const [form, setForm] = useState(data)

  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <TextField label="제목" value={form.heading} onChange={v => update('heading', v)} />
      <ListField
        label="서비스 항목"
        items={form.items}
        onChange={items => update('items', items)}
        newItem="새 서비스"
        addLabel="서비스 추가"
        renderItem={({ item, index, onChange }) => (
          <TextField label={`항목 ${index + 1}`} value={item} onChange={v => onChange(index, v)} />
        )}
      />
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">저장</button>
    </form>
  )
}
