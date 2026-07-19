import { render, screen, fireEvent } from '@testing-library/react'
import WorksSection from '../WorksSection'

vi.mock('../../data/works', () => ({
  works: [
    { id: 1, title: '유튜브 영상 1', category: '유튜브/SNS', type: 'youtube', youtubeId: 'a1', thumbnail: '' },
    { id: 2, title: '유튜브 영상 2', category: '유튜브/SNS', type: 'youtube', youtubeId: 'a2', thumbnail: '' },
    { id: 3, title: '광고 영상 1', category: '광고/홍보', type: 'youtube', youtubeId: 'a3', thumbnail: '' },
  ],
}))

describe('WorksSection', () => {
  it('기본은 전체 작업물을 표시한다', () => {
    render(<WorksSection />)
    expect(screen.getAllByTestId('work-card')).toHaveLength(3)
  })

  it('유튜브/SNS 필터 클릭 시 해당 카테고리만 표시한다', () => {
    render(<WorksSection />)
    fireEvent.click(screen.getByRole('button', { name: '유튜브/SNS' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(2)
  })

  it('광고/홍보 필터 클릭 시 해당 카테고리만 표시한다', () => {
    render(<WorksSection />)
    fireEvent.click(screen.getByRole('button', { name: '광고/홍보' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(1)
  })

  it('전체 필터 클릭 시 모든 작업물을 표시한다', () => {
    render(<WorksSection />)
    fireEvent.click(screen.getByRole('button', { name: '유튜브/SNS' }))
    fireEvent.click(screen.getByRole('button', { name: '전체' }))
    expect(screen.getAllByTestId('work-card')).toHaveLength(3)
  })

  it('작업물 카드 클릭 시 VideoModal이 열린다', () => {
    render(<WorksSection />)
    fireEvent.click(screen.getAllByTestId('work-card')[0])
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument()
  })

  it('VideoModal 닫기 클릭 시 모달이 닫힌다', () => {
    render(<WorksSection />)
    fireEvent.click(screen.getAllByTestId('work-card')[0])
    fireEvent.click(screen.getByRole('button', { name: /닫기/i }))
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument()
  })
})
