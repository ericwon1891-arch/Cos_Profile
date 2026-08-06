import { supabase } from '../../../lib/supabaseClient'
import { buildUploadPath } from '../../../lib/uploadPath'
import { classifyUploadError } from '../../../lib/uploadErrors'

export default function ImageField({ label, value, onChange, hint }) {
  async function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    const path = buildUploadPath(file.name)
    const { error } = await supabase.storage.from('media').upload(path, file)
    if (error) {
      alert(classifyUploadError(error))
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
