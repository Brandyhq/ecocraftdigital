import qrcode from 'qrcode-generator'

/**
 * Inline SVG QR code for a card token. Built on the server so the card does not depend on a CDN,
 * is crisp at any size, and always has a white background with the full 4-module quiet zone
 * (a dark-mode page or a tight crop cannot remove it).
 *
 * The token is encoded upper-cased in alphanumeric mode with error correction M: 25x25 modules
 * instead of the 33x33 that byte mode with H needs, so every module is about a third larger on screen
 * and survives the blur of a phone camera pointed at another phone. A screen has no scratches to
 * recover from, so the extra error correction bought nothing.
 */
export function qrSvg(token: string, label: string): string {
  const qr = qrcode(0, 'M')
  qr.addData(token.toUpperCase(), 'Alphanumeric')
  qr.make()
  const n = qr.getModuleCount()
  const quiet = 4
  const size = n + quiet * 2
  let d = ''
  for (let r = 0; r < n; r++) {
    let c = 0
    while (c < n) {
      if (!qr.isDark(r, c)) { c++; continue }
      let end = c
      while (end < n && qr.isDark(r, end)) end++
      d += `M${c + quiet} ${r + quiet}h${end - c}v1h${c - end}z`
      c = end
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
}
