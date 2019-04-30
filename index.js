// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more
const travis = require('./travis.js');
const git = require('./git.js');
/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on(['check_run.completed'], check);
}

  const check = async context => {
    const checkRun = context.payload.check_run;
    if (checkRun.check_suite.head_branch !== 'master') {
      return;
    }
    const detailsUrl = checkRun.details_url;
    const redundantFeatures = travis.getTravisRedundantFeatures(detailsUrl);
    return git.removeRedundantFeatures(context, redundantFeatures);
}