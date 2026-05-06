// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

// Package hcl contains the main modelling types and general utility functions
// for HCL.
//
// For a simple entry point into HCL, see the package in the subdirectory
// "hclsimple", which has an opinionated function Decode that can decode HCL
// configurations in either native HCL syntax or JSON syntax into a Go struct
// type:
//
//     package main
//
//     import (
//     	"log"
//     	"github.com/hashicorp/hcl/v2/hclsimple"
//     )
//
//     type Config struct {
//     	LogLevel string `hcl:"log_level"`
//     }
//
//     func main() {
//     	var config Config
//     	err := hclsimple.DecodeFile("config.hcl", nil, &config)
//     	if err != nil {
//     		log.Fatalf("Failed to load configuration: %s", err)
//     	}
//     	log.Printf("Configuration is %#v", config)
//     }
//
// If your application needs more control over the evaluation of the
// configuration, you can use the functions in the subdirectories hclparse,
// gohcl, hcldec, etc. Splitting the handling of configuration into multiple
// phases allows for advanced patterns such as allowing expressions in one
// part of the configuration to refer to data defined in another part.
package hcl
