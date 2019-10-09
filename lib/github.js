const fs = require('fs')
const git = require('isomorphic-git')
const path = require('path')
const tmp = require('tmp')
const YAML = require('yaml')
git.plugins.set('fs', fs)

const BALLET_AUTHOR = {
  name: 'ballet-app',
  email: 'dai-lab@mit.edu' // Some email...
}
const BALLET_CONFIG_FILE = 'ballet.yml'

const downloadRepo = async (url, ref) => {
  const tempDir = tmp.dirSync()
  await git.clone({
    dir: tempDir.name,
    url,
    ref,
    singleBranch: true,
    depth: 10
  })
  return tempDir
}

const closePullRequest = async (context, pullRequestNumber) => {
  await context.github.pullRequests.update(
    context.repo({ number: pullRequestNumber, status: 'closed' })
  )
}

const mergePullRequest = async (context, pullRequestNumber) => {
  await context.github.pullRequests.merge(
    context.repo({ number: pullRequestNumber })
  )
}

const createCommitOnRemote = async (context, dir, newGitTree, message) => {
  const headRef = await git.resolveRef({ dir, ref: 'HEAD' })
  const commitInfo = {
    parents: [headRef],
    tree: newGitTree,
    message,
    author: BALLET_AUTHOR
  }
  // Create a commit on github
  const { data: commit } = await context.github.gitdata.createCommit(
    context.repo(commitInfo)
  )
  return commit
}

const pushChangesToBranch = async (context, commitSha, branch) => {
  // Make the commit the head of the master repo
  await context.github.gitdata.updateRef(
    context.repo({
      ref: `heads/${branch}`,
      sha: commitSha
    })
  )
}

const pushCommitToPullRequest = async (
  context,
  commitSha,
  name,
  title,
  body
) => {
  const { data: ref } = await context.github.gitdata.createRef(
    context.repo({
      ref: `refs/heads/${name}`,
      sha: commitSha
    })
  )
  if (!ref) {
    return
  }
  await context.github.pullRequests.create(
    context.repo({
      title,
      body,
      head: ref.ref,
      maintainer_can_modify: true,
      base: 'refs/head/master'
    })
  )
}

const getConfigFromRepo = async repoDir => {
  const configPath = path.join(repoDir, BALLET_CONFIG_FILE)
  const configRaw = fs.readFileSync(configPath, 'utf8')
  return YAML.parse(configRaw)
}

const isOnMasterAfterMerge = async context => {
  const checkRun = context.payload.check_run
  const headBranch = checkRun.check_suite.head_branch
  if (headBranch !== 'master') {
    return false
  }

  const commitSha = checkRun.head_sha
  const { data: commit } = await context.github.gitdata.getCommit(
    context.repo({ commit_sha: commitSha })
  )

  return commit.parents.length > 1
}

const isPullRequestProposingFeature = async (context, prNum) => {
  const { data: prFiles } = await context.github.pullRequests.listFiles(
    context.repo({ number: prNum })
  )

  const nonInitFiles = prFiles.filter(file => {
    const pieces = file.filename.split('/')
    return pieces[pieces.length - 1] !== '__init__.py'
  })

  if (nonInitFiles.length !== 1) {
    return false
  } else if (nonInitFiles.some(file => file.status !== 'added')) {
    return false
  } else {
    return true
  }
}

module.exports = {
  createCommitOnRemote,
  closePullRequest,
  downloadRepo,
  getConfigFromRepo,
  mergePullRequest,
  isOnMasterAfterMerge,
  isPullRequestProposingFeature,
  pushChangesToBranch,
  pushCommitToPullRequest
}
