import { render, screen, fireEvent } from '@testing-library/react'
import ListField from '../admin/fields/ListField'

function renderTextItem({ item, index, onChange }) {
  return (
    <input
      aria-label={`item-${index}`}
      value={item}
      onChange={e => onChange(index, e.target.value)}
    />
  )
}

describe('ListField', () => {
  it('reorderable이 아니면 드래그 핸들을 표시하지 않는다', () => {
    render(
      <ListField
        label="목록"
        items={['a', 'b']}
        onChange={() => {}}
        newItem=""
        renderItem={renderTextItem}
      />
    )
    expect(screen.queryByLabelText('드래그해서 순서 변경')).not.toBeInTheDocument()
  })

  it('reorderable이면 드래그 핸들을 표시한다', () => {
    render(
      <ListField
        label="목록"
        items={['a', 'b']}
        onChange={() => {}}
        newItem=""
        renderItem={renderTextItem}
        reorderable
      />
    )
    expect(screen.getAllByLabelText('드래그해서 순서 변경')).toHaveLength(2)
  })

  it('드래그해서 항목 순서를 옮기면 onChange가 새 순서로 호출된다', () => {
    const onChange = vi.fn()
    const { container } = render(
      <ListField
        label="목록"
        items={['a', 'b', 'c']}
        onChange={onChange}
        newItem=""
        renderItem={renderTextItem}
        reorderable
      />
    )
    const rows = container.querySelectorAll('[draggable="true"]')
    fireEvent.dragStart(rows[2])
    fireEvent.dragOver(rows[0])
    fireEvent.drop(rows[0])
    expect(onChange).toHaveBeenCalledWith(['c', 'a', 'b'])
  })
})
