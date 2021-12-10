tasks["jar"].enabled = false

plugins {
    `java-library`
    id("software.amazon.smithy").version("0.6.0")
}

repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    api("software.amazon.smithy:smithy-model:[1.0, 2.0[")
    api("software.amazon.smithy.go:smithy-go-codegen:[0.1.0, 2.0[")
    api("software.amazon.smithy:smithy-openapi:[1.0, 2.0[")
    api("software.amazon.smithy:smithy-aws-traits:[1.14, 2.0[")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}
