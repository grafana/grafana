# Grafana Smithy models
This directory contains [Smithy](https://awslabs.github.io/smithy/) models of Grafana's HTTP API, and logic for 
generating OpenAPI spec/docs and Go client code. The plan is to also generate server side code in the future,
but Smithy's Go plugin doesn't yet support it.

## Models

The models themselves are defined in _model/*.smithy_.

## Building
To build this project you need [Mage](https://magefile.org/). Then you can build all the targets (beneath build/) as 
follows:

```
$ mage
```

The build targets and corresponding logic are defined in Magefile.go.

Under the hood, Mage will call out to the Java based [Gradle](https://gradle.org/) build tool. You won't have 
to install Gradle yourself though, since it's executed through a wrapper (`./gradlew`) that first installs Gradle.
It's necessary to use Gradle due to Smithy's tight binding to it; it's supposedly possible to use Smithy without
Gradle, but from asking the Smithy developers it sounds like way more work than it's worth. Hopefully, this binding
will become looser in the future.

Gradle's build logic is configured in build.gradle.kts, which is written in the Kotlin language. It mostly defines
which version to use of the Smithy Gradle plugin and which libraries to depend on (significantly, `smithy-go-codegen`
and `smithy-openapi`).

Smithy itself is configured through _smithy-build.json_, which mostly has directives for the Go and OpenAPI plugins.

### OpenAPI spec/docs
To generate the OpenAPI spec and HTML format docs, you can either use the default Mage target (as outlined in the
parent section) or be more specific:

```
$ mage htmldocs
```

The OpenAPI spec will be in _smithy/build/smithyprojections/smithy/source/openapi/Grafana.openapi.json_ and 
the HTML docs in _build/html/index.html_.

### Go code
To generate Go client code (server code should be possible as well in the future), you can either use the default Mage
target (as outlined in the parent section) or be more specific:

```
$ mage smithy
```

The Go client module will be in _smithy/build/smithyprojections/smithy/source/go-codegen_.

Generating Go code is made possible by the [Smithy Go](https://github.com/aws/smithy-go) plugin, which is at the time
of writing only at version 0.1.0 and not yet Generally Available. As such, it's very poorly documented and difficult
to familiarize oneself with.
