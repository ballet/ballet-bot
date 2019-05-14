const rp = require('request-promise');

const TRAVIS_BASE_API = 'https://api.travis-ci.com/v3/';
const TRAVIS_BUILD_API = TRAVIS_BASE_API + 'build/$id';
const TRAVIS_BUILD_JOB_API = TRAVIS_BASE_API + 'build/$id/jobs';
const TRAVIS_JOB_LOG_API = TRAVIS_BASE_API + 'job/$id/log.txt';
const REDUNDANT_FEATURE_MARKER = 'Found Redundant Feature: ';
const JOB_NAME_TO_NUMBER = {
  project_structure_validation: 0,
  feature_api_validation: 1,
  feature_acceptance_evaluation: 2,
  feature_pruning_evaluation: 3
};

const getTravisRedundantFeatures = async build => {
  const prunerLog = await getJobLogFromBuild(
    build,
    'feature_pruning_evaluation'
  );
  return getRedundantFeaturesFromLog(prunerLog);
};

const doesBuildNotFailAllChecks = async buildId => {
  const { jobs } = await getJobsFromBuild(buildId);
  const failedJobs = jobs.filter(job => job.state !== 'passed');
  return failedJobs.length === 0;
};

const getBuildIdFromDetailsUrl = detailsUrl => {
  const urlPieces = detailsUrl.split('/');
  return urlPieces[urlPieces.length - 1];
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
    .filter(line => line.includes(REDUNDANT_FEATURE_MARKER))
    .map(line => line.split(REDUNDANT_FEATURE_MARKER)[1].trim())
    .map(feature => feature.split('.').join('/'));
  return features;
};

module.exports = {
  doesBuildNotFailAllChecks,
  getBuildFromId,
  getBuildIdFromDetailsUrl,
  getTravisRedundantFeatures
};
