const fs = require('fs');
const git = require('isomorphic-git');
const tmp = require('tmp');
git.plugins.set('fs', fs);

const PRUNE_MESSAGE = 'Pruning Redundant Feature:';
const BALLET_AUTHOR = {
    name: 'Ballet',
    email: 'dai-lab@mit.edu' // Some email...
}

const removeRedundantFeatures = async (context, features) => {
    const repoUrl = context.payload.repository.html_url;
    const repoDir = await downloadRepo(repoUrl);
    const featureFiles = files.map(feature => feature + '.py');
    const removalTree = createFileTree(featureFiles)
    await removeFilesFromRepo(context, repoDir.name, removalTree);

    repoDir.removeCallback();
}

const downloadRepo = async (url, ref) => {
    const tempDir = tmp.dirSync();
    await git.clone({
        dir: tempDir.name,
        url,
        ref,
        singleBranch: true,
        depth: 10,
    });
    return tempDir;
}

const createFileTree = (files) => {
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
    const head = {path: "", next: {}};
    files
        .forEach(feature => {
        feature_pieces = feature.split('/');
        recursivelyCreateFileNodes(head, feature_pieces);
    })
    return head;
}

const recursivelyCreateFileNodes = (node, path) => {
    if (path.length === 0) {
        return;
    }
    const next_piece = path[0];
    if (!node.next[next_piece]) {
        node.next[next_piece] = {
            path: next_piece,
            next: {},
            end: path.length === 1,
        };
    }
    return recursivelyCreateFileNodes(node.next[next_piece], path.slice(1));
}

const removeFilesFromRepo = async (context, dir, removalTree) => {
    const headRef = await git.resolveRef({dir, ref: 'HEAD'});
    const refObj = await git.readObject({dir, oid: headRef});
    const oldHead = refObj.object.tree;
    const newHead = await recursivelyCreateTrees(
        context,
        dir,
        removalTree,
        oldHead);
    
    // If nothing changes, do nothing
    if (oldHead === newHead) {
        return;
    }

    const commitInfo = {
        parents: [headRef],
        tree: newHead,
        message: PRUNE_MESSAGE.replace('$feature', prettyPrintFeature(feature)),
        author: BALLET_AUTHOR,
    }
    // Create a commit on github
    const {data: commit} = await context.github.gitdata.createCommit(context.repo(commitInfo));
    // Make the commit the head of the master repo
    await context.github.gitdata.updateRef(context.repo({
        ref: 'heads/master',
        sha: commit.sha,
    }));

    return await git.pull({dir, ref: 'master'});
}

const recursivelyCreateTrees = async (context, dir, pathTree, treeSha) => {
    const treeObj = await git.readObject({dir, oid: treeSha});
    let objects = [];
    let treeHasChanged = false;
    for(let obj in  treeObj.object.entries) {
        if (pathTree.next[obj.oid]) {
            treeHasChanged = true;
            // If there's a next piece of the path, this is a tree.
            // Continue recursing and creating new trees
            if (pathTree.next[obj.oid].next) {
                const newTreeSha = await recursivelyCreateTrees(
                    context,
                    dir,
                    path.slice(1),
                    obj.oid
                );
                if (newTree) {
                    objects.push({
                        ...obj,
                        sha: newTreeSha,
                    })
                }
            }
            // else, do nothing 
            // logically removes this file from the tree
        } else {
            objects.push({
                ...obj,
                sha: obj.oid,
            })
        }
    }

    // If the tree has changed, send it to github.
    // else, just return the old hash
    if (treeHasChanged) {
        const newTree =  await context.github.gitdata.createTree(context.repo({tree: objects}));
        return newTree.data.sha;
    } else {
        return treeSha;
    }
}

const prettyPrintFeature = file => {
    const parts = file.split('/');
    const user = parts[parts.length - 2].split('_')[1];
    const feature = parts[parts.length - 1].split('_')[1];
    return user + '.' + feature;
}

module.exports = { removeRedundantFeatures };