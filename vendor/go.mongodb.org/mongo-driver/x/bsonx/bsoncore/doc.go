// Copyright (C) MongoDB, Inc. 2022-present.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

// Package bsoncore is intended for internal use only. It is made available to
// facilitate use cases that require access to internal MongoDB driver
// functionality and state. The API of this package is not stable and there is
// no backward compatibility guarantee.
//
// WARNING: THIS PACKAGE IS EXPERIMENTAL AND MAY BE MODIFIED OR REMOVED WITHOUT
// NOTICE! USE WITH EXTREME CAUTION!
//
// Package bsoncore contains functions that can be used to encode and decode
// BSON elements and values to or from a slice of bytes. These functions are
// aimed at allowing low level manipulation of BSON and can be used to build a
// higher level BSON library.
//
// The Read* functions within this package return the values of the element and
// a boolean indicating if the values are valid. A boolean was used instead of
// an error because any error that would be returned would be the same: not
// enough bytes. This library attempts to do no validation, it will only return
// false if there are not enough bytes for an item to be read. For example, the
// ReadDocument function checks the length, if that length is larger than the
// number of bytes available, it will return false, if there are enough bytes,
// it will return those bytes and true. It is the consumers responsibility to
// validate those bytes.
//
// The Append* functions within this package will append the type value to the
// given dst slice. If the slice has enough capacity, it will not grow the
// slice. The Append*Element functions within this package operate in the same
// way, but additionally append the BSON type and the key before the value.
package bsoncore
