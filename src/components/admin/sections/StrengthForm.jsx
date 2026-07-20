import { useState } from 'react'
import TextField from '../fields/TextField'
import TextAreaField from '../fields/TextAreaField'
import ListField from '../fields/ListField'

export default function StrengthForm({ data, onSave }) {
  const [form, setForm] = useState(data)

  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <TextField label="제목" value={form.heading} onChange={v => update('heading', v)} />
      <ListField
        label="강점 항목"
        items={form.items}
        onChange={items => update('items', items)}
        newItem={{ title: '', description: '' }}
        addLabel="강점 추가"
        renderItem={({ item, index, onChange }) => (
          <>
            <TextField label="제목" value={item.title} onChange={v => onChange(index, { ...item, title: v })} />
            <TextAreaField label="설명" value={item.description} onChange={v => onChange(index, { ...item, description: v })} rows={2} />
          </>
        )}
      />
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">저장</button>
    </form>
  )
}
