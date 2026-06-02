/**
 * Build the Jekyll site, serve _site/, run Playwright smoke tests, tear down.
 *
 *   npm run test:local
 *
 * Requires `bundle install` to have been run once (see Gemfile).
 */
import { spawn, spawnSync } from 'node:child_process';
import waitOn from 'wait-on';

const PORT = process.env.PORT || '4000';
const URL = `http://localhost:${PORT}`;

console.log('Building site with Jekyll...');
const build = spawnSync('bundle', ['exec', 'jekyll', 'build'], { stdio: 'inherit' });
if (build.status !== 0) {
  console.error('Jekyll build failed.');
  process.exit(build.status ?? 1);
}

const server = spawn(
  'npx',
  ['--no-install', 'serve', '_site', '-p', PORT, '--no-clipboard', '--no-port-switching'],
  { stdio: ['ignore', 'inherit', 'inherit'] },
);

let exitCode = 1;
try {
  await waitOn({ resources: [URL], timeout: 15000, interval: 200 });
  const test = spawn('node', ['tests/smoke-test.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, SITE: URL },
  });
  exitCode = await new Promise(resolve => test.on('exit', code => resolve(code ?? 1)));
} catch (err) {
  console.error('Local server failed to come up:', err.message);
} finally {
  server.kill('SIGTERM');
  process.exit(exitCode);
}
