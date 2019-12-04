const travis = require('./lib/travis.js')
const github = require('./lib/github.js')
const prune = require('./lib/pruning.js')
const util = require('util')

const BALLET_CONFIG_FILE = 'ballet.yml'

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on('check_run.completed', async context => {
    context.log(`Responding to ${context.event} (id=${context.id})`)

    const repoUrl = context.payload.repository.html_url
    const detailsUrl = context.payload.check_run.details_url

    const repoDir = await github.downloadRepo(repoUrl)
    const config = await loadConfig(context)

    const travisBuildId = travis.getBuildIdFromDetailsUrl(detailsUrl)
    const travisBuild = await travis.getBuildFromId(travisBuildId)

    logImportantInformation(context, travisBuild)

    const shouldPrune = shouldPruneRedundantFeatures(context, config, travisBuildId)
    const shouldMerge = shouldMergeAcceptedFeature(context, config, travisBuild)
    const shouldClose = shouldCloseRejectedFeature(context, config, travisBuild)

    const shouldPruneResult = await shouldPrune
    if (shouldPruneResult.result) {
      context.log('Pruning features...')
      await pruneRedundantFeatures(context, repoDir.name, config, travisBuild)
    } else {
      context.log(`Not acting to prune features because ${shouldPruneResult.reason}`)
    }

    const shouldMergeResult = await shouldMerge
    if (shouldMergeResult.result) {
      context.log('Merging PR...')
      await github.mergePullRequest(context, travisBuild.pull_request_number)
      await github.closePullRequest(context, travisBuild.pull_request_number)
    } else {
      context.log(`Not acting to merge PR because ${shouldMergeResult.reason}`)
    }

    const shouldCloseResult = await shouldClose
    if (shouldCloseResult.result) {
      context.log('Closing PR...')
      await github.closePullRequest(context, travisBuild.pull_request_number)
    } else {
      context.log(`Not acting to close PR because ${shouldCloseResult.reason}`)
    }

    repoDir.removeCallback()
  })
}

const loadConfig = async (context) => {
  const config = await context.config(`../${BALLET_CONFIG_FILE}`)
  if (config.default) {
    const s = util.inspect(config.default, { depth: 5, breakLength: Infinity })
    context.log.debug(`Loaded config from ballet.yml:default: ${s}`)
    return config.default
  }
}

const logImportantInformation = (context, travisBuild) => {
  context.log(`Getting a check from branch: ${travisBuild.branch.name}`)
  context.log(`On commit: ${travisBuild.commit.message}`)
}

const shouldMergeAcceptedFeature = async (context, config, build) => {
  let result, reason
  if (build.event_type !== 'pull_request') {
    result = false
    reason = 'not a PR'
  } else if (!(await travis.doesBuildPassAllChecks(build.id))) {
    result = false
    reason = 'Travis build did not pass'
  } else if (
    !(await github.isPullRequestProposingFeature(
      context,
      build.pull_request_number
    ))
  ) {
    result = false
    reason = 'PR does not propose a feature'
  } else if (config.github.auto_merge_accepted_features === 'no') {
    result = false
    reason = 'auto_merge_accepted_features disabled in config'
  } else {
    result = true
    reason = '<n/a>'
  }

  return { result, reason }
}

const shouldPruneRedundantFeatures = async (context, config, buildId) => {
  let result, reason
  if (!(await github.isOnMasterAfterMerge(context))) {
    result = false
    reason = 'not on master branch after merge commit'
  } else if (!(await travis.doesBuildPassAllChecks(buildId))) {
    result = false
    reason = 'Travis build is failing'
  } else if (config.github.pruning_action === 'no_action') {
    result = false
    reason = 'pruning_action set to no_action in config'
  } else {
    result = true
    reason = '<n/a>'
  }

  return { result, reason }
}

const pruneRedundantFeatures = async (context, repoDir, config, build) => {
  const redundantFeatures = await travis.getTravisRedundantFeatures(build)
  context.log('FOUND REDUNDANT FEATURES: ')
  context.log(redundantFeatures.join('\n'))
  if (redundantFeatures.length) {
    return prune.removeRedundantFeatures(
      context,
      repoDir,
      config,
      redundantFeatures
    )
  }
}

const shouldCloseRejectedFeature = async (context, config, build) => {
  let result, reason
  if (build.event_type !== 'pull_request') {
    result = false
    reason = 'not a pull request'
  } else if (await travis.doesBuildPassAllChecks(build.id)) {
    result = false
    reason = 'passed all checks on CI'
  } else if (
    !(await github.isPullRequestProposingFeature(
      context,
      build.pull_request_number
    ))
  ) {
    result = false
    reason = 'PR does not propose a feature'
  } else if (config.github.auto_close_rejected_features === 'no') {
    result = false
    reason = 'auto_close_rejected_features disabled in config'
  } else {
    result = true
    reason = '<n/a>'
  }

  return { result, reason }
}
