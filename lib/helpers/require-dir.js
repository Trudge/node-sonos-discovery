"use strict";
const fs = require("fs");
const path = require("path");
function requireDir(cwd, cb) {
    const files = fs.readdirSync(cwd);
    files.map((name) => {
        const fullPath = path.join(cwd, name);
        return { name, fullPath, stat: fs.statSync(fullPath) };
    }).filter((file) => {
        return !file.stat.isDirectory()
            && !file.name.startsWith('.')
            && (file.name.endsWith('.js') || (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')));
    }).forEach((file) => {
        const loaded = require(file.fullPath);
        if (typeof cb === 'function') {
            cb(loaded);
        }
    });
}
module.exports = requireDir;
