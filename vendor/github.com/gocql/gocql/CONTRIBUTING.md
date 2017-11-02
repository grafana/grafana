# Contributing to gocql

**TL;DR** - this manifesto sets out the bare minimum requirements for submitting a patch to gocql.

This guide outlines the process of landing patches in gocql and the general approach to maintaining the code base.

## Background

The goal of the gocql project is to provide a stable and robust CQL driver for Go. gocql is a community driven project that is coordinated by a small team of core developers.

## Minimum Requirement Checklist

The following is a check list of requirements that need to be satisfied in order for us to merge your patch:

* You should raise a pull request to gocql/gocql on Github
* The pull request has a title that clearly summarizes the purpose of the patch
* The motivation behind the patch is clearly defined in the pull request summary
* Your name and email have been added to the `AUTHORS` file (for copyright purposes)
* The patch will merge cleanly
* The test coverage does not fall below the critical threshold (currently 64%) 
* The merge commit passes the regression test suite on Travis
* `go fmt` has been applied to the submitted code
* Functional changes (i.e. new features or changed behavior) are appropriately documented, either as a godoc or in the README (non-functional changes such as bug fixes may not require documentation)

If there are any requirements that can't be reasonably satisfied, please state this either on the pull request or as part of discussion on the mailing list. Where appropriate, the core team may apply discretion and make an exception to these requirements.

## Beyond The Checklist

In addition to stating the hard requirements, there are a bunch of things that we consider when assessing changes to the library. These soft requirements are helpful pointers of how to get a patch landed quicker and with less fuss.

### General QA Approach

The gocql team needs to consider the ongoing maintainability of the library at all times. Patches that look like they will introduce maintenance issues for the team will not be accepted.

Your patch will get merged quicker if you have decent test cases that provide test coverage for the new behavior you wish to introduce.

Unit tests are good, integration tests are even better. An example of a unit test is `marshal_test.go` - this tests the serialization code in isolation. `cassandra_test.go` is an integration test suite that is executed against every version of Cassandra that gocql supports as part of the CI process on Travis.

That said, the point of writing tests is to provide a safety net to catch regressions, so there is no need to go overboard with tests. Remember that the more tests you write, the more code we will have to maintain. So there's a balance to strike there.

### When It's Too Difficult To Automate Testing

There are legitimate examples of where it is infeasible to write a regression test for a change. Never fear, we will still consider the patch and quite possibly accept the change without a test. The gocql team takes a pragmatic approach to testing. At the end of the day, you could be addressing an issue that is too difficult to reproduce in a test suite, but still occurs in a real production app. In this case, your production app is the test case, and we will have to trust that your change is good.

Examples of pull requests that have been accepted without tests include:

* https://github.com/gocql/gocql/pull/181 - this patch would otherwise require a multi-node cluster to be booted as part of the CI build
* https://github.com/gocql/gocql/pull/179 - this bug can only be reproduced under heavy load in certain circumstances

### Sign Off Procedure

Generally speaking, a pull request can get merged by any one of the core gocql team. If your change is minor, chances are that one team member will just go ahead and merge it there and then. As stated earlier, suitable test coverage will increase the likelihood that a single reviewer will assess and merge your change. If your change has no test coverage, or looks like it may have wider implications for the health and stability of the library, the reviewer may elect to refer the change to another team member to achieve consensus before proceeding. Therefore, the tighter and cleaner your patch is, the quicker it will go through the review process.

### Supported Features

gocql is a low level wire driver for Cassandra CQL. By and large, we would like to keep the functional scope of the library as narrow as possible. We think that gocql should be tight and focused, and we will be naturally skeptical of things that could just as easily be implemented in a higher layer. Inevitably you will come across something that could be implemented in a higher layer, save for a minor change to the core API. In this instance, please strike up a conversation with the gocql team. Chances are we will understand what you are trying to achieve and will try to accommodate this in a maintainable way.

### Longer Term Evolution

There are some long term plans for gocql that have to be taken into account when assessing changes. That said, gocql is ultimately a community driven project and we don't have a massive development budget, so sometimes the long term view might need to be de-prioritized ahead of short term changes.

## Officially Supported Server Versions

Currently, the officially supported versions of the Cassandra server include:

* 1.2.18
* 2.0.9

Chances are that gocql will work with many other versions. If you would like us to support a particular version of Cassandra, please start a conversation about what version you'd like us to consider. We are more likely to accept a new version if you help out by extending the regression suite to cover the new version to be supported.

## The Core Dev Team

The core development team includes:

* tux21b
* phillipCouto
* Zariel
* 0x6e6562
