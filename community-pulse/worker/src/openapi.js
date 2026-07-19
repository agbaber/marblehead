// OpenAPI 3.1 description of the public read API. Served at
// /api/v1/openapi.json. Extend alongside api_v1.js when routes change.

const instanceSchema = {
  type: 'object',
  properties: {
    meeting_year: { type: 'integer' },
    meeting_type: { type: 'string', enum: ['annual', 'special'] },
    meeting_date: { type: 'string' },
    article_number: { type: 'integer' },
    title: { type: 'string' },
    tm_result: {
      type: ['string', 'null'],
      enum: ['adopted', 'defeated', 'indefinitely_postponed', 'withdrawn', 'not_taken_up', null],
    },
    tm_vote_yes: { type: ['integer', 'null'] },
    tm_vote_no: { type: ['integer', 'null'] },
    in_effect: { type: ['integer', 'null'], description: 'null means same as adoption; 0 means adopted but later overturned' },
    notes: { type: ['string', 'null'] },
    source_doc: { type: ['string', 'null'] },
    source_url: { type: ['string', 'null'] },
  },
};

export const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'Marblehead warrant corpus API',
    version: '1.0.0',
    description: 'Read-only public data: Town Meeting warrant article series and per-year instances with dispositions. Every row traces to a primary source document.',
  },
  paths: {
    '/api/v1/': { get: { summary: 'Endpoint index' } },
    '/api/v1/series': {
      get: {
        summary: 'List article series',
        parameters: [{
          name: 'kind', in: 'query', required: false,
          schema: { type: 'string', enum: ['budget_line', 'money_article', 'other_article', 'consent'] },
        }],
      },
    },
    '/api/v1/series/{slug}': {
      get: {
        summary: 'One series with all its instances, oldest first',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Series detail',
            content: { 'application/json': { schema: {
              type: 'object',
              properties: {
                slug: { type: 'string' },
                title: { type: 'string' },
                kind: { type: 'string' },
                first_year: { type: 'integer' },
                last_year: { type: 'integer' },
                notes: { type: ['string', 'null'] },
                instances: { type: 'array', items: instanceSchema },
              },
            } } },
          },
        },
      },
    },
    '/api/v1/meetings/{year}': {
      get: {
        summary: 'Every article acted on (or passed over) in a meeting year',
        parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer' } }],
      },
    },
    '/api/v1/openapi.json': { get: { summary: 'This document' } },
  },
};
