export default function ListField({ label, items, onChange, renderItem, addLabel = '항목 추가', newItem }) {
  function updateItem(index, newValue) {
    const next = [...items]
    next[index] = newValue
    onChange(next)
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  function addItem() {
    onChange([...items, newItem])
  }

  return (
    <div className="mb-6">
      <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="border border-gray-200 rounded p-3 relative">
            {renderItem({ item, index, onChange: updateItem, onRemove: removeItem })}
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="absolute top-2 right-2 text-red-500 text-xs hover:underline"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-3 text-sm text-blue-600 hover:underline"
      >
        + {addLabel}
      </button>
    </div>
  )
}
