![Uptime Status](https://img.shields.io/uptimerobot/status/m784006190-b0fa1300848e931654e56628)
[![Run Tests](https://github.com/ballet/ballet-bot/workflows/Test/badge.svg)](https://github.com/ballet/ballet/actions?query=workflow%3A%22Test%22)

# Ballet Bot

> A GitHub App built with [Probot](https://github.com/probot/probot)

Ballet Bot is a bot (GitHub App) to help manage [Ballet](https://ballet.github.io) projects.

Ballet projects are collaborative projects to produce a shared data science artifact, like a feature engineering pipeline. They receive many small contributions (data science patches) from collaborators. In traditional software development, a patch, like a pull request on GitHub, may be subjected to a code review by a maintainer or another committer on the project. In the case of Ballet projects, since each patch is expected to follow the same structure, it can be largely validated without the need for a manual code review.

Building off this, Ballet Bot allows pull request management tasks to be automated in the context of a Ballet project. More specifically, Ballet Bot can detect for a pull request whether the patch has validated successfully or not, and can automatically merge PRs corresponding to "good" patches and close PRs corresponding to "bad" patches. In addition, if the result of patch validation is that [some other patch should be pruned](https://ballet.github.io/ballet/maintainer_guide.html#pruning-features), then Ballet Bot can automatically remove the other patch from the repository, either by committing directly to the default branch or by creating a new PR.

## Configuration

Ballet Bot reads configuration from a projects `ballet.yml` configuration file. The following options are supported under the `github` key:

* `pruning_action`: what action to take when the feature validation routine identifies a feature that should be pruned, one of `no_action`, `make_pull_request`, and `commit_to_master`
* `auto_merge_accepted_features`: whether to automatically merge pull requests that introduce features that validate successfully, one of `no` and `yes`
* `auto_close_rejected_features`: whether to automatically close pull requests that introduce features that fail to validate, one of `no` and `yes`

Here is an example snippet from a `ballet.yml` file:

```yml
github:
  pruning_action: commit_to_master
  auto_merge_accepted_features: yes
  auto_close_rejected_features: yes
```

## Development

### Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

### Contributing

If you have suggestions for how Ballet Bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2019 Kelvin Lu <kelvinlu@mit.edu> (https://github.com/kelvin-lu)
