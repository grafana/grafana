// Copyright 2014 com authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package com

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestHexStr2int(t *testing.T) {
	Convey("Convert hex format string to decimal", t, func() {
		hexDecs := map[string]int{
			"1":   1,
			"002": 2,
			"011": 17,
			"0a1": 161,
			"35e": 862,
		}

		for hex, dec := range hexDecs {
			val, err := HexStr2int(hex)
			So(err, ShouldBeNil)
			So(val, ShouldEqual, dec)
		}
	})
}

func TestInt2HexStr(t *testing.T) {
	Convey("Convert decimal to hex format string", t, func() {
		decHexs := map[int]string{
			1:   "1",
			2:   "2",
			17:  "11",
			161: "a1",
			862: "35e",
		}

		for dec, hex := range decHexs {
			val := Int2HexStr(dec)
			So(val, ShouldEqual, hex)
		}
	})
}
