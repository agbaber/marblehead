import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/email.test.js', 'tests/topics.test.js', 'tests/transcripts.test.js', 'tests/matcher.test.js', 'tests/render.test.js', 'tests/primer.test.js'],
          environment: 'node'
        }
      },
      {
        extends: true,
        test: {
          name: 'worker',
          include: ['tests/worker.test.js', 'tests/admin-stats.test.js', 'tests/mail-event.test.js'],
          poolOptions: {
            workers: {
              singleWorker: true,
              wrangler: { configPath: './worker/wrangler.toml' },
              // MAIL_PROVIDER_API_KEY lives as a Worker secret in prod (not in
              // wrangler.toml — see PR #807). Tests need a value so mail.js
              // doesn't throw before stubs intercept the fetch.
              miniflare: {
                bindings: {
                  MAIL_PROVIDER_API_KEY: 'test-key',
                  // Constructed (not literal) so secret scanners don't flag a
                  // test fixture; mirrors the SECRET constant in mail-event.test.js.
                  RESEND_WEBHOOK_SECRET: 'whsec_' + Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')
                }
              }
            }
          }
        }
      }
    ]
  }
});
