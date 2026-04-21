#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    throw new Error(`Command failed: ${cmd}`);
  }
}

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  // 1. Verify working directory is clean
  const status = execSync('git status -s', { encoding: 'utf-8' }).trim();
  if (status) {
    console.error('❌ Working directory not clean — commit or stash your changes first');
    process.exit(1);
  }

  // 2. Verify we are on main
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  if (currentBranch !== 'main') {
    console.error(`❌ Must be on main branch (currently on '${currentBranch}')`);
    process.exit(1);
  }

  // 3. Pull latest changes
  console.log('⬇️  Pulling latest changes from origin/main...');
  run('git pull');

  // 4. Prompt for new version
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
  const currentVersion = pkg.version;

  const newVersion = await ask(`Current version: ${currentVersion}. Enter new version: `);

  if (!/^\d+\.\d+\.\d+$/.test(newVersion.trim())) {
    console.error('❌ Invalid format — use MAJOR.MINOR.PATCH (e.g. 1.2.0)');
    rl.close();
    process.exit(1);
  }

  const version = newVersion.trim();
  const releaseBranch = `release/v${version}`;

  try {
    // 5. Create and checkout release branch
    run(`git checkout -b ${releaseBranch}`);

    // 6. Bump version, commit, and tag on the release branch
    pkg.version = version;
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
    run('npm install');
    run('npm run build');
    run('git add package.json package-lock.json');
    run(`git commit -m "Bump release version to ${version}"`);
    run(`git tag -a v${version} -m "Release version ${version}"`);

    // 7. Push release branch
    run(`git push origin ${releaseBranch}`);

    console.log(`\n✅ Release branch '${releaseBranch}' pushed.`);
    console.log('\nNext steps:');
    console.log(`  1. Create a PR from '${releaseBranch}' → 'main' and merge it.`);
    console.log('  2. Come back here and press Enter to push the tag and trigger the release pipeline.');

    await ask('\nPress Enter once the PR is merged...');

    // 8. Pull merged main and push tag to trigger release pipeline
    run('git checkout main');
    run('git pull');
    run(`git push origin v${version}`);

    console.log(`\n✅ Tag v${version} pushed — release pipeline triggered!`);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }

  rl.close();
}

main();
