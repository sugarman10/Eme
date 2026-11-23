const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const desktopAppDir = path.join(__dirname, '..');
const clientBuildDir = path.join(desktopAppDir, '../erp-mern-client-v3-full/dist');
const clientDestDir = path.join(desktopAppDir, 'client');
const serverDestDir = path.join(desktopAppDir, 'server');

function runCommand(command, cwd, extraEnv = {}) {
  console.log(`\n> Running: ${command} in ${cwd || 'current directory'}`);
  try {
    execSync(command, { 
      stdio: 'inherit', 
      cwd,
      env: { ...process.env, ...extraEnv }
    });
  } catch (err) {
    console.error(`\n❌ Command failed: ${command}`);
    process.exit(1);
  }
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('=== Step 1: Cleaning previous builds ===');
cleanDir(clientDestDir);
cleanDir(serverDestDir);

console.log('\n=== Step 2: Building React Client ===');
runCommand('npm run build', path.join(desktopAppDir, '../erp-mern-client-v3-full'));

console.log('\n=== Step 3: Copying Client to Desktop App ===');
if (!fs.existsSync(clientBuildDir)) {
  console.error('Client build directory not found! Ensure the build was successful.');
  process.exit(1);
}
copyDir(clientBuildDir, clientDestDir);

console.log('\n=== Step 4: Compiling Backend Server to Bytecode (Electron Node v20) ===');
runCommand('npm run compile:bytecode', desktopAppDir, { ELECTRON_RUN_AS_NODE: '1' });

console.log('\n=== Step 5: Packaging Electron Application ===');
const targetArg = process.argv.slice(2).join(' ') || '';
const distCmd = targetArg ? `npx electron-builder ${targetArg}` : 'npm run dist';
runCommand(distCmd, desktopAppDir);

console.log('\n✅ Desktop Application Build Complete!');
