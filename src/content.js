/* ==========================================================================
   content.js — every word and number on the site, in one place.

   Everything in here is PLACEHOLDER copy written for the layout. Replace it
   with your own: name, role, city, coordinates, the case-file narrative,
   projects and the HUD log. Nothing else in the codebase hard-codes text.
   ========================================================================== */

export const OWNER = {
  name: 'DEAN',
  role: 'DIGITAL DESIGNER',
  disciplines: ['ART DIRECTION', 'ANIMATION', 'CREATIVE DEVELOPMENT'],
  city: 'JAKARTA, ID',
  lat: '06.2088° S',
  long: '106.8456° E',
  gmt: 'GMT+7',
  contactLabel: "DON'T CONTACT ME",
  contactHref: 'mailto:hello@example.com',
  linkedin: 'https://www.linkedin.com/',
  listening: 'NOW PLAYING: [SONG] — [ARTIST]',
  year: new Date().getFullYear(),
};

export const ROLES = ['VISIONARY', 'UI/UX DESIGNER', 'CONCEPTUALIST', 'ART DIRECTION', 'MOTION', 'PHOTOGRAPHY'];

export const STATUS = ['TARGET ACQUIRED', 'SUBJECT IS AWARE', 'DO NOT ENGAGE', 'SIGNAL UNSTABLE', 'KEEP DISTANCE'];

/* The HUD's error log (top right). Lines are assembled from these pieces by
   home/syslog.js – a message, a hex address and a state per line, chosen from
   the line's own number – so the log never repeats a block as it scrolls. */
export const SYSLOG = {
  messages: [
    'SEGMENTATION FAULT', 'NULL POINTER DEREF', 'STACK OVERFLOW', 'HEAP EXHAUSTED',
    'ACCESS VIOLATION', 'CHECKSUM MISMATCH', 'KERNEL PANIC', 'UNHANDLED EXCEPTION',
    'BUFFER OVERRUN', 'SIGNAL LOST', 'HANDSHAKE TIMEOUT', 'CORRUPT SECTOR',
    'PERMISSION DENIED', 'WATCHDOG RESET', 'IDENTITY NOT FOUND', 'SUBJECT UNRESOLVED',
    'TRACE ROUTE BROKEN', 'DECRYPTION FAILED', 'FRAME DROPPED', 'DEADLOCK DETECTED',
    'RACE CONDITION', 'CORE DUMPED', 'CLOCK DRIFT', 'MIRROR DESYNC',
    'FACE MATCH 0.00%', 'MEMORY NOT RELEASED', 'OBSERVER DETECTED', 'FILE 0039 LOCKED',
    'UNKNOWN OPCODE', 'BAD SECTOR READ', 'INTEGRITY CHECK FAILED', 'ROOT ACCESS REVOKED',
  ],
  states: ['FAIL', 'FATAL', 'WARN', 'DENIED', 'RETRY', 'NULL', 'ABORT', '???'],
  headers: ['> CORE DUMP', '> TRACE', '> SYS.LOG', '> STACK'],
};

export const CASE_TITLE = 'CASE FILE: THE ONE WHO KEPT LOOKING';

/* ~60 short lines, third person, noir. The site splits them into two columns. */
export const CASE_LINES = [
  'Nobody remembers the first frame.',
  'They only remember the one that refused to leave.',
  'The subject made frames like that for a living.',
  'Interfaces. Systems. Motion. Images.',
  'Different rooms in the same building.',
  'He walked through all of them with the lights off.',
  'Not because he liked the dark.',
  'Because the dark shows you the edges.',
  'Every brief arrived with a safe answer attached.',
  'He read it once and put it face down.',
  'The safe answer had been printed a thousand times.',
  'He was looking for the one that had not.',
  'Witnesses describe him as quiet.',
  'Polite. Slightly too interested in fonts.',
  'He would stop in the middle of a sentence',
  'to watch a shadow cross a wall.',
  'Then finish the sentence as if nothing happened.',
  'Something always happened.',
  'A transition that took one frame too long, on purpose.',
  'A typeface nobody approved.',
  'A grid that broke exactly once.',
  'Clients asked why.',
  'He asked them how it felt.',
  'They usually stopped asking why.',
  'He carried a camera the way others carry keys.',
  'Streets after midnight. Kitchens at the wrong hour.',
  'Reflections that should not have been there.',
  'He did not document them.',
  'He interrupted them.',
  'The ordinary was where things hid best.',
  'So that is where he kept looking.',
  'Design. Photography. Image. Interface.',
  'Four names for one habit.',
  'Find the tension.',
  'Pull it tight.',
  'Know when to let go.',
  'He did not trust things that almost worked.',
  'Almost good. Almost new. Almost honest.',
  'Those were the dangerous ones.',
  'They survive because nobody can explain killing them.',
  'He could.',
  'Usually before lunch.',
  'There was no manifesto.',
  'No mythology. No grand plan on the wall.',
  'Just a stubborn amount of curiosity',
  'and a refusal to leave things alone.',
  'Why one frame breathes and its twin does not.',
  'Why one word looks right and another looks like it is lying.',
  'He kept asking.',
  'Then he kept making.',
  'That was the part people underestimated.',
  'Most stop at the question.',
  'He turned questions into screens,',
  'systems, photographs, small disturbances.',
  'Sometimes a problem. Sometimes the fix.',
  'Occasionally both, on the same afternoon.',
  'The file stays open.',
  'The subject is still out there,',
  'making ordinary things impossible to ignore.',
  'If you see him, do not make eye contact.',
];

export const BLOCK2 = {
  numeral: '0039',
  words: ['BOLD', 'DISTINCTIVE', 'FUNCTIONAL', 'CLEVER', 'UNEXPECTED', 'CHARACTERFUL', 'EXPERIMENTAL', 'SHARP'],
  labels: ['NON-FUNCTIONAL DESIGN', '#MYSTERYOFLIFE', 'SUBJECT 0039'],
};

export const FOOTER = {
  headline: ['FIND YOUR', 'WAY OUT OF', 'HERE'],
  quote: ['I MADE IT ON PURPOSE.', 'MOSTLY.'],
  notes: [
    ['TO EXPERIMENT', 'IS A METHOD,', 'NOT A MOOD'],
    ['SAFE IDEAS', 'AGE FASTER', 'THAN ANY TREND'],
    ['CURRENTLY LISTENING TO', '[SONG] BY [ARTIST]', 'DESIGN & CODE — DEAN'],
  ],
  rights: 'ALL RIGHTS RESERVED',
};

/* The work page repeats these across its cells. Images are generated placeholders
   until you drop real WebP files into /public/work/ and set `src`. */
export const PROJECTS = [
  { title: 'NIGHT SHIFT', year: 2026, tone: '#e8271c' },
  { title: 'GLASS ROOM', year: 2025, tone: '#7d8b8f' },
  { title: 'LOW SIGNAL', year: 2025, tone: '#d9d9d9' },
  { title: 'STATIC BLOOM', year: 2024, tone: '#3a6df0' },
  { title: 'HALF LIGHT', year: 2024, tone: '#c8a46a' },
  { title: 'NO ARCHIVE', year: 2023, tone: '#5ff0d0' },
  { title: 'COLD OPEN', year: 2023, tone: '#f2f2f2' },
  { title: 'DEAD AIR', year: 2022, tone: '#9a3cff' },
];

export const GALLERY_COUNT = 24;
