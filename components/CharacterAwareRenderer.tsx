import React from 'react';
import { Character } from '../types';

interface CharacterAwareRendererProps {
  text: string;
  characters: Character[];
  language: string;
}

const CharacterAwareRenderer: React.FC<CharacterAwareRendererProps> = ({ text, characters, language }) => {
  if (!characters || characters.length === 0 || !text) {
    return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>;
  }

  // Use translatedName for matching in the translated text.
  const sortedCharacters = [...characters]
      .filter(c => c.translatedName)
      .sort((a, b) => b.translatedName.length - a.translatedName.length);
  
  const names = sortedCharacters.map(c => c.translatedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  if (names.length === 0) {
      return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>;
  }

  // Conditionally use word boundaries based on language
  const noBoundaryLanguages = ['Japanese', 'Chinese (Simplified)', 'Korean'];
  const useBoundaries = !noBoundaryLanguages.includes(language);
  const boundary = useBoundaries ? '\\b' : '';
  const pattern = `(${names.join('|')})`;
  const regex = new RegExp(`${boundary}${pattern}${boundary}`, 'gi');

  const parts = text.split(regex);

  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, index) => {
        // With split and a capturing group, odd-indexed parts are the matches.
        if (index % 2 === 1) {
            const character = sortedCharacters.find(c => c.translatedName.toLowerCase() === part.toLowerCase());
            if (character) {
              return (
                <span key={index} className="relative group/char cursor-pointer bg-[var(--accent-primary)]/10 px-1 py-0.5 rounded transition-colors hover:bg-[var(--accent-primary)]/20">
                  {part}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded py-1.5 px-3 opacity-0 group-hover/char:opacity-100 transition-opacity pointer-events-none shadow-lg border border-[var(--border-primary)] z-10">
                    <strong className="font-bold">{character.name} ({character.translatedName})</strong>
                    <div className="text-[var(--text-secondary)] mt-1">
                      <div>Gender: {character.gender || 'N/A'}</div>
                      <div>Pronouns: {character.pronouns || 'N/A'}</div>
                    </div>
                  </span>
                </span>
              );
            }
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </div>
  );
};

export default CharacterAwareRenderer;
