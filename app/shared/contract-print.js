// Renders a contract's plain body_text into a print-styled HTML document
// matching the original Word/PDF template's layout (centered title, bold
// clause headings, justified body, two-column signature block) — opened in
// a new tab and turned into a real PDF via the browser's native
// print-to-PDF, so there's no PDF-generation library/dependency involved.
const CLAUSE_RE = /^CLÁUSULA\b/i;
const HEADER_LINES = new Set(['MENTORIA PERSEA', 'DAS PARTES', 'TESTEMUNHAS:']);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderBlock(block) {
  const trimmed = block.trim();
  if (!trimmed) return '';

  // Signature line — two names side by side under underscore rules.
  if (/^_{3,}/m.test(trimmed) && trimmed.includes('_')) {
    const lines = trimmed.split('\n');
    return `<div class="signature-block">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}</div>`;
  }

  if (trimmed === 'MENTORIA PERSEA') return `<h1>${escapeHtml(trimmed)}</h1>`;
  if (HEADER_LINES.has(trimmed)) return `<p class="section-label">${escapeHtml(trimmed)}</p>`;
  if (CLAUSE_RE.test(trimmed)) return `<h2>${escapeHtml(trimmed)}</h2>`;

  // Bullet sub-items (scope lists use leading "-" or lettered a)/b)/c)).
  const lines = trimmed.split('\n');
  if (lines.every((l) => /^\s*[-•]/.test(l))) {
    return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^\s*[-•]\s*/, ''))}</li>`).join('')}</ul>`;
  }

  return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
}

export function renderContractPrintHtml(bodyText, { title = 'Contrato' } = {}) {
  const blocks = bodyText.split(/\n\s*\n/).map(renderBlock).join('\n');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 2.5cm 2cm; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: #111; max-width: 780px; margin: 40px auto; padding: 0 20px; }
  h1 { text-align: center; font-size: 14pt; letter-spacing: 0.05em; margin-bottom: 24px; }
  h2 { font-size: 12pt; font-weight: bold; margin-top: 22px; margin-bottom: 10px; }
  p { text-align: justify; margin: 0 0 12px; }
  .section-label { font-weight: bold; text-align: left; }
  ul { margin: 0 0 12px 24px; padding: 0; }
  li { text-align: justify; margin-bottom: 6px; }
  .signature-block p { text-align: left; white-space: pre; font-family: monospace, 'Times New Roman'; }
  .print-bar { text-align: center; margin-bottom: 24px; }
  @media print { .print-bar { display: none; } }
</style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;">Imprimir / Salvar como PDF</button></div>
  ${blocks}
</body>
</html>`;
}
