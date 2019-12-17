const balletApp = require('..')
const { Probot } = require('probot')
const github = require('../lib/github.js')
const listPrFilesResponse = require('./fixtures/list_pull_request_files_feature')

describe('lib/github', () => {
  let probot

  beforeEach(() => {
    probot = new Probot({})
    const app = probot.load(balletApp)
  })

  test('identifies proposed feature', () => {
    const mockContext = {
      github : {
        pulls: {
          listFiles: async (obj) => {
            return listFilesResponse
          }
        }
      }
    }
    const prNum = 1

    const result = await github.isPullRequestProposingFeature(context, prNum)

    return true

  })

  test('does not identify proposed feature', () => {
    const mockContext = {
      github : {
        pulls: {
          listFiles: async (obj) => {
            return listFilesResponse
          }
        }
      }
    }
    const prNum = 1

    const result = await github.isPullRequestProposingFeature(context, prNum)

    return true

  })

})
