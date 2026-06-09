import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/email.test.js', 'tests/topics.test.js', 'tests/transcripts.test.js', 'tests/matcher.test.js', 'tests/render.test.js'],
          environment: 'node'
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
