/**
 * SVG 文字列から id 指定の <g> 要素を、対応する </g> までで切り出す。
 * 正規表現の貪欲マッチだと最後の </g> まで飲み込み、非貪欲だと最初の </g> で切れる。
 * どちらも入れ子に耐えないので、開閉の深さを数える。
 * XML コメント(<!-- ... -->)の中身はタグとして数えず読み飛ばす。
 *
 * @param {string} svg SVG 全体の文字列
 * @param {string} id 探す <g> の id 属性値
 * @returns {string | null} 見つかった <g>...</g>。無ければ null
 */
export function extractGroup(svg, id) {
  const open = new RegExp(`<g\\b[^>]*\\bid="${id}"[^>]*>`);
  const found = open.exec(svg);
  if (found === null) return null;

  const start = found.index;
  let depth = 1;

  const tag = /<!--[\s\S]*?-->|<g\b[^>]*?(\/?)>|<\/g\s*>/g;
  tag.lastIndex = start + found[0].length;

  for (let m = tag.exec(svg); m !== null; m = tag.exec(svg)) {
    if (m[0].startsWith('<!--')) {
      // コメントの中身(</g> を含みうる)は無視する
      continue;
    }
    if (m[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return svg.slice(start, m.index + m[0].length);
    } else if (m[1] !== '/') {
      // 自己終了(<g ... />)は開いた扱いにしない
      depth += 1;
    }
  }

  return null;
}
