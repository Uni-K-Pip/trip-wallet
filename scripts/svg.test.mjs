import { describe, it, expect } from 'vitest';
import { extractGroup } from './svg.mjs';

describe('extractGroup', () => {
  it('入れ子の <g> があっても対応する </g> までで切る', () => {
    const svg = '<svg><g id="motif"><g><rect/></g><circle/></g><g id="other"><rect/></g></svg>';

    expect(extractGroup(svg, 'motif')).toBe('<g id="motif"><g><rect/></g><circle/></g>');
  });

  it('自己終了の <g /> は入れ子として数えない', () => {
    const svg = '<svg><g id="motif"><g class="empty" /><circle/></g><rect/></svg>';

    expect(extractGroup(svg, 'motif')).toBe('<g id="motif"><g class="empty" /><circle/></g>');
  });

  it('属性が増えても id で見つけられる', () => {
    const svg = '<svg><g fill="#fff" id="motif" opacity="0.5"><rect/></g></svg>';

    expect(extractGroup(svg, 'motif')).toBe('<g fill="#fff" id="motif" opacity="0.5"><rect/></g>');
  });

  it('見つからなければ null を返す', () => {
    expect(extractGroup('<svg><g id="other"><rect/></g></svg>', 'motif')).toBeNull();
  });
});
