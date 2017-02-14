# How to contribute

Elastic is an open-source project and we are looking forward to each
contribution.

Notice that while the [official Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html) is rather good, it is a high-level
overview of the features of Elasticsearch. However, Elastic tries to resemble
the Java API of Elasticsearch which you can find [on GitHub](https://github.com/elastic/elasticsearch).

This explains why you might think that some options are strange or missing
in Elastic, while often they're just different. Please check the Java API first.

Having said that: Elasticsearch is moving fast and it might be very likely
that we missed some features or changes. Feel free to change that.

## Your Pull Request

To make it easy to review and understand your changes, please keep the
following things in mind before submitting your pull request:

* You compared the existing implemenation with the Java API, did you?
* Please work on the latest possible state of `olivere/elastic`.
  Use `release-branch.v2` for targeting Elasticsearch 1.x and
  `release-branch.v3` for targeting 2.x.
* Create a branch dedicated to your change.
* If possible, write a test case which confirms your change.
* Make sure your changes and your tests work with all recent versions of
  Elasticsearch. We currently support Elasticsearch 1.7.x in the
  release-branch.v2 and Elasticsearch 2.x in the release-branch.v3.
* Test your changes before creating a pull request (`go test ./...`).
* Don't mix several features or bug fixes in one pull request.
* Create a meaningful commit message.
* Explain your change, e.g. provide a link to the issue you are fixing and
  probably a link to the Elasticsearch documentation and/or source code.
* Format your source with `go fmt`.

## Additional Resources

* [GitHub documentation](http://help.github.com/)
* [GitHub pull request documentation](http://help.github.com/send-pull-requests/)
