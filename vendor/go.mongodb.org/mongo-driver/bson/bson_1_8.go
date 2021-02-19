// Copyright (C) MongoDB, Inc. 2017-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

// +build !go1.9

package bson // import "go.mongodb.org/mongo-driver/bson"

import (
	"math"
	"strconv"
	"strings"
)

// Zeroer allows custom struct types to implement a report of zero
// state. All struct types that don't implement Zeroer or where IsZero
// returns false are considered to be not zero.
type Zeroer interface {
	IsZero() bool
}

// D is an ordered representation of a BSON document. This type should be used when the order of the elements matters,
// such as MongoDB command documents. If the order of the elements does not matter, an M should be used instead.
//
// Example usage:
//
// 		bson.D{{"foo", "bar"}, {"hello", "world"}, {"pi", 3.14159}}
type D []E

// Map creates a map from the elements of the D.
func (d D) Map() M {
	m := make(M, len(d))
	for _, e := range d {
		m[e.Key] = e.Value
	}
	return m
}

// E represents a BSON element for a D. It is usually used inside a D.
type E struct {
	Key   string
	Value interface{}
}

// M is an unordered representation of a BSON document. This type should be used when the order of the elements does not
// matter. This type is handled as a regular map[string]interface{} when encoding and decoding. Elements will be
// serialized in an undefined, random order. If the order of the elements matters, a D should be used instead.
//
// Example usage:
//
// 		bson.M{"foo": "bar", "hello": "world", "pi": 3.14159}
type M map[string]interface{}

// An A is an ordered representation of a BSON array.
//
// Example usage:
//
// 		bson.A{"bar", "world", 3.14159, bson.D{{"qux", 12345}}}
type A []interface{}

func formatDouble(f float64) string {
	var s string
	if math.IsInf(f, 1) {
		s = "Infinity"
	} else if math.IsInf(f, -1) {
		s = "-Infinity"
	} else if math.IsNaN(f) {
		s = "NaN"
	} else {
		// Print exactly one decimalType place for integers; otherwise, print as many are necessary to
		// perfectly represent it.
		s = strconv.FormatFloat(f, 'G', -1, 64)
		if !strings.ContainsRune(s, '.') {
			s += ".0"
		}
	}

	return s
}
