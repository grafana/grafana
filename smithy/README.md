# Grafana Smithy models

This directory contains [Smithy](https://awslabs.github.io/smithy/) models of Grafana's HTTP API, and logic for
generating OpenAPI spec/docs and Go client code. The plan is to also generate server side code in the future,
but Smithy's Go plugin doesn't yet support it.

## Models

The models themselves are defined in _model/\*.smithy_.

## Building

To build this project you need the following software installed:

- [Mage](https://magefile.org/)
- JDK v17
- [openapi-generator](https://github.com/OpenAPITools/openapi-generator)

Additionally, you need to publish the [smithy-go](https://github.com/aws/smithy-go) Smithy plugin locally:

```console
$ cd smithy-go/codegen
$ ./gradlew publishToMavenLocal
```

It's necessary to publish this locally yourself since it's not published by the authors at the current time.

Then, go back to the directory of this README and build all the targets (beneath build/) as
follows:

```console
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

The OpenAPI spec will be in _build/smithyprojections/smithy/source/openapi/Grafana.openapi.json_ and
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

## Reference

The Smithy Go plugin's entry point is the `GoCodeGenPlugin.execute` method. It uses `GoIntegration` JVM classes to
provide extension points:

- Pre-processing
- Post-processing
- Provide runtime plugins
- Decorate the symbol provider
- Provide the protocol generator
