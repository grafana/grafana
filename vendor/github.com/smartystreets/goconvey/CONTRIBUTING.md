# Subject: GoConvey maintainers wanted

We'd like to open the project up to additional maintainers who want to move the project forward in a meaningful way.

We've spent significant time at SmartyStreets building GoConvey and it has perfectly met (and exceeded) all of our initial design specifications. We've used it to great effect. Being so well-matched to our development workflows at SmartyStreets, we haven't had a need to hack on it lately. This had been frustrating to many in the community who have ideas for the project and would like to see new features released (and some old bugs fixed). The release of Go 1.5 and the new vendoring experiment has been a source of confusion and hassle for those who have already upgraded and find that GoConvey needs to be brought up to speed.

GoConvey is a popular 2-pronged, open-source github project (1,600+ stargazers, 100+ forks):

- A package you import in your test code that allows you to write BDD-style tests.
- An executable that runs a local web server which displays auto-updating test results in a web browser.

----

- http://goconvey.co/
- https://github.com/smartystreets/goconvey
- https://github.com/smartystreets/goconvey/wiki

_I should mention that the [assertions package](https://github.com/smartystreets/assertions) imported by the convey package is used by other projects at SmartyStreets and so we will be continuing to maintain that project internally._

We hope to hear from you soon. Thanks!

---

# Contributing

In general, the code posted to the [SmartyStreets github organization](https://github.com/smartystreets) is created to solve specific problems at SmartyStreets that are ancillary to our core products in the address verification industry and may or may not be useful to other organizations or developers. Our reason for posting said code isn't necessarily to solicit feedback or contributions from the community but more as a showcase of some of the approaches to solving problems we have adopted.

Having stated that, we do consider issues raised by other githubbers as well as contributions submitted via pull requests. When submitting such a pull request, please follow these guidelines:

- _Look before you leap:_ If the changes you plan to make are significant, it's in everyone's best interest for you to discuss them with a SmartyStreets team member prior to opening a pull request.
- _License and ownership:_ If modifying the `LICENSE.md` file, limit your changes to fixing typographical mistakes. Do NOT modify the actual terms in the license or the copyright by **SmartyStreets, LLC**. Code submitted to SmartyStreets projects becomes property of SmartyStreets and must be compatible with the associated license.
- _Testing:_ If the code you are submitting resides in packages/modules covered by automated tests, be sure to add passing tests that cover your changes and assert expected behavior and state. Submit the additional test cases as part of your change set.
- _Style:_ Match your approach to **naming** and **formatting** with the surrounding code. Basically, the code you submit shouldn't stand out.
  - "Naming" refers to such constructs as variables, methods, functions, classes, structs, interfaces, packages, modules, directories, files, etc...
  - "Formatting" refers to such constructs as whitespace, horizontal line length, vertical function length, vertical file length, indentation, curly braces, etc...
