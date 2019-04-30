// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more
const fs = require('fs');
const git = require('isomorphic-git');
const travis = require('./travis.js');
git.plugins.set('fs', fs);

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on(['check_run.completed'], check);
}

async function check (context) {
  const checkRun = context.payload.check_run;
  if (checkRun.check_suite.head_branch !== 'master') {
    return;
  }
  const detailsUrl = checkRun.details_url;
  const redundantFeatures = travis.getTravisRedundantFeatures(detailsUrl);
  const gitDir = await downloadRepo(checkRun.check_suite.repository.html_url);
  const 
}

async function downloadRepo(url, ref) {
  const tempDir = tmp.dirSync();
  await git.clone({
      dir: tempDir.name,
      url,
      ref: ref | 'master',
      singleBranch: true,
      depth: 10,
  })
  return tempDir;
}

async function findRedundantFeaturesFromContext(checkRun) {
  const buildUrl = checkRun.details_url;
  
}
