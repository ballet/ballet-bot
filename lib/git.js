const fs = require('fs');
const git = require('isomorphic-git');
const path = require('path');
const tmp = require('tmp');
const YAML = require('yaml');
git.plugins.set('fs', fs);

const PRUNE_MESSAGE = 'Pruning Redundant Features: $features';
const BALLET_AUTHOR = {
  name: 'Ballet',
  email: 'dai-lab@mit.edu' // Some email...
};
const BALLET_CONFIG_FILE = 'ballet.yml';

const downloadRepo = async (url, ref) => {
  const tempDir = tmp.dirSync();
  await git.clone({
    dir: tempDir.name,
    url,
    ref,
    singleBranch: true,
    depth: 10
  });
  return tempDir;
};

const pushChangesToRemote = async (context, dir, newGitTree, features) => {
  const headRef = await git.resolveRef({ dir, ref: 'HEAD' });
  const commitInfo = {
    parents: [headRef],
    tree: newGitTree,
    message: buildCommitMessage(features),
    author: BALLET_AUTHOR
  };
  // Create a commit on github
  const { data: commit } = await context.github.gitdata.createCommit(
    context.repo(commitInfo)
  );
  // Make the commit the head of the master repo
  await context.github.gitdata.updateRef(
    context.repo({
      ref: 'heads/master',
      sha: commit.sha
    })
  );
};

const buildCommitMessage = features => {
  const featString = features.map(prettyPrintFeature).join(', ');
  return PRUNE_MESSAGE.replace('$features', featString);
};

const prettyPrintFeature = file => {
  const parts = file.split('/');
  const user = parts[parts.length - 2].split('_')[1];
  const feature = parts[parts.length - 1].split('_')[1];
  return user + '.' + feature;
};

const getConfigFromRepo = async repoDir => {
  const configPath = path.join(repoDir, BALLET_CONFIG_FILE);
  const configRaw = fs.readFileSync(configPath);
  return YAML.parse(configRaw);
};

const isOnMasterAfterMerge = async context => {
  const headBranch = context.check_run.check_suite.head_branch;
  if (headBranch !== 'master') {
    return false;
  }

  const commitSha = context.check_run.head_sha;
  const commit = context.git.gitdata.getCommit(
    context.repo({ commit_sha: commitSha })
  );

  return commit.parents.length > 1;
};

module.exports = {
  downloadRepo,
  getConfigFromRepo,
  isOnMasterAfterMerge,
  pushChangesToRemote
};
