import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'widget',
          include: ['tests/slug.test.js', 'tests/store.test.js', 'tests/api.test.js', 'tests/issue-url.test.js', 'tests/match.test.js', 'tests/jwt.test.js', 'tests/fb.test.js', 'tests/claim.test.js', 'tests/profile.test.js', 'tests/vouch.test.js', 'tests/warrant-lib.test.js', 'tests/warrant-sync.test.js'],
          environment: 'node',
          setupFiles: ['./tests/setup-widget.js']
        }
      },
      {
        extends: true,
        test: {
          name: 'worker',
          include: ['tests/worker.test.js', 'tests/engagement.test.js', 'tests/api-v1.test.js'],
          poolOptions: {
            workers: {
              singleWorker: true,
              wrangler: { configPath: './worker/wrangler.toml' }
            }
          }
        }
      }
    ]
  }
});
