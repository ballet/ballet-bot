// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more
const travis = require('./lib/travis.js');
const github = require('./lib/github.js');
const prune = require('./lib/pruning.js');
/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on('check_run.completed', async context => {
    const repoUrl = context.payload.repository.html_url;
    const detailsUrl = context.payload.check_run.details_url;

    const repoDir = await github.downloadRepo(repoUrl);
    const config = await github.getConfigFromRepo(repoDir.name, context);
    const travisBuild = travis.getBuildIdFromDetailsUrl(detailsUrl);

    if (await shouldPruneRedundantFeatures(context, config, travisBuild)) {
      await pruneRedundantFeatures(context, repoDir.name, config, travisBuild);
    }

    repoDir.removeCallback();
  });
};

const shouldPruneRedundantFeatures = async (context, config, buildId) => {
  if (!github.isOnMasterAfterMerge(context)) {
    return false;
  } else if (!travis.doesBuildNotFailAllChecks(buildId)) {
    return false;
  } else if (config.github.pruning_action === 'no_action') {
    return false;
  }

  return true;
};

const pruneRedundantFeatures = async (context, repoDir, config, buildId) => {
  const redundantFeatures = await travis.getTravisRedundantFeatures(buildId);
  if (redundantFeatures.length) {
    return prune.removeRedundantFeatures(
      context,
      repoDir,
      config,
      redundantFeatures
    );
  }
};
