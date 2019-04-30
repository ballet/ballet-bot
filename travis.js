const rp = require('request-promise');

const TRAVIS_BUILD_API = 'https://api.travis-ci.com/v3/build/$id';
const TRAVIS_JOB_LOG_API = 'https://api.travis-ci.com/v3/job/$id/log.txt';
const REDUNDANT_FEATURE_MARKER = 'Found Redundant Feature: ';

const getTravisRedundantFeatures = async detailsUrl => {
    const buildId = getBuildIdFromDetailsUrl(detailsUrl);
    const build = await getBuildFromId(buildId);
    const prunerLog = await getPrunerLogFromBuild(build);
    return getRedundantFeaturesFromLog(prunerLog);
}

const getBuildIdFromDetailsUrl = detailsUrl => {
    const urlPieces  = detailsUrl.split('/');
    return urlPieces[urlPieces.length - 1];
}

const getBuildFromId = async buildId => {
    const buildUrl = TRAVIS_BUILD_API.replace('$id', buildId);
    const build = JSON.parse(await rp(buildUrl));
    return build;
}

const getPrunerLogFromBuild = async build => {
    const prunerJob = build.jobs[build.jobs.length - 1];
    const jobUrl = TRAVIS_JOB_LOG_API.replace('$id', prunerJob.id);
    const jobLog = await rp(jobUrl);
    return jobLog;
}

const getRedundantFeaturesFromLog = log => {
    logLines = log.split('\n');
    const features = logLines
        .filter(line => line.includes(REDUNDANT_FEATURE_MARKER))
        .map(line => line.trim())
        .map(line => line.split(REDUNDANT_FEATURE_MARKER)[1])
        .map(feature => feature.split('.').join('/'))
    console.log(features)
    return features
}

module.exports = { getTravisRedundantFeatures };


