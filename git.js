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
    const repoUrl = context.payload.check_run.check_suite.repository.html_url;
    const repoDir = await downloadRepo(repoUrl);
    for(let i = 0; i < features.length; i++) {
        const feature = features[i];
        await removeFeatureFromRepo(context, dir.name, feature);
    }
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
    let headTree = await git.readObject({dir, oid: headRef.object.tree});
    headTree = await recursivelyCreateTrees(context, dir, pathPieces, tree);
    const commitInfo = {
        parent: headRef,
        tree: tree.sha,
        message: PRUNE_MESSAGE.replace('$feature', prettyPrintFeature(feature)),
        author: BALLET_AUTHOR,
    }
    const commit = await context.github.createCommit(context.repo(commitInfo));
    await context.github.updateRef(context.repo({
        ref: 'master',
        sha: commit.sha,
    }));

    return await git.pull({dir, ref: 'master'});
}

const recursivelyCreateTrees = async (context, dir, path, tree) => {
    let objects = [];
    for(let i = 0; i < tree.object.entries.length; i++) {
        const obj = tree.object.entries[i];
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
                tree
            );
            if (newTree) {
                objects.push({
                    ...obj,
                    sha: newTree.sha,
                })
            }
        } else {
            objects.push({
                ...obj,
                sha: obj.oid,
            })
        }
    }

    return await context.github.git.createTree(context.repo({tree: objects}));
}