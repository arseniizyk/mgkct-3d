#!/usr/bin/env node
/**
 * check_syntax.js
 *
 * Authoritative V8 JavaScript syntax, lexical, and cross-script scope collision check.
 * Verifies that all JS code passes V8 compilation both individually AND combined
 * in sequential browser load order without identifier collisions.
 *
 * Usage:
 *   node tests/check_syntax.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_DIRS = ['js', 'tests', 'node_editor', '.agents'];
const EXCLUDE_PATHS = [
    path.join('js', 'vendor'),
    'node_modules',
    '.git'
];

function getJsFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(ROOT_DIR, fullPath);

        if (EXCLUDE_PATHS.some(ex => relPath.startsWith(ex) || relPath === ex)) {
            continue;
        }

        if (entry.isDirectory()) {
            files = files.concat(getJsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

let allFiles = [];
for (const dirName of SCAN_DIRS) {
    allFiles = allFiles.concat(getJsFiles(path.join(ROOT_DIR, dirName)));
}

console.log(`Checking individual JavaScript syntax across ${allFiles.length} files...`);

let hasError = false;
let passedCount = 0;

for (const filePath of allFiles) {
    const relPath = path.relative(ROOT_DIR, filePath);
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        new vm.Script(code, { filename: relPath });
        passedCount++;
    } catch (err) {
        console.error(`\x1b[31m[SYNTAX ERROR]\x1b[0m ${relPath}`);
        console.error(`  ${err.message}`);
        if (err.stack) {
            console.error(`  ${err.stack.split('\n').slice(0, 3).join('\n  ')}`);
        }
        hasError = true;
    }
}

// -----------------------------------------------------------------------------
// Cross-script Shared Scope V8 Compilation Check
// Extracts index.html script tags and compiles them as a combined global script
// to ensure no global const / let collisions exist between separate files.
// -----------------------------------------------------------------------------
console.log('Checking cross-script identifier collisions across index.html script chain...');
try {
    const htmlContent = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    const scriptRegex = /<script\s+src=["']([^"']+)["']/g;
    const projectScripts = [];
    let match;
    while ((match = scriptRegex.exec(htmlContent)) !== null) {
        const src = match[1].split('?')[0];
        if (!src.startsWith('http') && !src.includes('vendor') && src.endsWith('.js')) {
            projectScripts.push(src);
        }
    }

    const combinedCode = projectScripts
        .map(src => fs.readFileSync(path.join(ROOT_DIR, src), 'utf8'))
        .join('\n;\n');

    new vm.Script(combinedCode, { filename: 'combined_index_scripts.js' });
    console.log(`\x1b[32mPASSED: All ${projectScripts.length} application scripts compile together in a single V8 global scope without identifier collisions.\x1b[0m`);
} catch (err) {
    console.error(`\x1b[31m[CROSS-SCRIPT COLLISION ERROR]\x1b[0m ${err.message}`);
    hasError = true;
}

if (hasError) {
    console.error(`\n\x1b[31mFAILED: Syntax errors or collisions encountered.\x1b[0m`);
    process.exit(1);
} else {
    console.log(`\x1b[32mALL CHECKS PASSED: Individual and cross-script V8 compilation successful.\x1b[0m`);
    process.exit(0);
}
