/**
 * MAGNUS Brand HTML Utilities
 * 
 * Reusable functions for generating consistently branded HTML across the app.
 * Used for reports, exports, and email templates.
 */

// MAGNUS Brand Colors
const BRAND_COLORS = {
  darkGreen: '#144334',
  deepGreen: '#1A6B51',
  orange: '#F88A35',
  offWhite: '#F9F8F6',
  primaryText: '#192622',
  secondaryText: '#17221E',
} as const;

/**
 * Generate a standard MAGNUS HTML wrapper with consistent branding
 */
export function generateMAGNUSHTMLWrapper(
  title: string,
  content: string,
  headerColor: string = BRAND_COLORS.darkGreen,
  metadata?: Record<string, string>
): string {
  const timestamp = new Date().toLocaleString();
  
  let metaHTML = '';
  if (metadata) {
    metaHTML = Object.entries(metadata)
      .map(([key, value]) => `<div class="meta-item"><strong>${key}:</strong> ${value}</div>`)
      .join('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: ${BRAND_COLORS.primaryText};
      background: ${BRAND_COLORS.offWhite};
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.07);
    }
    header {
      background: ${headerColor};
      color: white;
      padding: 50px 40px;
    }
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }
    h1 {
      font-size: 2.2em;
      margin-bottom: 15px;
      color: white;
      font-weight: 700;
      line-height: 1.2;
    }
    .meta-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 15px;
      font-size: 0.95em;
      opacity: 0.95;
    }
    .meta-item {
      display: flex;
      gap: 8px;
    }
    .meta-item strong {
      font-weight: 600;
    }
    .main-content {
      padding: 50px 40px;
    }
    .content {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 0.95em;
      line-height: 1.8;
      color: ${BRAND_COLORS.primaryText};
    }
    .content h2 {
      font-size: 1.4em;
      color: ${BRAND_COLORS.darkGreen};
      margin-bottom: 15px;
      margin-top: 30px;
      padding-bottom: 12px;
      border-bottom: 3px solid ${BRAND_COLORS.orange};
      font-weight: 700;
    }
    .content h2:first-child {
      margin-top: 0;
    }
    .content h3 {
      font-size: 1.1em;
      color: ${BRAND_COLORS.deepGreen};
      margin: 18px 0 10px 0;
      font-weight: 600;
    }
    .content p {
      margin-bottom: 12px;
      color: ${BRAND_COLORS.secondaryText};
    }
    .content ul, .content ol {
      margin-left: 25px;
      margin-bottom: 12px;
    }
    .content li {
      margin-bottom: 8px;
      color: ${BRAND_COLORS.secondaryText};
    }
    footer {
      background: ${BRAND_COLORS.deepGreen};
      color: white;
      padding: 30px 40px;
      margin-top: 50px;
    }
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 0.9em;
    }
    .logo {
      font-weight: 700;
      font-size: 1.1em;
      letter-spacing: 0.5px;
    }
    @media print {
      body { background: white; }
      .container { box-shadow: none; }
      header, footer { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-content">
        <div class="header-left">
          <h1>${title}</h1>
          <div class="meta-info">
            ${metaHTML}
            <div class="meta-item"><strong>Generated:</strong> ${timestamp}</div>
          </div>
        </div>
      </div>
    </header>
    <div class="main-content">
      <div class="content">
        ${content}
      </div>
    </div>
    <footer>
      <div class="footer-content">
        <div class="logo">MAGNUS Intelligence System</div>
        <div style="font-size: 0.85em;">Professional Intelligence Report</div>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Convert plain text sections to HTML formatting
 */
export function formatPlainTextAsHTML(text: string): string {
  return text
    .split('\n')
    .map((line: string) => {
      // Section headers (e.g., "1. EXECUTIVE SUMMARY")
      if (line.match(/^\d+\. /)) {
        const title = line.replace(/^\d+\. /, '');
        return `<h2>${title}</h2>`;
      }
      // Bullet points (indented with "- ")
      if (line.match(/^\s+-/)) {
        return `<li>${line.replace(/^\s+-\s*/, '')}</li>`;
      }
      // Subsection headers (indented, starts with letter)
      if (line.match(/^\s{3}[A-Z]/)) {
        return `<h3>${line.trim()}</h3>`;
      }
      // Indented content becomes paragraph
      if (line.match(/^\s{3}/)) {
        return `<p>${line.replace(/^\s{3}/, '')}</p>`;
      }
      // Empty lines
      if (line.trim() === '') {
        return '';
      }
      // Regular text
      return `<p>${line}</p>`;
    })
    .join('\n');
}

export default { generateMAGNUSHTMLWrapper, formatPlainTextAsHTML };
