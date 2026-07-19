export default function TextAreaField({ label, value, onChange, rows = 6 }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      />
    </label>
  )
}
