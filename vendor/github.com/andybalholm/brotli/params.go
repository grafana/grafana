package brotli

/* Copyright 2017 Google Inc. All Rights Reserved.

   Distributed under MIT license.
   See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
*/

/* Parameters for the Brotli encoder with chosen quality levels. */
type hasherParams struct {
	type_                       int
	bucket_bits                 int
	block_bits                  int
	hash_len                    int
	num_last_distances_to_check int
}

type distanceParams struct {
	distance_postfix_bits     uint32
	num_direct_distance_codes uint32
	alphabet_size             uint32
	max_distance              uint
}

/* Encoding parameters */
type encoderParams struct {
	mode                             int
	quality                          int
	lgwin                            uint
	lgblock                          int
	size_hint                        uint
	disable_literal_context_modeling bool
	large_window                     bool
	hasher                           hasherParams
	dist                             distanceParams
	dictionary                       encoderDictionary
}
