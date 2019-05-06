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

    const travisBuildId = travis.getBuildIdFromDetailsUrl(detailsUrl);
    const travisBuild = await travis.getBuildFromId(travisBuildId);

    if (await shouldPruneRedundantFeatures(context, config, travisBuildId)) {
      await pruneRedundantFeatures(context, repoDir.name, config, travisBuild);
    } else if (await shouldAcceptPassingFeature(context, config, travisBuild)) {
      await context.github.pullRequests.merge(
        context.repo({ pull_number: travisBuild.pull_request_number })
      );
    }

    repoDir.removeCallback();
  });
};

const shouldAcceptPassingFeature = async (context, config, build) => {
  if (build.event_type !== 'pull_request') {
    return false;
  } else if (!(await travis.doesBuildNotFailAllChecks(build.id))) {
    return false;
  } else if (config.github.accept_passing_features === 'no') {
    return false;
  }

  return true;
};

const shouldPruneRedundantFeatures = async (context, config, buildId) => {
  if (!github.isOnMasterAfterMerge(context)) {
    return false;
  } else if (!(await travis.doesBuildNotFailAllChecks(buildId))) {
    return false;
  } else if (config.github.pruning_action === 'no_action') {
    return false;
  }

  return true;
};

const pruneRedundantFeatures = async (context, repoDir, config, build) => {
  const redundantFeatures = await travis.getTravisRedundantFeatures(build);
  if (redundantFeatures.length) {
    return prune.removeRedundantFeatures(
      context,
      repoDir,
      config,
      redundantFeatures
    );
  }
};
