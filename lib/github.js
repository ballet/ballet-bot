const fs = require('fs');
const git = require('isomorphic-git');
const path = require('path');
const tmp = require('tmp');
const YAML = require('yaml');
git.plugins.set('fs', fs);

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

const pushChangesToRemote = async (context, dir, newGitTree, message) => {
  const headRef = await git.resolveRef({ dir, ref: 'HEAD' });
  const commitInfo = {
    parents: [headRef],
    tree: newGitTree,
    message,
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

const getConfigFromRepo = async repoDir => {
  const configPath = path.join(repoDir, BALLET_CONFIG_FILE);
  const configRaw = fs.readFileSync(configPath, 'utf8');
  return YAML.parse(configRaw);
};

const isOnMasterAfterMerge = async context => {
  const checkRun = context.payload.check_run;
  const headBranch = checkRun.check_suite.head_branch;
  if (headBranch !== 'master') {
    return false;
  }

  const commitSha = checkRun.head_sha;
  const { data: commit } = await context.github.gitdata.getCommit(
    context.repo({ commit_sha: commitSha })
  );

  return commit.parents.length > 1;
};

const isPullRequestProposingFeature = async (context, prNum) => {
  const prFiles = await context.github.pullRequests.listFiles(
    context.repo({ pull_number: prNum })
  );

  const nonInitFiles = prFiles.filter(file => {
    const pieces = file.filename.split('/');
    return pieces[pieces.length - 1] !== '__init__.py';
  });

  if (nonInitFiles.length !== 1) {
    return false;
  } else if (nonInitFiles.some(file => file.status !== 'added')) {
    return false;
  } else {
    return true;
  }
};

module.exports = {
  downloadRepo,
  getConfigFromRepo,
  isOnMasterAfterMerge,
  isPullRequestProposingFeature,
  pushChangesToRemote
};
