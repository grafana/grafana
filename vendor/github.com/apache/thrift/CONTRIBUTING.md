## How to contribute
 1. Help to review and verify existing patches
 1. Make sure your issue is not all ready in the [Jira issue tracker](http://issues.apache.org/jira/browse/THRIFT)
 1. If not, create a ticket describing the change you're proposing in the [Jira issue tracker](http://issues.apache.org/jira/browse/THRIFT)
 1. Contribute your patch using one of the two methods below

### Contributing via a patch

1. Check out the latest version of the source code

  * git clone https://git-wip-us.apache.org/repos/asf/thrift.git thrift

1. Modify the source to include the improvement/bugfix

  * Remember to provide *tests* for all submited changes
  * When bugfixing: add test that will isolate bug *before* applying change that fixes it
  * Verify that you follow [Thrift Coding Standards](/docs/coding_standards) (you can run 'make style', which ensures proper format for some languages)

1. Create a patch from project root directory (e.g. you@dev:~/thrift $ ):

  * git diff > ../thrift-XXX-my-new-feature.patch

1. Attach the newly generated patch to the issue
1. Wait for other contributors or committers to review your new addition
1. Wait for a committer to commit your patch

### Contributing via GitHub pull requests

1. Create a fork for http://github.com/apache/thrift
1. Create a branch for your changes(best practice is issue as branch name, e.g. THRIFT-9999)
1. Modify the source to include the improvement/bugfix

  * Remember to provide *tests* for all submited changes
  * When bugfixing: add test that will isolate bug *before* applying change that fixes it
  * Verify that you follow [Thrift Coding Standards](/docs/coding_standards) (you can run 'make style', which ensures proper format for some languages)
  * Verify that your change works on other platforms by adding a GitHub service hook to [Travis CI](http://docs.travis-ci.com/user/getting-started/#Step-one%3A-Sign-in) and [AppVeyor](http://www.appveyor.com/docs)

1. Commit and push changes to your branch (please use issue name and description as commit title, e.g. THRIFT-9999 make it perfect)
1. Issue a pull request with the jira ticket number you are working on in it's name
1. Wait for other contributors or committers to review your new addition
1. Wait for a committer to commit your patch

### More info

 Plenty of information on why and how to contribute is available on the Apache Software Foundation (ASF) web site. In particular, we recommend the following:

 * [Contributors Tech Guide](http://www.apache.org/dev/contributors)
 * [Get involved!](http://www.apache.org/foundation/getinvolved.html)
 * [Legal aspects on Submission of Contributions (Patches)](http://www.apache.org/licenses/LICENSE-2.0.html#contributions)
