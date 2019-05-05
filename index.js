// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more
const travis = require('./lib/travis.js');
const git = require('./lib/git.js');
const prune = require('./lib/pruning.js');
/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on('check_run.completed', async context => {
    const repoUrl = context.payload.repository.html_url;
    const detailsUrl = context.payload.check_run.details_url;

    const repoDir = git.downloadRepo(repoUrl);
    const config = git.getConfigFromRepo(repoDir.name);
    const travisBuild = travis.getBuildIdFromDetailsUrl(detailsUrl);

    if (await shouldPruneRedundantFeatures(context, config, travisBuild)) {
      await pruneRedundantFeatures(context, repoDir.name, config, travisBuild);
    }

    repoDir.removeCallback();
  });
};

const shouldPruneRedundantFeatures = async (context, config, buildId) => {
  if (!git.isOnMasterAfterMerge(context)) {
    return false;
  } else if (!travis.doesBuildNotFailAllChecks(buildId)) {
    return false;
  } else if (config.github.prune_action === 'no_action') {
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
