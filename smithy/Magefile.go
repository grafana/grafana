//go:build mage

package main

import (
	"os"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

// Build builds the default targets.
func Build() {
	mg.Deps(Smithy, HTMLDocs)
}

// Smithy builds Smithy targets.
//
// This generates OpenAPI spec and Go client code in build/openapi and build/go/grafana, respectively.
func Smithy() error {
	if err := sh.RunV("./gradlew", "build"); err != nil {
		return err
	}
	if err := os.RemoveAll("build/go"); err != nil {
		return err
	}
	if err := os.MkdirAll("build/go", 0755); err != nil {
		return err
	}
	if err := sh.RunV("cp", "-r", "sdk-codegen/build/smithyprojections/sdk-codegen/source/go-codegen", "build/go/grafana"); err != nil {
		return err
	}
	if err := sh.RunV("cp", "-r", "sdk-codegen/build/smithyprojections/sdk-codegen/source/openapi", "build/openapi"); err != nil {
		return err
	}

	return nil
}

// HTMLDocs builds API documentation.
//
// Requires openapi-generator to be installed. Generates OpenAPI based API docs in build/html/index.html.
func HTMLDocs() error {
	mg.Deps(Smithy)
	if err := sh.RunV("openapi-generator", "generate", "-o", "build/html", "-g", "html2", "-i",
		"build/openapi/Grafana.openapi.json"); err != nil {
		return err
	}

	return nil
}

var Default = Build
