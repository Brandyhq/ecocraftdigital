import { escapeHtml as e } from './html'

/** Replaces {{token}} placeholders with values from the site settings; unknown/empty ones become "[להשלים]". */
export function fillVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k]?.trim() ? vars[k] : '[להשלים]'))
}

/** True while the text still has parts the owner must fill in. */
export const hasPlaceholders = (text: string) => text.includes('[להשלים') || /\{\{\w+\}\}/.test(text)

/**
 * Tiny, safe markup: "## heading", "- bullet", "> note", blank line = new paragraph.
 * Everything is HTML-escaped first, so page bodies can never inject markup or scripts.
 */
export function renderBody(text: string): string {
  const out: string[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) out.push(`<ul class="incl">${list.map((li) => `<li><span>${e(li)}</span></li>`).join('')}</ul>`)
    list = []
  }
  let para: string[] = []
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(e).join('<br>')}</p>`)
    para = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
      flushPara()
    } else if (line.startsWith('## ')) {
      flush()
      flushPara()
      out.push(`<h2>${e(line.slice(3))}</h2>`)
    } else if (line.startsWith('- ')) {
      flushPara()
      list.push(line.slice(2))
    } else if (line.startsWith('> ')) {
      flush()
      flushPara()
      out.push(`<div class="note-box">${e(line.slice(2))}</div>`)
    } else {
      flush()
      para.push(line)
    }
  }
  flush()
  flushPara()
  return out.join('\n')
}

/** FAQPage structured data from "## question" + answer paragraphs. */
export function faqLd(text: string) {
  const items: { q: string; a: string[] }[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('## ')) items.push({ q: line.slice(3), a: [] })
    else if (line && items.length) items[items.length - 1].a.push(line.replace(/^[-> ]+/, ''))
  }
  const valid = items.filter((i) => i.a.length)
  if (!valid.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a.join(' ') } }))
  }
}

/** The plain-text summary used for meta descriptions. */
export function firstText(text: string, max = 155): string {
  const line = text.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('>') && !l.startsWith('## ') && !l.startsWith('- ')) ?? ''
  return line.length > max ? line.slice(0, max - 1).trimEnd() + '…' : line
}
