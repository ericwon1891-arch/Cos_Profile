import { useSectionContent } from '../hooks/useSectionContent'
import CharacterSectionBlock from './CharacterSectionBlock'

export default function CharactersSection() {
  const { data, loading } = useSectionContent('characters')

  if (loading || !data?.sections?.length) {
    return null
  }

  return (
    <>
      {data.sections.map(section => (
        <CharacterSectionBlock key={section.id} section={section} />
      ))}
    </>
  )
}
