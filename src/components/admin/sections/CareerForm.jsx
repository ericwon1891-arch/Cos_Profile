import { useState } from 'react'
import TextField from '../fields/TextField'
import ListField from '../fields/ListField'

export default function CareerForm({ data, onSave }) {
  const [form, setForm] = useState(data)

  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <TextField label="제목" value={form.heading} onChange={v => update('heading', v)} />
      <ListField
        label="연도별 이력"
        items={form.years}
        onChange={items => update('years', items)}
        newItem={{ year: '', entries: [] }}
        addLabel="연도 추가"
        renderItem={({ item: yearGroup, index: yearIndex, onChange: onChangeYear }) => (
          <>
            <TextField
              label="연도"
              value={yearGroup.year}
              onChange={v => onChangeYear(yearIndex, { ...yearGroup, year: v })}
            />
            <ListField
              label="행사 목록"
              items={yearGroup.entries}
              onChange={entries => onChangeYear(yearIndex, { ...yearGroup, entries })}
              newItem={{ event: '', role: '' }}
              addLabel="행사 추가"
              renderItem={({ item: entry, index: entryIndex, onChange: onChangeEntry }) => (
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="행사명" value={entry.event} onChange={v => onChangeEntry(entryIndex, { ...entry, event: v })} />
                  <TextField label="역할" value={entry.role} onChange={v => onChangeEntry(entryIndex, { ...entry, role: v })} />
                </div>
              )}
            />
          </>
        )}
      />
      <button type="submit" className="bg-gray-900 text-white rounded px-4 py-2 text-sm">저장</button>
    </form>
  )
}
