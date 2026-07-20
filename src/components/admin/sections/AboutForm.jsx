import { useState } from 'react'
import TextField from '../fields/TextField'
import TextAreaField from '../fields/TextAreaField'

export default function AboutForm({ data, onSave }) {
  const [form, setForm] = useState(data)

  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <TextField label="제목" value={form.heading} onChange={v => update('heading', v)} />
      <TextAreaField label="본문" value={form.body} onChange={v => update('body', v)} rows={16} />
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">저장</button>
    </form>
  )
}
