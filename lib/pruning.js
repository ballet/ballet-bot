const git = require('isomorphic-git')
const github = require('./github')

const PRUNE_MESSAGE = 'Pruning Redundant Features: $features'
const PRUNE_REF = 'prune-features-$features'
const PRUNE_BODY =
  'Automated Pull Request made by the Ballet app\nPruning features:\n$features'

const removeRedundantFeatures = async (context, repoDir, config, features) => {
  const featureFiles = features.map(feature => feature + '.py')
  const removalTree = createFileTree(featureFiles)
  const newGitTree = await removeFilesFromRepo(context, repoDir, removalTree)
  if (newGitTree) {
    const commit = await github.createCommitOnRemote(
      context,
      repoDir,
      newGitTree,
      buildCommitMessage(features)
    )
    if (config.github.pruning_action === 'make_pull_request') {
      await github.pushCommitToPullRequest(
        context,
        commit.sha,
        buildRefName(features),
        PRUNE_BODY.replace('$features', features.join('\n'))
      )
    } else if (config.github.pruning_action === 'commit_to_master') {
      await github.pushChangesToBranch(context, commit.sha, 'master')
    }
  }
}

const createFileTree = files => {
  /**
   * Creates a tree-like structure where each prefix
   * is a part of the path. E.g. the file:
   *    features/contrib/user_kelvin/feature_adder.py
   * becomes the trie:
   *    features -> contrib -> user_kelvin -> feature_adder.py
   *
   * @params files a list of POSIX-style file paths
   * @returns a head node representing the top-level directory
   */
  const head = { path: '', next: {} }
  files.forEach(feature => {
    const featurePieces = feature.split('/')
    recursivelyCreateFileNodes(head, featurePieces)
  })
  return head
}

const recursivelyCreateFileNodes = (node, path) => {
  if (path.length === 0) {
    return
  }
  const nextPiece = path[0]
  if (!node.next[nextPiece]) {
    node.next[nextPiece] = {
      path: nextPiece,
      next: {},
      end: path.length === 1
    }
  }
  return recursivelyCreateFileNodes(node.next[nextPiece], path.slice(1))
}

const removeFilesFromRepo = async (context, dir, removalTree) => {
  const headRef = await git.resolveRef({ dir, ref: 'HEAD' })
  const refObj = await git.readObject({ dir, oid: headRef })
  const oldHead = refObj.object.tree
  const newHead = await recursivelyCreateTrees(
    context,
    dir,
    removalTree,
    oldHead
  )

  // If nothing changes, do nothing
  if (oldHead === newHead) {
    return
  }
  return newHead
}

const recursivelyCreateTrees = async (context, dir, pathTree, treeSha) => {
  const treeObj = await git.readObject({ dir, oid: treeSha })
  const objects = []
  let treeHasChanged = false
  for (const i in treeObj.object.entries) {
    const obj = treeObj.object.entries[i]
    const nextTree = pathTree.next[obj.path]
    if (nextTree) {
      treeHasChanged = true
      // If there's a next piece of the path, this is a tree.
      // Continue recursing and creating new trees
      if (!nextTree.end) {
        context.log(`changing path ${obj.path}`)
        const newTreeSha = await recursivelyCreateTrees(
          context,
          dir,
          nextTree,
          obj.oid
        )
        if (newTreeSha) {
          objects.push({
            ...obj,
            sha: newTreeSha
          })
        }
      } else {
        context.log(`removing file ${obj.path}`)
      }
      // else, do nothing
      // logically removes this file from the tree
    } else {
      objects.push({
        ...obj,
        sha: obj.oid
      })
    }
  }

  // If the tree has changed, send it to github.
  // else, just return the old hash
  if (isTreeEmpty(objects)) {
    return null
  } else if (treeHasChanged) {
    const newTree = await context.github.gitdata.createTree(
      context.repo({ tree: objects })
    )
    return newTree.data.sha
  } else {
    return treeSha
  }
}

const isTreeEmpty = treeObjects => {
  return !treeObjects.some(obj => obj.path !== '__init__.py')
}

const buildCommitMessage = features => {
  const featString = features.map(f => prettyPrintFeature(f, '.')).join(', ')
  return PRUNE_MESSAGE.replace('$features', featString)
}

const buildRefName = features => {
  const featString = features.map(f => prettyPrintFeature(f, '-')).join('-')
  return PRUNE_REF.replace('$features', featString)
}

const prettyPrintFeature = (file, separator) => {
  const parts = file.split('/')
  const user = parts[parts.length - 2].split('_')[1]
  const feature = parts[parts.length - 1].split('_')[1]
  return user + separator + feature
}

module.exports = { removeRedundantFeatures }
