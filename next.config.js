const path = require('path');

/** Pin the workspace root so Next.js ignores stray lockfiles higher up the directory tree. */
module.exports = {
  outputFileTracingRoot: __dirname,
  // Integration tests use an isolated build directory so they never clash with
  // a production build in .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};
