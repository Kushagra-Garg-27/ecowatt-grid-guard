"""
EcoWatt Grid Guard - Master PDF Generator
Renders docs/EcoWatt_Grid_Guard_Final_Project_and_Demo_Guide.md into an executive,
publication-quality PDF using Playwright Chromium with full KaTeX, Mermaid, and CSS Paged Media.
"""
import os
import sys
import json
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT_DIR = Path(__file__).resolve().parent.parent
DOC_PATH = ROOT_DIR / "docs" / "EcoWatt_Grid_Guard_Final_Project_and_Demo_Guide.md"
PDF_PATH = ROOT_DIR / "docs" / "EcoWatt_Grid_Guard_Final_Project_and_Demo_Guide.pdf"
HTML_TEMP_PATH = ROOT_DIR / "docs" / "_temp_render.html"

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EcoWatt Grid Guard — Final Project & Demonstration Guide</title>
  
  <!-- Inter & JetBrains Mono Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- KaTeX for LaTeX Math -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"></script>
  
  <!-- Marked.js for Markdown Parsing -->
  <script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
  
  <!-- Mermaid.js for Diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>

  <style>
    @page {
      size: A4;
      margin: 18mm 14mm 18mm 14mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 8.8pt;
      line-height: 1.55;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Executive Cover Page */
    .cover-page {
      min-height: 92vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      padding: 20px 8px 10px 8px;
    }

    .cover-header-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #047857;
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      border-radius: 9999px;
      align-self: flex-start;
      margin-bottom: 20px;
    }

    .cover-header-badge .dot {
      width: 7px;
      height: 7px;
      border-radius: 9999px;
      background: #10b981;
    }

    .cover-title-group {
      margin-bottom: 24px;
    }

    .cover-title {
      font-size: 30pt;
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.1;
      color: #0f172a;
      margin: 0 0 10px 0;
    }

    .cover-title .accent {
      color: #059669;
    }

    .cover-subtitle {
      font-size: 13pt;
      font-weight: 500;
      color: #475569;
      line-height: 1.45;
      margin: 0 0 14px 0;
    }

    .cover-tagline {
      font-size: 9.5pt;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
      border-left: 3px solid #059669;
      padding-left: 10px;
      margin: 0;
    }

    /* Cover Metadata Grid */
    .cover-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      margin: 18px 0;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      margin-bottom: 2px;
    }

    .meta-value {
      font-size: 8.5pt;
      font-weight: 600;
      color: #0f172a;
    }

    .meta-value.mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
    }

    /* Cover Verdict Banner */
    .cover-verdict-card {
      background: #09090b;
      color: #fafafa;
      border-radius: 8px;
      padding: 16px 18px;
      border: 1px solid #27272a;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
      margin: 16px 0;
    }

    .verdict-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #27272a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }

    .verdict-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      font-weight: 700;
      color: #34d399;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      padding: 3px 10px;
      border-radius: 6px;
      letter-spacing: 0.04em;
    }

    .verdict-status-txt {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      color: #a1a1aa;
    }

    .verdict-tiles-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      text-align: center;
      font-family: 'JetBrains Mono', monospace;
    }

    .verdict-tile {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 6px;
      padding: 8px 6px;
    }

    .verdict-tile-num {
      font-size: 11pt;
      font-weight: 700;
      color: #38bdf8;
    }

    .verdict-tile-num.emerald {
      color: #34d399;
    }

    .verdict-tile-num.amber {
      color: #fbbf24;
    }

    .verdict-tile-lbl {
      font-size: 6.5pt;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 2px;
    }

    .cover-bottom-bar {
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.8pt;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Table of Contents Container */
    .toc-container {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 16px 0 24px 0;
      page-break-after: always;
      break-after: page;
    }

    .toc-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
    }

    .toc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
      font-size: 8.2pt;
    }

    .toc-item {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 1px dotted #cbd5e1;
      padding-bottom: 2px;
    }

    .toc-part-num {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #059669;
      margin-right: 6px;
    }

    .toc-part-title {
      font-weight: 600;
      color: #1e293b;
      flex-grow: 1;
    }

    /* Document Body Typography */
    h1 {
      font-size: 15pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin-top: 22px;
      margin-bottom: 10px;
      page-break-after: avoid;
      break-after: avoid;
      border-bottom: 2px solid #059669;
      padding-bottom: 4px;
    }

    h1.part-header {
      page-break-before: always;
      break-before: page;
      font-size: 17pt;
      margin-top: 0;
      padding-top: 4px;
      border-bottom: 2px solid #059669;
      color: #0f172a;
    }

    h2 {
      font-size: 11.5pt;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #1e293b;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
      break-after: avoid;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }

    h3 {
      font-size: 9.8pt;
      font-weight: 700;
      color: #334155;
      margin-top: 12px;
      margin-bottom: 6px;
      page-break-after: avoid;
      break-after: avoid;
    }

    h4 {
      font-size: 8.8pt;
      font-weight: 700;
      color: #475569;
      margin-top: 10px;
      margin-bottom: 4px;
      page-break-after: avoid;
      break-after: avoid;
    }

    p {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    /* Lists */
    ul, ol {
      margin: 0 0 10px 0;
      padding-left: 20px;
    }

    li {
      margin-bottom: 3px;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 14px 0;
      font-size: 7.2pt;
      page-break-inside: avoid;
      break-inside: avoid;
      table-layout: auto;
      word-break: break-word;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Code & Preformatted Blocks */
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.8pt;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1px 4px;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }

    pre {
      background: #0f172a;
      color: #f8fafc;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      line-height: 1.42;
      padding: 9px 12px;
      border-radius: 6px;
      border: 1px solid #1e293b;
      margin: 9px 0 12px 0;
      overflow-x: auto;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    pre code {
      background: transparent;
      color: #f8fafc;
      padding: 0;
      border: none;
      font-size: inherit;
    }

    /* GitHub-style Callout Alerts */
    .callout {
      border-left: 4px solid #0284c7;
      background: #f0f9ff;
      border-radius: 0 6px 6px 0;
      padding: 8px 12px;
      margin: 10px 0;
      font-size: 8.2pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .callout-title {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 7.2pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
    }

    .callout-note {
      border-left-color: #0284c7;
      background: #f0f9ff;
    }
    .callout-note .callout-title {
      color: #0369a1;
    }

    .callout-caution, .callout-warning {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }
    .callout-caution .callout-title, .callout-warning .callout-title {
      color: #b45309;
    }

    .callout-important {
      border-left-color: #8b5cf6;
      background: #f5f3ff;
    }
    .callout-important .callout-title {
      color: #6d28d9;
    }

    .callout-tip {
      border-left-color: #10b981;
      background: #ecfdf5;
    }
    .callout-tip .callout-title {
      color: #047857;
    }

    /* Speech / Script Blockquotes */
    blockquote {
      border-left: 3px solid #059669;
      background: #f8fafc;
      padding: 7px 12px;
      margin: 8px 0;
      font-style: italic;
      color: #334155;
      border-radius: 0 5px 5px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Mermaid Diagrams */
    .mermaid-container {
      display: flex;
      justify-content: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      margin: 12px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .mermaid svg {
      max-width: 100% !important;
      height: auto !important;
    }

    /* ASCII Diagrams & Box Styling */
    pre.ascii-box {
      background: #f8fafc;
      color: #1e293b;
      border: 1px solid #cbd5e1;
      font-weight: 500;
    }

    /* Horizontal Rules */
    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 14px 0;
    }

    /* Badges & Pills */
    .badge-verified {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.8pt;
      font-weight: 700;
      color: #047857;
      background: #d1fae5;
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid #a7f3d0;
    }

    .badge-core {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 6.8pt;
      font-weight: 600;
      color: #1e40af;
      background: #dbeafe;
      padding: 1px 5px;
      border-radius: 3px;
      border: 1px solid #bfdbfe;
    }
  </style>
</head>
<body>

<!-- Dedicated Executive Cover Page -->
<div class="cover-page">
  <div>
    <div class="cover-header-badge">
      <span class="dot"></span>
      Academic Capstone Evaluation &amp; Demonstration Manual
    </div>

    <div class="cover-title-group">
      <h1 class="cover-title">EcoWatt <span class="accent">Grid Guard</span></h1>
      <div class="cover-subtitle">
        Autonomous Edge IoT Demand Shaving, Closed-Loop Load Curtailment &amp; Microgrid Sustainability Architecture
      </div>
      <p class="cover-tagline">
        5th Semester IoT &amp; Sustainability Engineering Capstone Project — Final Audit, Verification &amp; Demonstration Guide
      </p>
    </div>

    <div class="cover-meta-grid">
      <div class="meta-item">
        <span class="meta-label">Project Title</span>
        <span class="meta-value">EcoWatt Grid Guard</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Academic Evaluation</span>
        <span class="meta-value">Semester 5 Capstone (IoT &amp; Sustainability)</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Software Model</span>
        <span class="meta-value">Software-in-the-Loop (SIL) + ESP32 Reference</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">System Version</span>
        <span class="meta-value mono">v1.0.0-rc3 (Production Prototype)</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Backend Architecture</span>
        <span class="meta-value mono">FastAPI 0.115, Python 3.12, CoAP UDP:5683, MQTT:1883</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Frontend Architecture</span>
        <span class="meta-value mono">React 19, TypeScript, Vite, Tailwind CSS, Recharts</span>
      </div>
    </div>

    <div class="cover-verdict-card">
      <div class="verdict-header">
        <span class="verdict-pill">VERDICT: READY FOR FINAL DEMONSTRATION</span>
        <span class="verdict-status-txt">100% Core Objectives Achieved</span>
      </div>
      <div class="verdict-tiles-row">
        <div class="verdict-tile">
          <div class="verdict-tile-num emerald">-23.0%</div>
          <div class="verdict-tile-lbl">Peak Shaving</div>
        </div>
        <div class="verdict-tile">
          <div class="verdict-tile-num emerald">0</div>
          <div class="verdict-tile-lbl">Critical Trips</div>
        </div>
        <div class="verdict-tile">
          <div class="verdict-tile-num">CoAP + MQTT</div>
          <div class="verdict-tile-lbl">Dual IoT Protocol</div>
        </div>
        <div class="verdict-tile">
          <div class="verdict-tile-num amber">55 / 56</div>
          <div class="verdict-tile-lbl">Tests Passing</div>
        </div>
      </div>
    </div>
  </div>

  <div class="cover-bottom-bar">
    <span>Autonomous Closed-Loop Energy Optimization</span>
    <span>November 2026 • Kushagra Garg</span>
  </div>
</div>

<!-- Table of Contents Page -->
<div class="toc-container">
  <div class="toc-title">
    <span>Document Contents &amp; Evaluation Guide</span>
    <span style="font-size: 8pt; font-weight: 500; color: #64748b;">EcoWatt Grid Guard</span>
  </div>
  <div class="toc-grid">
    <div class="toc-item">
      <span><span class="toc-part-num">00</span><span class="toc-part-title">Executive Summary &amp; Audit Verdict</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">01</span><span class="toc-part-title">Part 1: Complete Project Audit &amp; Architecture</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">02</span><span class="toc-part-title">Part 2: Project Completeness Verification (32 Areas)</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">03</span><span class="toc-part-title">Part 3: Performance &amp; Sustainability Results</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">04</span><span class="toc-part-title">Part 4: Startup &amp; Pre-Demonstration Checklist</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">05</span><span class="toc-part-title">Part 5: 12-Minute Live Demonstration Walkthrough</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">06</span><span class="toc-part-title">Part 6: Dashboard Views Walkthrough (8 Views)</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">07</span><span class="toc-part-title">Part 7: Demonstration Scenarios (10 Scenarios)</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">08</span><span class="toc-part-title">Part 8: Academic Defense &amp; Presentation Scripts</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">09</span><span class="toc-part-title">Part 9: Viva Voce Questions &amp; Answers (30+ Q&amp;As)</span></span>
    </div>
    <div class="toc-item">
      <span><span class="toc-part-num">10</span><span class="toc-part-title">Part 10: Final Project Completion Verdict</span></span>
    </div>
  </div>
</div>

<!-- Rendered Content will be dynamically inserted here -->
<div id="content"></div>

<script>
  const rawMarkdown = __RAW_MARKDOWN__;

  // Custom Marked Renderer
  const renderer = new marked.Renderer();

  // Strip initial redundant title / metadata since it's in the cover page
  function cleanMarkdown(md) {
    // Remove the very first H1 if it matches the project title
    let cleaned = md.replace(/^# EcoWatt Grid Guard[^\n]*\n+/i, '');
    // Remove top metadata code block
    cleaned = cleaned.replace(/^```[\s\S]*?```\n+/i, '');
    return cleaned;
  }

  // Handle Headings with Page Break on PARTs
  renderer.heading = function(token) {
    const text = typeof token === 'string' ? token : token.text;
    const depth = typeof token === 'object' && token.depth ? token.depth : arguments[1];
    
    if (depth === 1 && text.includes('PART ')) {
      return `<h1 class="part-header">${text}</h1>`;
    }
    return `<h${depth}>${text}</h${depth}>`;
  };

  // Handle Code Blocks & Mermaid
  renderer.code = function(token) {
    const code = typeof token === 'string' ? token : token.text;
    const lang = (typeof token === 'object' && token.lang ? token.lang : arguments[1]) || '';
    
    if (lang === 'mermaid') {
      return `<div class="mermaid-container"><div class="mermaid">${code}</div></div>`;
    }
    
    if (code.includes('===') || code.includes('+--') || code.includes('| STAGE')) {
      return `<pre class="ascii-box"><code>${code}</code></pre>`;
    }
    
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  };

  marked.setOptions({
    renderer: renderer,
    gfm: true,
    breaks: false
  });

  // Convert GitHub alerts > [!NOTE], > [!CAUTION], etc.
  function preprocessAlerts(md) {
    return md.replace(/<blockquote>\s*<p>\s*\[!(NOTE|CAUTION|WARNING|IMPORTANT|TIP)\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi, function(match, type, content) {
      const lowerType = type.toLowerCase();
      return `<div class="callout callout-${lowerType}">
        <div class="callout-title">${type}</div>
        <p>${content}</p>
      </div>`;
    });
  }

  function renderDocument() {
    const cleaned = cleanMarkdown(rawMarkdown);
    let html = marked.parse(cleaned);
    html = preprocessAlerts(html);
    
    // Inject into document
    document.getElementById('content').innerHTML = html;

    // Render Math via KaTeX Auto-Render
    renderMathInElement(document.getElementById('content'), {
      delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "$", right: "$", display: false}
      ],
      throwOnError: false
    });

    // Replace VERIFIED text with styled badge in tables
    document.querySelectorAll('td').forEach(td => {
      const txt = td.textContent.trim();
      if (txt === 'VERIFIED') {
        td.innerHTML = '<span class="badge-verified">VERIFIED</span>';
      } else if (txt === 'Core Requirement' || txt === 'Mandatory Safety Invariant') {
        td.innerHTML = `<span class="badge-core">${txt}</span>`;
      }
    });

    // Run Mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      fontFamily: 'Inter, sans-serif',
      fontSize: 9.5,
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
      }
    });

    return mermaid.run({
      querySelector: '.mermaid'
    });
  }

  window.renderReady = renderDocument();
</script>

</body>
</html>
"""

async def generate_pdf():
    print(f"[1/4] Reading source markdown: {DOC_PATH}")
    if not DOC_PATH.exists():
        print(f"Error: {DOC_PATH} does not exist.")
        sys.exit(1)

    with open(DOC_PATH, "r", encoding="utf-8") as f:
        raw_markdown = f.read()

    print(f"[2/4] Generating intermediate HTML template...")
    # Safe JSON string embedding
    json_md = json.dumps(raw_markdown)
    final_html = HTML_TEMPLATE.replace("__RAW_MARKDOWN__", json_md)

    with open(HTML_TEMP_PATH, "w", encoding="utf-8") as f:
        f.write(final_html)

    print(f"[3/4] Launching Playwright Chromium renderer...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=["--font-render-hinting=medium", "--enable-font-antialiasing"]
        )
        context = await browser.new_context(
            viewport={"width": 1200, "height": 1600},
            device_scale_factor=2
        )
        page = await context.new_page()

        # Load temporary HTML file via local file URI
        file_url = HTML_TEMP_PATH.as_uri()
        await page.goto(file_url, wait_until="networkidle")

        # Wait for Mermaid and KaTeX rendering to complete
        await page.wait_for_function("window.renderReady !== undefined")
        # Give Mermaid SVGs an extra second to compute accurate bounding boxes
        await page.wait_for_timeout(2000)

        print(f"[4/4] Printing to PDF: {PDF_PATH}")
        header_template = """
        <div style="font-size: 7pt; font-family: 'Inter', sans-serif; color: #94a3b8; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 3px;">
          <span style="font-weight: 600; color: #64748b;">EcoWatt Grid Guard — Final Project &amp; Demonstration Guide</span>
          <span>IoT &amp; Sustainability Engineering</span>
        </div>
        """

        footer_template = """
        <div style="font-size: 7pt; font-family: 'Inter', sans-serif; color: #94a3b8; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 3px; margin-top: 3px;">
          <span>Autonomous Edge IoT Demand Shaving</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
        """

        await page.pdf(
            path=str(PDF_PATH),
            format="A4",
            print_background=True,
            display_header_footer=True,
            header_template=header_template,
            footer_template=footer_template,
            margin={
                "top": "16mm",
                "bottom": "16mm",
                "left": "12mm",
                "right": "12mm",
            },
            prefer_css_page_size=True,
        )

        await browser.close()

    # Clean up temporary HTML file
    if HTML_TEMP_PATH.exists():
        HTML_TEMP_PATH.unlink()

    pdf_size_kb = round(os.path.getsize(PDF_PATH) / 1024, 1)
    print(f"\nSUCCESS: Publication-grade PDF generated successfully!")
    print(f"Path: {PDF_PATH}")
    print(f"Size: {pdf_size_kb} KB")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
