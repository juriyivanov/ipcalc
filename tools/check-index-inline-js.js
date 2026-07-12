const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((match) => !/\bsrc=/i.test(match[1]) && !/type=["']application\/json["']/i.test(match[1]))
  .map((match) => match[2].trim())
  .filter(Boolean);

scripts.forEach((script, index) => new vm.Script(script, { filename: `index-inline-${index + 1}.js` }));
console.log(scripts.length ? `Checked ${scripts.length} inline script(s) from index.html` : 'No executable inline scripts in index.html');
