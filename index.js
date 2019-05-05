// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more
const travis = require('./travis.js');
const git = require('./git.js');
/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on('check_run.completed', async context => {
    const checkRun = context.payload.check_run;
    const repoUrl = context.payload.repository.html_url;
    const repoDir = git.downloadRepo(repoUrl);
    const config = git.getConfigFromRepo(repoDir.name);

    if (checkRun.check_suite.head_branch !== 'master') {
      return;
    }
    const detailsUrl = checkRun.details_url;
    const redundantFeatures = await travis.getTravisRedundantFeatures(
      detailsUrl
    );
    if (redundantFeatures.length) {
      return git.removeRedundantFeatures(context, redundantFeatures);
    }
  });
};

const onCheckRunMasterMerge = async context => {
  const checkRun = context.payload.check_run;
  if (checkRun.check_suite.head_branch !== 'master') {
    return;
  }
  const detailsUrl = checkRun.details_url;
  const redundantFeatures = await travis.getTravisRedundantFeatures(detailsUrl);
  if (redundantFeatures.length) {
    return git.removeRedundantFeatures(context, redundantFeatures);
  }
};
