import software.amazon.smithy.model.Model
import software.amazon.smithy.model.node.Node
import software.amazon.smithy.model.shapes.ServiceShape
import software.amazon.smithy.gradle.tasks.SmithyBuild
import software.amazon.smithy.aws.traits.ServiceTrait
import kotlin.streams.toList

buildscript {
    dependencies {
        "classpath"("software.amazon.smithy:smithy-aws-traits:[1.13.1,2.0.0[")
    }
}

plugins {
    id("software.amazon.smithy") version "0.6.0"
}

dependencies {
    implementation(project(":smithy-grafana-go-codegen"))
}

// This project doesn't produce a JAR.
tasks["jar"].enabled = false

// Run the SmithyBuild task manually since this project needs the built JAR
// from smithy-grafana-go-codegen.
tasks["smithyBuildJar"].enabled = false

tasks.create<SmithyBuild>("buildSdk") {
    addRuntimeClasspath = true
}


// Run the `buildSdk` automatically.
tasks["build"].finalizedBy(tasks["buildSdk"])

/*
// ensure built artifacts are put into the SDK's folders
tasks.create<Exec>("copyGoCodegen") {
    dependsOn ("buildSdk")
    commandLine ("$rootDir/copy_go_codegen.sh", "$rootDir/..", (tasks["buildSdk"] as SmithyBuild).outputDirectory.absolutePath)
}
tasks["buildSdk"].finalizedBy(tasks["copyGoCodegen"])
*/
