const fs = require('fs');
const git = require('isomorphic-git');
const tmp = require('tmp');
git.plugins.set('fs', fs);

const PRUNE_MESSAGE = 'Pruning Redundant Feature: $feature';
const BALLET_AUTHOR = {
    name: 'Ballet',
    email: 'dai-lab@mit.edu' // Some email...
}

const removeRedundantFeatures = async (context, features) => {
    const repoUrl = context.payload.repository.html_url;
    const repoDir = await downloadRepo(repoUrl);
    for(let i = 0; i < features.length; i++) {
        const feature = features[i];
        await removeFeatureFromRepo(context, repoDir.name, feature);
    }

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

const removeFeatureFromRepo = async (context, dir, feature) => {
    const featurePath = feature + '.py';
    const pathPieces = featurePath.split('/');
    const headRef = await git.resolveRef({dir, ref: 'HEAD'});
    const refObj = await git.readObject({dir, oid: headRef});
    let headTree = refObj.object.tree;
    headTree = await recursivelyCreateTrees(
        context,
        dir,
        pathPieces,
        headTree);

    const commitInfo = {
        parents: [headRef],
        tree: headTree.data.sha,
        message: PRUNE_MESSAGE.replace('$feature', prettyPrintFeature(feature)),
        author: BALLET_AUTHOR,
    }
    const {data: commit} = await context.github.gitdata.createCommit(context.repo(commitInfo));
    await context.github.gitdata.updateRef(context.repo({
        ref: 'heads/master',
        sha: commit.sha,
    }));

    return await git.pull({dir, ref: 'master'});
}

const recursivelyCreateTrees = async (context, dir, path, tree) => {
    const treeObj = await git.readObject({dir, oid: tree});
    let objects = [];
    for(let i = 0; i < treeObj.object.entries.length; i++) {
        const obj = treeObj.object.entries[i];
        if (obj.type === 'blob'
            && path[0] === obj.path
            && path.length === 1) {
            continue;
        } else if (obj.type === 'tree'
            && path[0] === obj.path
            && path.length > 1) {
            const newTree = await recursivelyCreateTrees(
                context,
                dir,
                path.slice(1),
                obj.oid
            );
            if (newTree) {
                objects.push({
                    ...obj,
                    sha: newTree.data.sha,
                })
            }
        } else {
            objects.push({
                ...obj,
                sha: obj.oid,
            })
        }
    }
    return await context.github.gitdata.createTree(context.repo({tree: objects}));
}

const prettyPrintFeature = feature => {
    const parts = feature.split('/');
    const { length } = parts;
    return parts[length - 2] + ', ' + parts[length - 1];
}

module.exports = { removeRedundantFeatures };