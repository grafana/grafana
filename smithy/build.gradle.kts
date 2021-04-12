tasks["jar"].enabled = false

plugins {
    id("software.amazon.smithy").version("0.5.2")
}

repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    implementation("software.amazon.smithy:smithy-model:[1.0, 2.0[")
    implementation("software.amazon.smithy:smithy-go-codegen:0.1.0")
    implementation("software.amazon.smithy:smithy-openapi:[1.0, 2.0[")
    implementation("software.amazon.smithy:smithy-aws-traits:[1.0, 2.0[")
}
