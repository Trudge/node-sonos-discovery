import fs = require('fs');
import path = require('path');

type Register = (module: any) => void;

function requireDir(this: any, cwd: string, cb?: Register): void {
  const files = fs.readdirSync(cwd);

  files.map((name: any) => {
    const fullPath = path.join(cwd, name);
    return { name, fullPath, stat: fs.statSync(fullPath) };
  }).filter((file: any) => {
    return !file.stat.isDirectory()
      && !file.name.startsWith('.')
      && (file.name.endsWith('.js') || (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')));
  }).forEach((file: any) => {
    const loaded = require(file.fullPath);
    if (typeof cb === 'function') {
      cb(loaded);
    }
  });
}

export = requireDir;
