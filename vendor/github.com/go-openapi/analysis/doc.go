// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

/*
Package analysis provides methods to work with a Swagger specification document from
package go-openapi/spec.

## Analyzing a specification

An analysed specification object (type Spec) provides methods to work with swagger definition.

## Flattening or expanding a specification

Flattening a specification bundles all remote $ref in the main spec document.
Depending on flattening options, additional preprocessing may take place:
  - full flattening: replacing all inline complex constructs by a named entry in #/definitions
  - expand: replace all $ref's in the document by their expanded content

## Merging several specifications

Mixin several specifications merges all Swagger constructs, and warns about found conflicts.

## Fixing a specification

Unmarshalling a specification with golang json unmarshalling may lead to
some unwanted result on present but empty fields.

## Analyzing a Swagger schema

Swagger schemas are analyzed to determine their complexity and qualify their content.
*/
package analysis
