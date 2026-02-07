package brotli

const fastOnePassCompressionQuality = 0

const fastTwoPassCompressionQuality = 1

const zopflificationQuality = 10

const hqZopflificationQuality = 11

const maxQualityForStaticEntropyCodes = 2

const minQualityForBlockSplit = 4

const minQualityForNonzeroDistanceParams = 4

const minQualityForOptimizeHistograms = 4

const minQualityForExtensiveReferenceSearch = 5

const minQualityForContextModeling = 5

const minQualityForHqContextModeling = 7

const minQualityForHqBlockSplitting = 10

/* For quality below MIN_QUALITY_FOR_BLOCK_SPLIT there is no block splitting,
   so we buffer at most this much literals and commands. */
const maxNumDelayedSymbols = 0x2FFF

/* Returns hash-table size for quality levels 0 and 1. */
func maxHashTableSize(quality int) uint {
	if quality == fastOnePassCompressionQuality {
		return 1 << 15
	} else {
		return 1 << 17
	}
}

/* The maximum length for which the zopflification uses distinct distances. */
const maxZopfliLenQuality10 = 150

const maxZopfliLenQuality11 = 325

/* Do not thoroughly search when a long copy is found. */
const longCopyQuickStep = 16384

func maxZopfliLen(params *encoderParams) uint {
	if params.quality <= 10 {
		return maxZopfliLenQuality10
	} else {
		return maxZopfliLenQuality11
	}
}

/* Number of best candidates to evaluate to expand Zopfli chain. */
func maxZopfliCandidates(params *encoderParams) uint {
	if params.quality <= 10 {
		return 1
	} else {
		return 5
	}
}

func sanitizeParams(params *encoderParams) {
	params.quality = brotli_min_int(maxQuality, brotli_max_int(minQuality, params.quality))
	if params.quality <= maxQualityForStaticEntropyCodes {
		params.large_window = false
	}

	if params.lgwin < minWindowBits {
		params.lgwin = minWindowBits
	} else {
		var max_lgwin int
		if params.large_window {
			max_lgwin = largeMaxWindowBits
		} else {
			max_lgwin = maxWindowBits
		}
		if params.lgwin > uint(max_lgwin) {
			params.lgwin = uint(max_lgwin)
		}
	}
}

/* Returns optimized lg_block value. */
func computeLgBlock(params *encoderParams) int {
	var lgblock int = params.lgblock
	if params.quality == fastOnePassCompressionQuality || params.quality == fastTwoPassCompressionQuality {
		lgblock = int(params.lgwin)
	} else if params.quality < minQualityForBlockSplit {
		lgblock = 14
	} else if lgblock == 0 {
		lgblock = 16
		if params.quality >= 9 && params.lgwin > uint(lgblock) {
			lgblock = brotli_min_int(18, int(params.lgwin))
		}
	} else {
		lgblock = brotli_min_int(maxInputBlockBits, brotli_max_int(minInputBlockBits, lgblock))
	}

	return lgblock
}

/* Returns log2 of the size of main ring buffer area.
   Allocate at least lgwin + 1 bits for the ring buffer so that the newly
   added block fits there completely and we still get lgwin bits and at least
   read_block_size_bits + 1 bits because the copy tail length needs to be
   smaller than ring-buffer size. */
func computeRbBits(params *encoderParams) int {
	return 1 + brotli_max_int(int(params.lgwin), params.lgblock)
}

func maxMetablockSize(params *encoderParams) uint {
	var bits int = brotli_min_int(computeRbBits(params), maxInputBlockBits)
	return uint(1) << uint(bits)
}

/* When searching for backward references and have not seen matches for a long
   time, we can skip some match lookups. Unsuccessful match lookups are very
   expensive and this kind of a heuristic speeds up compression quite a lot.
   At first 8 byte strides are taken and every second byte is put to hasher.
   After 4x more literals stride by 16 bytes, every put 4-th byte to hasher.
   Applied only to qualities 2 to 9. */
func literalSpreeLengthForSparseSearch(params *encoderParams) uint {
	if params.quality < 9 {
		return 64
	} else {
		return 512
	}
}

func chooseHasher(params *encoderParams, hparams *hasherParams) {
	if params.quality > 9 {
		hparams.type_ = 10
	} else if params.quality == 4 && params.size_hint >= 1<<20 {
		hparams.type_ = 54
	} else if params.quality < 5 {
		hparams.type_ = params.quality
	} else if params.lgwin <= 16 {
		if params.quality < 7 {
			hparams.type_ = 40
		} else if params.quality < 9 {
			hparams.type_ = 41
		} else {
			hparams.type_ = 42
		}
	} else if params.size_hint >= 1<<20 && params.lgwin >= 19 {
		hparams.type_ = 6
		hparams.block_bits = params.quality - 1
		hparams.bucket_bits = 15
		hparams.hash_len = 5
		if params.quality < 7 {
			hparams.num_last_distances_to_check = 4
		} else if params.quality < 9 {
			hparams.num_last_distances_to_check = 10
		} else {
			hparams.num_last_distances_to_check = 16
		}
	} else {
		hparams.type_ = 5
		hparams.block_bits = params.quality - 1
		if params.quality < 7 {
			hparams.bucket_bits = 14
		} else {
			hparams.bucket_bits = 15
		}
		if params.quality < 7 {
			hparams.num_last_distances_to_check = 4
		} else if params.quality < 9 {
			hparams.num_last_distances_to_check = 10
		} else {
			hparams.num_last_distances_to_check = 16
		}
	}

	if params.lgwin > 24 {
		/* Different hashers for large window brotli: not for qualities <= 2,
		   these are too fast for large window. Not for qualities >= 10: their
		   hasher already works well with large window. So the changes are:
		   H3 --> H35: for quality 3.
		   H54 --> H55: for quality 4 with size hint > 1MB
		   H6 --> H65: for qualities 5, 6, 7, 8, 9. */
		if hparams.type_ == 3 {
			hparams.type_ = 35
		}

		if hparams.type_ == 54 {
			hparams.type_ = 55
		}

		if hparams.type_ == 6 {
			hparams.type_ = 65
		}
	}
}
