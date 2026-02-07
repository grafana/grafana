# How To Contribute

We'd love to accept your patches and contributions to this project. There are just a few guidelines you need to follow which are described in detail below.

## 1. Fork this repo

You should create a fork of this project in your account and work from there. You can create a fork by clicking the fork button in GitHub.

## 2. One feature, one branch

Work for each new feature/issue should occur in its own branch. To create a new branch from the command line:
```shell
git checkout -b my-new-feature
```
where "my-new-feature" describes what you're working on.

## 3. Add unit tests
If your contribution modifies existing or adds new code please add corresponding unit tests for this.

## 4. Ensure that the build passes

Run
```shell
go test -v
```
and check that there are no errors.

## 5. Add documentation for new or updated functionality

Please review the [README.md](README.md) file in this project to see if they are impacted by your change and update them accordingly.

## 6. Add to CHANGELOG.md

Any notable changes should be recorded in the CHANGELOG.md following the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions.

## 7. Submit a pull request and describe the change

Push your changes to your branch and open a pull request against the parent repo on GitHub. The project administrators will review your pull request and respond with feedback.

# How your contribution gets merged

Upon pull request submission, your code will be reviewed by the maintainers. They will confirm at least the following:

- Tests run successfully (unit, coverage, style).
- Contribution policy has been followed.

A (human) reviewer will need to sign off on your pull request before it can be merged.
