//  Copyright (c) 2019 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// This implementation is inspired from the geohash-js
// ref: https://github.com/davetroy/geohash-js

package geo

// encoding encapsulates an encoding defined by a given base32 alphabet.
type encoding struct {
	enc string
	dec [256]byte
}

// newEncoding constructs a new encoding defined by the given alphabet,
// which must be a 32-byte string.
func newEncoding(encoder string) *encoding {
	e := new(encoding)
	e.enc = encoder
	for i := 0; i < len(e.dec); i++ {
		e.dec[i] = 0xff
	}
	for i := 0; i < len(encoder); i++ {
		e.dec[encoder[i]] = byte(i)
	}
	return e
}

// base32encoding with the Geohash alphabet.
var base32encoding = newEncoding("0123456789bcdefghjkmnpqrstuvwxyz")

var masks = []uint64{16, 8, 4, 2, 1}

// DecodeGeoHash decodes the string geohash faster with
// higher precision. This api is in experimental phase.
func DecodeGeoHash(geoHash string) (float64, float64) {
	even := true
	lat := []float64{-90.0, 90.0}
	lon := []float64{-180.0, 180.0}

	for i := 0; i < len(geoHash); i++ {
		cd := uint64(base32encoding.dec[geoHash[i]])
		for j := 0; j < 5; j++ {
			if even {
				if cd&masks[j] > 0 {
					lon[0] = (lon[0] + lon[1]) / 2
				} else {
					lon[1] = (lon[0] + lon[1]) / 2
				}
			} else {
				if cd&masks[j] > 0 {
					lat[0] = (lat[0] + lat[1]) / 2
				} else {
					lat[1] = (lat[0] + lat[1]) / 2
				}
			}
			even = !even
		}
	}

	return (lat[0] + lat[1]) / 2, (lon[0] + lon[1]) / 2
}

func EncodeGeoHash(lat, lon float64) string {
	even := true
	lats := []float64{-90.0, 90.0}
	lons := []float64{-180.0, 180.0}
	precision := 12
	var ch, bit uint64
	var geoHash string

	for len(geoHash) < precision {
		if even {
			mid := (lons[0] + lons[1]) / 2
			if lon > mid {
				ch |= masks[bit]
				lons[0] = mid
			} else {
				lons[1] = mid
			}
		} else {
			mid := (lats[0] + lats[1]) / 2
			if lat > mid {
				ch |= masks[bit]
				lats[0] = mid
			} else {
				lats[1] = mid
			}
		}
		even = !even
		if bit < 4 {
			bit++
		} else {
			geoHash += string(base32encoding.enc[ch])
			ch = 0
			bit = 0
		}
	}

	return geoHash
}
