// meeting-digest/worker/src/lib/topics.js

export const TOPICS = Object.freeze([
  { slug: 'override',            label: 'Override / Prop 2½',     subscribable: true  },
  { slug: 'school-budget',       label: 'School budget',           subscribable: true  },
  { slug: 'bonding-capital',     label: 'Bonding & capital',       subscribable: true  },
  { slug: 'permits-zoning',      label: 'Permits & zoning',        subscribable: true  },
  { slug: 'trash-dpw',           label: 'Trash / DPW',             subscribable: true  },
  { slug: 'health-insurance',    label: 'Health insurance / GIC',  subscribable: true  },
  { slug: 'labor-personnel',     label: 'Labor & personnel',       subscribable: true  },
  { slug: 'public-safety',       label: 'Public safety',           subscribable: true  },
  { slug: '40b-mbta',            label: '40B / MBTA Communities',  subscribable: true  },
  { slug: 'elections-procedural', label: 'Elections / procedural', subscribable: true  },
  { slug: 'recreation-events',   label: 'Recreation & events',     subscribable: true  },
  { slug: 'admin-housekeeping',  label: 'Admin and housekeeping',  subscribable: false },
  { slug: 'public-comment',      label: 'Public comment',          subscribable: false }
]);

export const SUBSCRIBABLE_TOPICS = TOPICS.filter(t => t.subscribable);

export const BOARDS = Object.freeze([
  { slug: 'select-board',     label: 'Select Board',     volume: '24 meetings/year'    },
  { slug: 'school-committee', label: 'School Committee', volume: '~22 meetings/year'   },
  { slug: 'finance-committee',label: 'Finance Committee',volume: '~16 meetings/year'   },
  { slug: 'board-of-health',  label: 'Board of Health',  volume: '~30 meetings/year'   },
  { slug: 'town-meeting',     label: 'Town Meeting',     volume: '2-3 meetings/year'   }
]);

export const DEFAULT_BOARDS_ON_SIGNUP = ['select-board', 'school-committee', 'finance-committee'];

const TOPIC_SLUGS = new Set(TOPICS.map(t => t.slug));
const BOARD_SLUGS = new Set(BOARDS.map(b => b.slug));

export function isKnownTopic(slug) {
  return typeof slug === 'string' && TOPIC_SLUGS.has(slug);
}

export function isKnownBoard(slug) {
  return typeof slug === 'string' && BOARD_SLUGS.has(slug);
}
