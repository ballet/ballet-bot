// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more
const fs = require('fs')
const git = require('isomorphic-git')
git.plugins.set('fs', fs)

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */
module.exports = app => {
  app.on(['check_suite.completed'], check);

  async function check (context) {
    const startTime = new Date()

    // Do stuff
    const s = context.payload.check_suite;
    // Probot API note: context.repo() => {username: 'hiimbex', repo: 'testing-things'}
    console.info(s);
  }

  app.on('push', print)

  async function print (context) {
    console.info(context)
  }
}
