import { supabase } from '../../../lib/supabaseClient'

export default function ImageField({ label, value, onChange, hint }) {
  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    const path = `${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('media').upload(path, file)
    if (error) {
      const isTooLarge = error.statusCode === '413' || /exceeded|too large/i.test(error.message)
      alert(
        isTooLarge
          ? '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
          : `업로드 실패: ${error.message}`
      )
      return
    }

    const { data } = supabase.storage.from('media').getPublicUrl(path)
    onChange(data.publicUrl)
  }

  return (
    <div className="mb-4">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {value && (
        <img src={value} alt={label} className="w-32 h-32 object-cover rounded mb-2" />
      )}
      <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
    </div>
  )
}
