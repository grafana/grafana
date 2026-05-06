//  Copyright (c) 2014 Couchbase, Inc.
//  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
//  except in compliance with the License. You may obtain a copy of the License at
//    http://www.apache.org/licenses/LICENSE-2.0
//  Unless required by applicable law or agreed to in writing, software distributed under the
//  License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
//  either express or implied. See the License for the specific language governing permissions
//  and limitations under the License.

/*
Package segment is a library for performing Unicode Text Segmentation
as described in Unicode Standard Annex #29 http://www.unicode.org/reports/tr29/

Currently only segmentation at Word Boundaries is supported.

The functionality is exposed in two ways:

1.  You can use a bufio.Scanner with the SplitWords implementation of SplitFunc.
The SplitWords function will identify the appropriate word boundaries in the input
text and the Scanner will return tokens at the appropriate place.

		scanner := bufio.NewScanner(...)
		scanner.Split(segment.SplitWords)
		for scanner.Scan() {
			tokenBytes := scanner.Bytes()
		}
		if err := scanner.Err(); err != nil {
			t.Fatal(err)
		}

2.  Sometimes you would also like information returned about the type of token.
To do this we have introduce a new type named Segmenter.  It works just like Scanner
but additionally a token type is returned.

		segmenter := segment.NewWordSegmenter(...)
		for segmenter.Segment() {
			tokenBytes := segmenter.Bytes())
			tokenType := segmenter.Type()
		}
		if err := segmenter.Err(); err != nil {
			t.Fatal(err)
		}

*/
package segment
