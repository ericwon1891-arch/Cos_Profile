import { useState } from 'react'
import TextField from '../fields/TextField'
import ListField from '../fields/ListField'

export default function SnsForm({ data, onSave }) {
  const [form, setForm] = useState(data)

  function update(key, value) {
    setForm({ ...form, [key]: value })
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }}>
      <TextField label="제목" value={form.heading} onChange={v => update('heading', v)} />
      <ListField
        label="플랫폼"
        items={form.platforms}
        onChange={items => update('platforms', items)}
        newItem={{ name: '', stats: [], url: '' }}
        addLabel="플랫폼 추가"
        renderItem={({ item: platform, index: pIndex, onChange: onChangePlatform }) => (
          <>
            <TextField label="이름" value={platform.name} onChange={v => onChangePlatform(pIndex, { ...platform, name: v })} />
            <TextField label="링크" value={platform.url} onChange={v => onChangePlatform(pIndex, { ...platform, url: v })} />
            <ListField
              label="통계"
              items={platform.stats}
              onChange={stats => onChangePlatform(pIndex, { ...platform, stats })}
              newItem={{ label: '', value: '' }}
              addLabel="통계 추가"
              renderItem={({ item: stat, index: sIndex, onChange: onChangeStat }) => (
                <div className="grid grid-cols-2 gap-2">
                  <TextField label="라벨" value={stat.label} onChange={v => onChangeStat(sIndex, { ...stat, label: v })} />
                  <TextField label="값" value={stat.value} onChange={v => onChangeStat(sIndex, { ...stat, value: v })} />
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
