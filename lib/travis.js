const rp = require('request-promise');

const TRAVIS_BASE_API = 'https://api.travis-ci.com/v3/'
const TRAVIS_BUILD_API = TRAVIS_BASE_API + 'build/$id'
const TRAVIS_BUILD_JOB_API = TRAVIS_BASE_API + 'build/$id/jobs'
const TRAVIS_JOB_LOG_API = TRAVIS_BASE_API + 'job/$id/log.txt'
const LINE_MARKERS = {
  REDUNDANT_FEATURE_MARKER = 'Found Redundant Feature: ',
  SUCCEEDED_WHILE_OMITTING_FEATURE = 'Succeeded while omitting feature: ',
}

const NONE_FEATURE = 'None';

const JOB_NAME_TO_NUMBER = {
  project_structure_validation: 0,
  feature_api_validation: 1,
  feature_acceptance_evaluation: 2,
  feature_pruning_evaluation: 3
};

/** Changes a feature name in travis (feature) */
const mapPythonFeatureNameToDirectory = (featureInPython, shouldReturnFullName = true) => {
  let featurePieces = featureInPython.split('.');
  if (!shouldReturnFullName) {
    // If we don't need the full directory name, slice to only get user/feature
    featurePieces = featurePieces.slice(-2);
  }
  return featurePieces.join('/');
}

const getTravisAcceptanceMetadata = async build => {
  const acceptanceLog = await getJobLogFromBuild(
    build,
    'feature_acceptance_evaluation'
  );

  return getSuccessMetadataFromLog(acceptanceLog);
}

const getTravisRedundantFeatures = async build => {
  const prunerLog = await getJobLogFromBuild(
    build,
    'feature_pruning_evaluation'
  );
  return getRedundantFeaturesFromLog(prunerLog);
};

const doesBuildPassAllChecks = async buildId => {
  const { jobs } = await getJobsFromBuild(buildId);
  return jobs.every(job => job.state === 'passed');
};

const getBuildIdFromDetailsUrl = detailsUrl => {
  return detailsUrl.substring(detailsUrl.lastIndexOf('/') + 1);
};

const getBuildFromId = async buildId => {
  const buildUrl = TRAVIS_BUILD_API.replace('$id', buildId);
  const build = JSON.parse(await rp(buildUrl));
  return build;
};

const getJobsFromBuild = async buildId => {
  const jobBuildUrl = TRAVIS_BUILD_JOB_API.replace('$id', buildId);
  return JSON.parse(await rp(jobBuildUrl));
};

const getJobLogFromBuild = async (build, job) => {
  const jobNum = JOB_NAME_TO_NUMBER[job];
  const prunerJob = build.jobs[jobNum];
  const jobUrl = TRAVIS_JOB_LOG_API.replace('$id', prunerJob.id);
  const jobLog = await rp(jobUrl);
  return jobLog;
};

const getRedundantFeaturesFromLog = log => {
  const logLines = log.split('\n');
  const features = logLines
    .filter(line => line.includes(LINE_MARKERS.REDUNDANT_FEATURE_MARKER))
    .map(line => line.split(LINE_MARKERS.REDUNDANT_FEATURE_MARKER)[1].trim())
    .map(mapPythonFeatureNameToDirectory)
  return features
}

/**
 * Returns validation metadata.
 * Currently, only returns which feature needed to be omitted for this feature to succeed.
 * Could also return metadata such as: Computed # of cols, entropy metadata.
 */
const getSuccessMetadataFromLog = log => {
  const logLines = log.split('\n');
  let omittedFeature;

  const omittedFeatureLogLine = logLines
    .find(line => line.includes(LINE_MARKERS.SUCCEEDED_WHILE_OMITTING_FEATURE))

  if (omittedFeatureLogLine) {
    const omittedFeatureInPython = omittedFeatureLogLine.split(LINE_MARKERS.REDUNDANT_FEATURE_MARKER)[1].trim()
    if (omittedFeatureInPython !== NONE_FEATURE) {
      omittedFeature = mapPythonFeatureNameToDirectory(featureInPython, false)
    }
  }

  return { omittedFeature };
}

module.exports = {
  doesBuildPassAllChecks,
  getBuildFromId,
  getBuildIdFromDetailsUrl,
  getTravisAcceptanceMetadata,
  getTravisRedundantFeatures
};
