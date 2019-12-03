const fs = require('fs')
const git = require('isomorphic-git')
const tmp = require('tmp')
git.plugins.set('fs', fs)

const BALLET_AUTHOR = {
  name: 'ballet-bot',
  email: 'ballet-project@mit.edu'
}

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
  return context.github.pulls.update(
    context.repo({ pull_number: pullRequestNumber, state: 'closed' })
  )
}

const mergePullRequest = async (context, pullRequestNumber) => {
  return context.github.pulls.merge(
    context.repo({ pull_number: pullRequestNumber })
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
  const { data: commit } = await context.github.git.createCommit(
    context.repo(commitInfo)
  )
  return commit
}

const pushChangesToBranch = async (context, commitSha, branch) => {
  // Make the commit the head of the master repo
  await context.github.git.updateRef(
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
  const { data: ref } = await context.github.git.createRef(
    context.repo({
      ref: `refs/heads/${name}`,
      sha: commitSha
    })
  )
  if (!ref) {
    return
  }
  await context.github.pulls.create(
    context.repo({
      title,
      body,
      head: ref.ref,
      maintainer_can_modify: true,
      base: 'master'
    })
  )
}

const isOnMasterAfterMerge = async context => {
  const checkRun = context.payload.check_run
  const headBranch = checkRun.check_suite.head_branch
  if (headBranch !== 'master') {
    return false
  }

  const commitSha = checkRun.head_sha
  const { data: commit } = await context.github.git.getCommit(
    context.repo({ commit_sha: commitSha })
  )

  return isMergeCommit(commit)
}

const isMergeCommit = commit => {
  return commit.parents.length > 1
}

const isPullRequestProposingFeature = async (context, prNum) => {
  const { data: prFiles } = await context.github.pulls.listFiles(
    context.repo({ pull_number: prNum })
  )
  const nonInitFiles = prFiles.filter(file => !file.filename.endsWith('__init__.py'))
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
  mergePullRequest,
  isOnMasterAfterMerge,
  isPullRequestProposingFeature,
  pushChangesToBranch,
  pushCommitToPullRequest
}
