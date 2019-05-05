const git = require('./git');

const removeRedundantFeatures = async (context, repoDir, features) => {
  const featureFiles = features.map(feature => feature + '.py');
  const removalTree = createFileTree(featureFiles);
  const newGitTree = await removeFilesFromRepo(
    context,
    repoDir.name,
    removalTree
  );
  if (newGitTree) {
    await git.pushChangesToRemote(context, repoDir.name, newGitTree, features);
  }
  repoDir.removeCallback();
};

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
  const head = { path: '', next: {} };
  files.forEach(feature => {
    const featurePieces = feature.split('/');
    recursivelyCreateFileNodes(head, featurePieces);
  });
  return head;
};

const recursivelyCreateFileNodes = (node, path) => {
  if (path.length === 0) {
    return;
  }
  const next_piece = path[0];
  if (!node.next[next_piece]) {
    node.next[next_piece] = {
      path: next_piece,
      next: {},
      end: path.length === 1
    };
  }
  return recursivelyCreateFileNodes(node.next[next_piece], path.slice(1));
};

const removeFilesFromRepo = async (context, dir, removalTree) => {
  const headRef = await git.resolveRef({ dir, ref: 'HEAD' });
  const refObj = await git.readObject({ dir, oid: headRef });
  const oldHead = refObj.object.tree;
  const newHead = await recursivelyCreateTrees(
    context,
    dir,
    removalTree,
    oldHead
  );

  // If nothing changes, do nothing
  if (oldHead === newHead) {
    return;
  }
  return newHead;
};

const recursivelyCreateTrees = async (context, dir, pathTree, treeSha) => {
  const treeObj = await git.readObject({ dir, oid: treeSha });
  let objects = [];
  let treeHasChanged = false;
  for (let i in treeObj.object.entries) {
    const obj = treeObj.object.entries[i];
    const nextTree = pathTree.next[obj.path];
    if (nextTree) {
      treeHasChanged = true;
      // If there's a next piece of the path, this is a tree.
      // Continue recursing and creating new trees
      if (!nextTree.end) {
        context.log(`changing path ${obj.path}`);
        const newTreeSha = await recursivelyCreateTrees(
          context,
          dir,
          nextTree,
          obj.oid
        );
        if (newTreeSha) {
          objects.push({
            ...obj,
            sha: newTreeSha
          });
        }
      } else {
        context.log(`removing file ${obj.path}`);
      }
      // else, do nothing
      // logically removes this file from the tree
    } else {
      objects.push({
        ...obj,
        sha: obj.oid
      });
    }
  }

  // If the tree has changed, send it to github.
  // else, just return the old hash
  if (treeHasChanged) {
    const newTree = await context.github.gitdata.createTree(
      context.repo({ tree: objects })
    );
    return newTree.data.sha;
  } else {
    return treeSha;
  }
};

module.exports = { removeRedundantFeatures };
