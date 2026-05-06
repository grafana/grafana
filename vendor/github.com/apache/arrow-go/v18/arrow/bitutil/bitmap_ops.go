// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bitutil

func alignedBitAndGo(left, right, out []byte) {
	var (
		nbytes = len(out)
		i      = 0
	)
	if nbytes > uint64SizeBytes {
		// case where we have enough bytes to operate on words
		leftWords := bytesToUint64(left[i:])
		rightWords := bytesToUint64(right[i:])
		outWords := bytesToUint64(out[i:])

		for w := range outWords {
			outWords[w] = leftWords[w] & rightWords[w]
		}

		i += len(outWords) * uint64SizeBytes
	}
	// grab any remaining bytes that were fewer than a word
	for ; i < nbytes; i++ {
		out[i] = left[i] & right[i]
	}
}

func alignedBitAndNotGo(left, right, out []byte) {
	var (
		nbytes = len(out)
		i      = 0
	)
	if nbytes > uint64SizeBytes {
		// case where we have enough bytes to operate on words
		leftWords := bytesToUint64(left[i:])
		rightWords := bytesToUint64(right[i:])
		outWords := bytesToUint64(out[i:])

		for w := range outWords {
			outWords[w] = leftWords[w] &^ rightWords[w]
		}

		i += len(outWords) * uint64SizeBytes
	}
	// grab any remaining bytes that were fewer than a word
	for ; i < nbytes; i++ {
		out[i] = left[i] &^ right[i]
	}
}

func alignedBitOrGo(left, right, out []byte) {
	var (
		nbytes = len(out)
		i      = 0
	)
	if nbytes > uint64SizeBytes {
		// case where we have enough bytes to operate on words
		leftWords := bytesToUint64(left[i:])
		rightWords := bytesToUint64(right[i:])
		outWords := bytesToUint64(out[i:])

		for w := range outWords {
			outWords[w] = leftWords[w] | rightWords[w]
		}

		i += len(outWords) * uint64SizeBytes
	}
	// grab any remaining bytes that were fewer than a word
	for ; i < nbytes; i++ {
		out[i] = left[i] | right[i]
	}
}

func alignedBitXorGo(left, right, out []byte) {
	var (
		nbytes = len(out)
		i      = 0
	)
	if nbytes > uint64SizeBytes {
		// case where we have enough bytes to operate on words
		leftWords := bytesToUint64(left[i:])
		rightWords := bytesToUint64(right[i:])
		outWords := bytesToUint64(out[i:])

		for w := range outWords {
			outWords[w] = leftWords[w] ^ rightWords[w]
		}

		i += len(outWords) * uint64SizeBytes
	}
	// grab any remaining bytes that were fewer than a word
	for ; i < nbytes; i++ {
		out[i] = left[i] ^ right[i]
	}
}
