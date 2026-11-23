const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const bytenode = require('bytenode');
const obfuscator = require('javascript-obfuscator');

const serverSrc = path.join(__dirname, '../../erp-mern-server-v3/src');
const serverDest = path.join(__dirname, '../server');
const bundlePath = path.join(serverDest, 'server.bundle.js');
const jscPath = path.join(serverDest, 'server.bundle.jsc');
const loaderPath = path.join(serverDest, 'index.js');

// Ensure destination exists
if (!fs.existsSync(serverDest)) {
  fs.mkdirSync(serverDest, { recursive: true });
}

console.log('=== Step A: Bundling ES Server into Single CommonJS Bundle with esbuild ===');
const entryFile = path.join(serverSrc, 'index.js');
execSync(`npx esbuild "${entryFile}" --bundle --platform=node --target=node20 --format=cjs --outfile="${bundlePath}" --packages=external --banner:js="var __meta_url = typeof __filename !== 'undefined' ? require('url').pathToFileURL(__filename).href : '';" --define:import.meta.url=__meta_url`, {
  stdio: 'inherit'
});

console.log('=== Step B: Obfuscating Server Bundle ===');
const bundleCode = fs.readFileSync(bundlePath, 'utf8');
const obfuscatedCode = obfuscator.obfuscate(bundleCode, {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8
}).getObfuscatedCode();
fs.writeFileSync(bundlePath, obfuscatedCode);

console.log('=== Step C: Compiling Obfuscated Bundle to V8 Bytecode (.jsc) ===');
bytenode.compileFile({
  filename: bundlePath,
  output: jscPath
});

// Remove plain JS bundle completely
fs.unlinkSync(bundlePath);

console.log('=== Step D: Creating Protected Loader Entry ===');
fs.writeFileSync(loaderPath, `require('bytenode');\nrequire('./server.bundle.jsc');\n`);

// Clean up source folders so no original code remains
const cleanupFolders = ['controllers', 'models', 'routes', 'middleware', 'services', 'utils', 'config', 'scripts', 'tests', 'logs', 'uploads'];
cleanupFolders.forEach(folder => {
  const p = path.join(serverDest, folder);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
});
const cleanupFiles = ['app.js', 'socket.js'];
cleanupFiles.forEach(file => {
  const p = path.join(serverDest, file);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
  }
});

console.log('=== Step E: Syncing Production node_modules ===');
const serverNodeModules = path.join(__dirname, '../../erp-mern-server-v3/node_modules');
const destNodeModules = path.join(serverDest, 'node_modules');

try {
  execSync(`robocopy "${serverNodeModules}" "${destNodeModules}" /E /MT:16 /NFL /NDL /NJH /NJS /nc /ns /np`, { stdio: 'inherit' });
} catch (err) {
  if (err.status && err.status < 8) {
    console.log('node_modules synced successfully.');
  } else {
    console.error('Robocopy notice:', err.message);
  }
}

console.log('✅ Server compilation & bytecode encryption complete!');
process.exit(0);
