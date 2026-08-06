import { render, fireEvent, waitFor } from '@testing-library/react'
import ImageField from '../admin/fields/ImageField'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { storage: { from: vi.fn() } },
}))

function makeFile(name) {
  return new File(['x'], name, { type: 'image/jpeg' })
}

describe('ImageField', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('한글 파일명이어도 타임스탬프+확장자 경로로 업로드한다', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null })
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://x/media/1700000000000.jpg' } })
    supabase.storage.from.mockReturnValue({ upload, getPublicUrl })
    const onChange = vi.fn()

    const { container } = render(<ImageField label="배경 사진" value="" onChange={onChange} />)
    const input = container.querySelector('input[type="file"]')
    const file = makeFile('SIH_0026-편집.jpg')

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://x/media/1700000000000.jpg'))
    expect(upload).toHaveBeenCalledWith('1700000000000.jpg', file)
  })

  it('업로드 실패(413) 시 용량 안내 alert를 띄운다', async () => {
    const upload = vi.fn().mockResolvedValue({ error: { statusCode: '413', message: 'Payload too large' } })
    supabase.storage.from.mockReturnValue({ upload, getPublicUrl: vi.fn() })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const onChange = vi.fn()

    const { container } = render(<ImageField label="배경 사진" value="" onChange={onChange} />)
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile('big.jpg')] } })

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        '업로드 실패: 파일 용량이 너무 큽니다. 더 작은 이미지로 줄여서 다시 시도해 주세요.'
      )
    )
    expect(onChange).not.toHaveBeenCalled()
  })

  it('로그인 만료(RLS) 에러 시 재로그인 안내 alert를 띄운다', async () => {
    const upload = vi.fn().mockResolvedValue({
      error: { message: 'new row violates row-level security policy' },
    })
    supabase.storage.from.mockReturnValue({ upload, getPublicUrl: vi.fn() })
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const onChange = vi.fn()

    const { container } = render(<ImageField label="배경 사진" value="" onChange={onChange} />)
    const input = container.querySelector('input[type="file"]')
    fireEvent.change(input, { target: { files: [makeFile('big.jpg')] } })

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        '업로드 실패: 로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.'
      )
    )
    expect(onChange).not.toHaveBeenCalled()
  })
})
