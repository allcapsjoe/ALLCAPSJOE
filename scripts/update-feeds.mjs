/**
 * Fetches all feed sources and rewrites their marker blocks in README.md.
 *
 * Feeds:
 *   READING — blog.allcapsjoe.com/feed/atom.xml        (5 entries)
 *   TOOLS   — tools.allcapsjoe.com/feed.xml            (3 entries)
 *   GAMES   — games.allcapsjoe.com/feed.xml            (3 entries)
 *   SITES   — sites.allcapsjoe.com/feed.xml            (3 entries)
 *
 * Usage: node scripts/update-feeds.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { get } from 'https';

const README = './README.md';

const FEEDS = [
  { url: 'https://blog.allcapsjoe.com/feed/atom.xml',  marker: 'READING', count: 5 },
  { url: 'https://tools.allcapsjoe.com/feed.xml',      marker: 'TOOLS',   count: 3 },
  { url: 'https://games.allcapsjoe.com/feed.xml',      marker: 'GAMES',   count: 3 },
  { url: 'https://sites.allcapsjoe.com/feed.xml',      marker: 'SITES',   count: 3 },
];

function fetch(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parse(xml, count) {
  const entries = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m;

  while ((m = re.exec(xml)) !== null && entries.length < count) {
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

function replaceBlock(readme, marker, content) {
  const start = `<!-- ${marker}_START -->`;
  const end   = `<!-- ${marker}_END -->`;
  const block = `${start}\n${content}\n${end}`;
  const re    = new RegExp(`${start}[\\s\\S]*?${end}`);

  if (!re.test(readme)) {
    throw new Error(`Marker block ${marker} not found in README.md`);
  }

  return readme.replace(re, block);
}

async function run() {
  let readme = readFileSync(README, 'utf-8');
  let changed = false;

  for (const { url, marker, count } of FEEDS) {
    let xml;
    try {
      xml = await fetch(url);
    } catch (err) {
      console.warn(`[${marker}] fetch failed: ${err.message} — skipping`);
      continue;
    }

    const entries = parse(xml, count);
    if (!entries.length) {
      console.warn(`[${marker}] no entries parsed from ${url} — skipping`);
      continue;
    }

    try {
      const updated = replaceBlock(readme, marker, format(entries));
      if (updated !== readme) {
        readme = updated;
        changed = true;
        console.log(`[${marker}] updated (${entries.length} entries)`);
      } else {
        console.log(`[${marker}] no change`);
      }
    } catch (err) {
      console.warn(`[${marker}] ${err.message} — skipping`);
    }
  }

  if (changed) {
    writeFileSync(README, readme);
    console.log('README.md written.');
  } else {
    console.log('No changes to README.md.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
