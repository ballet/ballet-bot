const express = require('express');
const travis = require('./lib/travis.js');
const github = require('./lib/github.js');
const prune = require('./lib/pruning.js');
const util = require('util');
const dedent = require('dedent');

const BALLET_CONFIG_FILE = 'ballet.yml';

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = (app) => {
  // Status check
  const router = app.route('/ballet-bot');
  router.use(express.static('public'));
  router.get('/status', (req, res) => {
    res.send('OK');
  });

  app.on('check_run.completed', async context => {
    context.log.info(`Responding to ${context.event} (id=${context.id})`);

    const repoUrl = context.payload.repository.html_url;
    const detailsUrl = context.payload.check_run.details_url;

    // Only respond to travis builds!
    const slug = context.payload.check_run.app.slug;
    if (slug !== 'travis-ci') {
      context.log.debug(`Not responding to event from non-Travis app (slug=${slug})`);
      return;
    }

    const repoDir = await github.downloadRepo(repoUrl);
    const config = await loadConfig(context);

    const travisBuildId = travis.getBuildIdFromDetailsUrl(detailsUrl);
    const travisBuild = await travis.getBuildFromId(travisBuildId);

    logImportantInformation(context, travisBuild);

    const shouldPrune = shouldPruneRedundantFeatures(
      context,
      config,
      travisBuildId
    );
    const shouldMerge = shouldMergeAcceptedFeature(
      context,
      config,
      travisBuild
    );
    const shouldClose = shouldCloseRejectedFeature(
      context,
      config,
      travisBuild
    );

    const shouldPruneResult = await shouldPrune;
    if (shouldPruneResult.result) {
      context.log.info('Pruning features...');
      await pruneRedundantFeatures(context, repoDir.name, config, travisBuild);
    } else {
      context.log.info(
        `Not acting to prune features because ${shouldPruneResult.reason}`
      );
    }

    const shouldMergeResult = await shouldMerge;
    if (shouldMergeResult.shouldMerge) {
      context.log.info('Merging PR...');
      const { omittedFeature } = travis.getTravisAcceptanceMetadata(travisBuildId);
      const omittedFeatureMessage = omittedFeature
        ? `We found that your feature provided more information than another feature: ${omittedFeature}`
        : 'We found that your feature added valuable information on top of all the existing features';
      const message = dedent`
        After validation, your feature was accepted.
        ${omittedFeatureMessage}
        It will be automatically merged into the project.
      `;
      await github.commentOnPullRequest(
        context,
        travisBuild.pull_request_number,
        message
      );
      await github.mergePullRequest(context, travisBuild.pull_request_number);
      await github.closePullRequest(context, travisBuild.pull_request_number);
    } else {
      context.log.info(
        `Not acting to merge PR because ${shouldMergeResult.reason}`
      );
    }

    const shouldCloseResult = await shouldClose;
    if (shouldCloseResult.result) {
      context.log.info('Closing PR...');
      const message = dedent`
        After validation, your feature was rejected. Your pull request will be closed. For more details about failures in the validation process, check out the Travis CI build logs.
      `;
      await github.commentOnPullRequest(
        context,
        travisBuild.pull_request_number,
        message
      );
      await github.closePullRequest(context, travisBuild.pull_request_number);
    } else {
      context.log.info(
        `Not acting to close PR because ${shouldCloseResult.reason}`
      );
    }

    repoDir.removeCallback();
  });
};

const loadConfig = async (context) => {
  const config = await context.config(`../${BALLET_CONFIG_FILE}`);
  if (config.default) {
    const s = util.inspect(config.default, { depth: 5, breakLength: Infinity });
    context.log.debug(`Loaded config from ballet.yml:default: ${s}`);
    return config.default;
  }
};

const logImportantInformation = (context, travisBuild) => {
  context.log.info(`Getting a check from branch: ${travisBuild.branch.name}`);
  context.log.info(`On commit: ${travisBuild.commit.message}`);
};

const shouldMergeAcceptedFeature = async (context, config, build) => {
  let shouldMerge, reason;
  if (build.event_type !== 'pull_request') {
    shouldMerge = false;
    reason = 'not a PR';
  } else if (!(await travis.doesBuildPassAllChecks(build.id))) {
    shouldMerge = false;
    reason = 'Travis build did not pass';
  } else if (
    !(await github.isPullRequestProposingFeature(
      context,
      build.pull_request_number
    ))
  ) {
    shouldMerge = false;
    reason = 'PR does not propose a feature';
  } else if (config.github.auto_merge_accepted_features === 'no') {
    shouldMerge = false;
    reason = 'auto_merge_accepted_features disabled in config';
  } else {
    shouldMerge = true;
    reason = '<n/a>';
  }

  return { shouldMerge, reason };
};

const shouldPruneRedundantFeatures = async (context, config, buildId) => {
  let result, reason;
  if (!(await github.isOnMasterAfterMerge(context))) {
    result = false;
    reason = 'not on master branch after merge commit';
  } else if (!(await travis.doesBuildPassAllChecks(buildId))) {
    result = false;
    reason = 'Travis build is failing';
  } else if (config.github.pruning_action === 'no_action') {
    result = false;
    reason = 'pruning_action set to no_action in config';
  } else {
    result = true;
    reason = '<n/a>';
  }

  return { result, reason };
};

const pruneRedundantFeatures = async (context, repoDir, config, build) => {
  const redundantFeatures = await travis.getTravisRedundantFeatures(build);
  context.log.info('FOUND REDUNDANT FEATURES: ');
  context.log.info(redundantFeatures.join('\n'));
  if (redundantFeatures.length) {
    return prune.removeRedundantFeatures(
      context,
      repoDir,
      config,
      redundantFeatures
    );
  }
};

const shouldCloseRejectedFeature = async (context, config, build) => {
  let result, reason;
  if (build.event_type !== 'pull_request') {
    result = false;
    reason = 'not a pull request';
  } else if (await travis.doesBuildPassAllChecks(build.id)) {
    result = false;
    reason = 'passed all checks on CI';
  } else if (
    !(await github.isPullRequestProposingFeature(
      context,
      build.pull_request_number
    ))
  ) {
    result = false;
    reason = 'PR does not propose a feature';
  } else if (config.github.auto_close_rejected_features === 'no') {
    result = false;
    reason = 'auto_close_rejected_features disabled in config';
  } else {
    result = true;
    reason = '<n/a>';
  }

  return { result, reason };
};
