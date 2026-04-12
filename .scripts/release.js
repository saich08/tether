#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    throw new Error(`Command failed: ${cmd}`);
  }
}

// Check git status
const status = execSync('git status -s', { encoding: 'utf-8' }).trim();
if (status) {
  console.error('❌ Working directory not clean');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const currentVersion = pkg.version;

rl.question(`Current version: ${currentVersion}. Enter new version: `, (newVersion) => {
  rl.close();

  // Validate
  if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('❌ Invalid format (use MAJOR.MINOR.PATCH)');
    process.exit(1);
  }

  try {
    // Update version
    pkg.version = newVersion;
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');

    // Commit and tag
    run('git add package.json package-lock.json');
    run(`git commit -m "chore: bump version to ${newVersion}"`);
    run(`git tag -a v${newVersion} -m "Release version ${newVersion}"`);

    console.log('\n✅ Ready to release!\n');
    console.log('Complete with:');
    console.log('  git push origin main');
    console.log(`  git push origin v${newVersion}`);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
});
