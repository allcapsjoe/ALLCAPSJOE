/**
 * Fetches the latest entries from blog.allcapsjoe.com/feed/atom.xml
 * and rewrites the READING_START / READING_END block in README.md.
 *
 * Usage: node scripts/update-reading-log.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { get } from 'https';

const FEED_URL  = 'https://blog.allcapsjoe.com/feed/atom.xml';
const README    = './README.md';
const COUNT     = 5;

function fetch(url) {
  return new Promise((resolve, reject) => {
    get(url, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parse(xml) {
  const entries = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m;

  while ((m = re.exec(xml)) !== null && entries.length < COUNT) {
    const block = m[1];
    const title     = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim();
    const link      = block.match(/<link[^>]*href="([^"]+)"/)?.[1]?.trim();
    const published = block.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim();

    if (title && link && published) {
      const date = new Date(published).toISOString().split('T')[0];
      entries.push({ title, link, date });
    }
  }

  return entries;
}

function format(entries) {
  return entries
    .map(({ title, link, date }) => `- [${title}](${link}) \`${date}\``)
    .join('\n');
}

async function run() {
  const xml     = await fetch(FEED_URL);
  const entries = parse(xml);

  if (!entries.length) {
    console.error('No entries parsed from feed.');
    process.exit(1);
  }

  const readme  = readFileSync(README, 'utf-8');
  const block   = `<!-- READING_START -->\n${format(entries)}\n<!-- READING_END -->`;
  const updated = readme.replace(/<!-- READING_START -->[\s\S]*?<!-- READING_END -->/, block);

  if (updated === readme) {
    console.error('Marker block not found in README.md — nothing written.');
    process.exit(1);
  }

  writeFileSync(README, updated);
  console.log(`Updated README.md with ${entries.length} entries.`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
