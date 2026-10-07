import { describe, expect, it } from 'vitest';
import { formatBoardNote, nextBoardFlow } from './board-note';

describe('board note flow label', () => {
  it('tags a multi-step message and keeps that tag on the next step', () => {
    const armed = nextBoardFlow(null, 'Tap the court', 'turnover');
    expect(armed).toBe('turnover');
    expect(nextBoardFlow(armed, 'Choose the player')).toBe('turnover');
    expect(formatBoardNote('Choose the player', 'Turnover')).toBe('Turnover: Choose the player');
  });

  it('drops the tag when the message is cleared', () => {
    expect(nextBoardFlow('foul', null)).toBeNull();
  });

  it('drops the tag for a one-tap result', () => {
    expect(nextBoardFlow('turnover', '24s violation. Press start clock.', null)).toBeNull();
    expect(formatBoardNote('24s violation. Press start clock.', null)).toBe('24s violation. Press start clock.');
  });

  it('switches the tag when another multi-step button is pressed', () => {
    expect(nextBoardFlow('turnover', 'Tap where the foul happened', 'foul')).toBe('foul');
  });
});
