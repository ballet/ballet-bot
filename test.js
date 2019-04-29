const fs = require('fs')
const git = require('isomorphic-git')
const tmp = require('tmp')
const path = require('path')
git.plugins.set('fs', fs)

const testFeat = 'ames/features/contrib/user_04/feature_01.py';

async function test() {
    const dir = tmp.dirSync().name;
    await git.clone({
        dir,
        url: 'https://github.com/micahjsmith/ballet-ames-demo.git',
        ref: 'master',
        singleBranch: true,
        depth: 10,
    })

    testPath = path.join(dir, testFeat);
    await git.remove({
        dir,
        filepath: testFeat,
    })
    console.log(testPath);
}

test()




