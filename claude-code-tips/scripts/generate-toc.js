#!/usr/bin/env node
/**
 * Generate table of contents for README.md
 * Extracts all "## Tip N: Title" headers and creates anchor links
 * Automatically updates README.md between <!-- TOC --> markers
 */

const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '..', 'README.md');
const TOC_START = '<!-- TOC -->';
const TOC_END = '<!-- /TOC -->';

function main() {
  if (!fs.existsSync(readmePath)) {
    console.error('Error: README.md not found');
    process.exit(1);
  }

  const content = fs.readFileSync(readmePath, 'utf8');
  const lines = content.split('\n');

  // Match "## Tip N: Title" pattern and other "## Section" headers
  const tipRegex = /^## (Tip \d+: .+)$/;
  const sectionRegex = /^## (.+)$/;
  const tips = [];
  const sections = [];
  const skipSections = ['Table of Contents']; // Sections to exclude from TOC

  for (const line of lines) {
    const tipMatch = line.match(tipRegex);
    if (tipMatch) {
      const title = tipMatch[1];
      const anchor = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      tips.push({ title, anchor });
    } else {
      const sectionMatch = line.match(sectionRegex);
      if (sectionMatch && !skipSections.includes(sectionMatch[1]) && !sectionMatch[1].startsWith('Tip ')) {
        const title = sectionMatch[1];
        const anchor = title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        sections.push({ title, anchor });
      }
    }
  }

  if (tips.length === 0) {
    console.error('No tips found in README.md');
    process.exit(1);
  }

  // Build TOC - tips first, then other sections
  let toc = '## Table of Contents\n\n';
  for (const tip of tips) {
    toc += `- [${tip.title}](#${tip.anchor})\n`;
  }
  for (const section of sections) {
    toc += `- [${section.title}](#${section.anchor})\n`;
  }

  // Check for markers
  const startIdx = content.indexOf(TOC_START);
  const endIdx = content.indexOf(TOC_END);

  if (startIdx === -1 || endIdx === -1) {
    console.log('No TOC markers found. Add these to README.md where you want the TOC:');
    console.log('  <!-- TOC -->');
    console.log('  <!-- /TOC -->');
    console.log('\nGenerated TOC:\n');
    console.log(toc);
    process.exit(0);
  }

  // Replace content between markers
  const before = content.slice(0, startIdx + TOC_START.length);
  const after = content.slice(endIdx);
  const newContent = before + '\n' + toc + '\n' + after;

  if (newContent === content) {
    console.log(`TOC is up to date (${tips.length} tips)`);
    process.exit(0);
  }

  fs.writeFileSync(readmePath, newContent);
  console.log(`Updated TOC with ${tips.length} tips`);
}

main();
