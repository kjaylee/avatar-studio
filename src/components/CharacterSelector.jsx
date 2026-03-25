export function CharacterSelector({ characters = [], activeId, onSelect }) {
  return (
    <div className="character-selector">
      {characters.map(character => (
        <div
          key={character.id}
          className={`character-selector__item${character.id === activeId ? ' character-selector__item--active' : ''}`}
          onClick={() => onSelect && onSelect(character.id)}
        >
          {character.thumbnail && (
            <img src={character.thumbnail} alt={character.name} />
          )}
          <span>{character.name}</span>
        </div>
      ))}
    </div>
  )
}

export default CharacterSelector
