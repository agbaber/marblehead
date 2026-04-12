import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'widget',
          include: ['tests/slug.test.js', 'tests/store.test.js', 'tests/api.test.js', 'tests/issue-url.test.js'],
          environment: 'node',
          setupFiles: ['./tests/setup-widget.js']
        }
      },
      {
        extends: true,
        test: {
          name: 'worker',
          include: ['tests/worker.test.js'],
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
