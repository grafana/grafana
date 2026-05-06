// Copyright 2023 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// THIS FILE IS GENERATED. DO NOT EDIT BY HAND.

package encodings

import (
	_ "embed"
	"encoding/binary"
	"sync"
)

func loadWeightsMap(m map[rune]int32, bin []byte) {
	for i := 0; i < len(bin); i += 8 {
		m[rune(binary.BigEndian.Uint32(bin[i:]))] = int32(binary.BigEndian.Uint32(bin[i+4:]))
	}
}

//go:embed common_utf8mb4_es_0900_ai_ci_Weights.bin
var common_utf8mb4_es_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf8mb4_es_0900_ai_ci_Weights_map = make(map[rune]int32)
var common_utf8mb4_es_0900_ai_ci_Weights_once sync.Once

func common_utf8mb4_es_0900_ai_ci_Weights() map[rune]int32 {
	common_utf8mb4_es_0900_ai_ci_Weights_once.Do(func() {
		loadWeightsMap(common_utf8mb4_es_0900_ai_ci_Weights_map, common_utf8mb4_es_0900_ai_ci_Weights_bin)
	})
	return common_utf8mb4_es_0900_ai_ci_Weights_map
}

//go:embed common_utf8mb4_es_0900_as_cs_Weights.bin
var common_utf8mb4_es_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var common_utf8mb4_es_0900_as_cs_Weights_map = make(map[rune]int32)
var common_utf8mb4_es_0900_as_cs_Weights_once sync.Once

func common_utf8mb4_es_0900_as_cs_Weights() map[rune]int32 {
	common_utf8mb4_es_0900_as_cs_Weights_once.Do(func() {
		loadWeightsMap(common_utf8mb4_es_0900_as_cs_Weights_map, common_utf8mb4_es_0900_as_cs_Weights_bin)
	})
	return common_utf8mb4_es_0900_as_cs_Weights_map
}

//go:embed common_utf_croatian_ci_Weights.bin
var common_utf_croatian_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_croatian_ci_Weights_map = make(map[rune]int32)
var common_utf_croatian_ci_Weights_once sync.Once

func common_utf_croatian_ci_Weights() map[rune]int32 {
	common_utf_croatian_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_croatian_ci_Weights_map, common_utf_croatian_ci_Weights_bin) })
	return common_utf_croatian_ci_Weights_map
}

//go:embed common_utf_czech_ci_Weights.bin
var common_utf_czech_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_czech_ci_Weights_map = make(map[rune]int32)
var common_utf_czech_ci_Weights_once sync.Once

func common_utf_czech_ci_Weights() map[rune]int32 {
	common_utf_czech_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_czech_ci_Weights_map, common_utf_czech_ci_Weights_bin) })
	return common_utf_czech_ci_Weights_map
}

//go:embed common_utf_danish_ci_Weights.bin
var common_utf_danish_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_danish_ci_Weights_map = make(map[rune]int32)
var common_utf_danish_ci_Weights_once sync.Once

func common_utf_danish_ci_Weights() map[rune]int32 {
	common_utf_danish_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_danish_ci_Weights_map, common_utf_danish_ci_Weights_bin) })
	return common_utf_danish_ci_Weights_map
}

//go:embed common_utf_esperanto_ci_Weights.bin
var common_utf_esperanto_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_esperanto_ci_Weights_map = make(map[rune]int32)
var common_utf_esperanto_ci_Weights_once sync.Once

func common_utf_esperanto_ci_Weights() map[rune]int32 {
	common_utf_esperanto_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_esperanto_ci_Weights_map, common_utf_esperanto_ci_Weights_bin) })
	return common_utf_esperanto_ci_Weights_map
}

//go:embed common_utf_estonian_ci_Weights.bin
var common_utf_estonian_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_estonian_ci_Weights_map = make(map[rune]int32)
var common_utf_estonian_ci_Weights_once sync.Once

func common_utf_estonian_ci_Weights() map[rune]int32 {
	common_utf_estonian_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_estonian_ci_Weights_map, common_utf_estonian_ci_Weights_bin) })
	return common_utf_estonian_ci_Weights_map
}

//go:embed common_utf_german2_ci_Weights.bin
var common_utf_german2_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_german2_ci_Weights_map = make(map[rune]int32)
var common_utf_german2_ci_Weights_once sync.Once

func common_utf_german2_ci_Weights() map[rune]int32 {
	common_utf_german2_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_german2_ci_Weights_map, common_utf_german2_ci_Weights_bin) })
	return common_utf_german2_ci_Weights_map
}

//go:embed common_utf_hungarian_ci_Weights.bin
var common_utf_hungarian_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_hungarian_ci_Weights_map = make(map[rune]int32)
var common_utf_hungarian_ci_Weights_once sync.Once

func common_utf_hungarian_ci_Weights() map[rune]int32 {
	common_utf_hungarian_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_hungarian_ci_Weights_map, common_utf_hungarian_ci_Weights_bin) })
	return common_utf_hungarian_ci_Weights_map
}

//go:embed common_utf_icelandic_ci_Weights.bin
var common_utf_icelandic_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_icelandic_ci_Weights_map = make(map[rune]int32)
var common_utf_icelandic_ci_Weights_once sync.Once

func common_utf_icelandic_ci_Weights() map[rune]int32 {
	common_utf_icelandic_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_icelandic_ci_Weights_map, common_utf_icelandic_ci_Weights_bin) })
	return common_utf_icelandic_ci_Weights_map
}

//go:embed common_utf_latvian_ci_Weights.bin
var common_utf_latvian_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_latvian_ci_Weights_map = make(map[rune]int32)
var common_utf_latvian_ci_Weights_once sync.Once

func common_utf_latvian_ci_Weights() map[rune]int32 {
	common_utf_latvian_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_latvian_ci_Weights_map, common_utf_latvian_ci_Weights_bin) })
	return common_utf_latvian_ci_Weights_map
}

//go:embed common_utf_lithuanian_ci_Weights.bin
var common_utf_lithuanian_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_lithuanian_ci_Weights_map = make(map[rune]int32)
var common_utf_lithuanian_ci_Weights_once sync.Once

func common_utf_lithuanian_ci_Weights() map[rune]int32 {
	common_utf_lithuanian_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_lithuanian_ci_Weights_map, common_utf_lithuanian_ci_Weights_bin) })
	return common_utf_lithuanian_ci_Weights_map
}

//go:embed common_utf_persian_ci_Weights.bin
var common_utf_persian_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_persian_ci_Weights_map = make(map[rune]int32)
var common_utf_persian_ci_Weights_once sync.Once

func common_utf_persian_ci_Weights() map[rune]int32 {
	common_utf_persian_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_persian_ci_Weights_map, common_utf_persian_ci_Weights_bin) })
	return common_utf_persian_ci_Weights_map
}

//go:embed common_utf_polish_ci_Weights.bin
var common_utf_polish_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_polish_ci_Weights_map = make(map[rune]int32)
var common_utf_polish_ci_Weights_once sync.Once

func common_utf_polish_ci_Weights() map[rune]int32 {
	common_utf_polish_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_polish_ci_Weights_map, common_utf_polish_ci_Weights_bin) })
	return common_utf_polish_ci_Weights_map
}

//go:embed common_utf_roman_ci_Weights.bin
var common_utf_roman_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_roman_ci_Weights_map = make(map[rune]int32)
var common_utf_roman_ci_Weights_once sync.Once

func common_utf_roman_ci_Weights() map[rune]int32 {
	common_utf_roman_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_roman_ci_Weights_map, common_utf_roman_ci_Weights_bin) })
	return common_utf_roman_ci_Weights_map
}

//go:embed common_utf_romanian_ci_Weights.bin
var common_utf_romanian_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_romanian_ci_Weights_map = make(map[rune]int32)
var common_utf_romanian_ci_Weights_once sync.Once

func common_utf_romanian_ci_Weights() map[rune]int32 {
	common_utf_romanian_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_romanian_ci_Weights_map, common_utf_romanian_ci_Weights_bin) })
	return common_utf_romanian_ci_Weights_map
}

//go:embed common_utf_sinhala_ci_Weights.bin
var common_utf_sinhala_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_sinhala_ci_Weights_map = make(map[rune]int32)
var common_utf_sinhala_ci_Weights_once sync.Once

func common_utf_sinhala_ci_Weights() map[rune]int32 {
	common_utf_sinhala_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_sinhala_ci_Weights_map, common_utf_sinhala_ci_Weights_bin) })
	return common_utf_sinhala_ci_Weights_map
}

//go:embed common_utf_slovak_ci_Weights.bin
var common_utf_slovak_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_slovak_ci_Weights_map = make(map[rune]int32)
var common_utf_slovak_ci_Weights_once sync.Once

func common_utf_slovak_ci_Weights() map[rune]int32 {
	common_utf_slovak_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_slovak_ci_Weights_map, common_utf_slovak_ci_Weights_bin) })
	return common_utf_slovak_ci_Weights_map
}

//go:embed common_utf_slovenian_ci_Weights.bin
var common_utf_slovenian_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_slovenian_ci_Weights_map = make(map[rune]int32)
var common_utf_slovenian_ci_Weights_once sync.Once

func common_utf_slovenian_ci_Weights() map[rune]int32 {
	common_utf_slovenian_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_slovenian_ci_Weights_map, common_utf_slovenian_ci_Weights_bin) })
	return common_utf_slovenian_ci_Weights_map
}

//go:embed common_utf_spanish2_ci_Weights.bin
var common_utf_spanish2_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_spanish2_ci_Weights_map = make(map[rune]int32)
var common_utf_spanish2_ci_Weights_once sync.Once

func common_utf_spanish2_ci_Weights() map[rune]int32 {
	common_utf_spanish2_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_spanish2_ci_Weights_map, common_utf_spanish2_ci_Weights_bin) })
	return common_utf_spanish2_ci_Weights_map
}

//go:embed common_utf_swedish_ci_Weights.bin
var common_utf_swedish_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_swedish_ci_Weights_map = make(map[rune]int32)
var common_utf_swedish_ci_Weights_once sync.Once

func common_utf_swedish_ci_Weights() map[rune]int32 {
	common_utf_swedish_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_swedish_ci_Weights_map, common_utf_swedish_ci_Weights_bin) })
	return common_utf_swedish_ci_Weights_map
}

//go:embed common_utf_turkish_ci_Weights.bin
var common_utf_turkish_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_turkish_ci_Weights_map = make(map[rune]int32)
var common_utf_turkish_ci_Weights_once sync.Once

func common_utf_turkish_ci_Weights() map[rune]int32 {
	common_utf_turkish_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_turkish_ci_Weights_map, common_utf_turkish_ci_Weights_bin) })
	return common_utf_turkish_ci_Weights_map
}

//go:embed common_utf_unicode_520_ci_Weights.bin
var common_utf_unicode_520_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_unicode_520_ci_Weights_map = make(map[rune]int32)
var common_utf_unicode_520_ci_Weights_once sync.Once

func common_utf_unicode_520_ci_Weights() map[rune]int32 {
	common_utf_unicode_520_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_unicode_520_ci_Weights_map, common_utf_unicode_520_ci_Weights_bin) })
	return common_utf_unicode_520_ci_Weights_map
}

//go:embed common_utf_unicode_ci_Weights.bin
var common_utf_unicode_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_unicode_ci_Weights_map = make(map[rune]int32)
var common_utf_unicode_ci_Weights_once sync.Once

func common_utf_unicode_ci_Weights() map[rune]int32 {
	common_utf_unicode_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_unicode_ci_Weights_map, common_utf_unicode_ci_Weights_bin) })
	return common_utf_unicode_ci_Weights_map
}

//go:embed common_utf_vietnamese_ci_Weights.bin
var common_utf_vietnamese_ci_Weights_bin []byte // This is generated using the ./generate package.
var common_utf_vietnamese_ci_Weights_map = make(map[rune]int32)
var common_utf_vietnamese_ci_Weights_once sync.Once

func common_utf_vietnamese_ci_Weights() map[rune]int32 {
	common_utf_vietnamese_ci_Weights_once.Do(func() { loadWeightsMap(common_utf_vietnamese_ci_Weights_map, common_utf_vietnamese_ci_Weights_bin) })
	return common_utf_vietnamese_ci_Weights_map
}

//go:embed utf8mb3_unicode_520_ci_Weights.bin
var utf8mb3_unicode_520_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb3_unicode_520_ci_Weights_map = make(map[rune]int32)
var utf8mb3_unicode_520_ci_Weights_once sync.Once

func utf8mb3_unicode_520_ci_Weights() map[rune]int32 {
	utf8mb3_unicode_520_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb3_unicode_520_ci_Weights_map, utf8mb3_unicode_520_ci_Weights_bin) })
	return utf8mb3_unicode_520_ci_Weights_map
}

//go:embed utf8mb4_0900_ai_ci_Weights.bin
var utf8mb4_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_0900_ai_ci_Weights_once sync.Once

func utf8mb4_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_0900_ai_ci_Weights_map, utf8mb4_0900_ai_ci_Weights_bin) })
	return utf8mb4_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_0900_as_ci_Weights.bin
var utf8mb4_0900_as_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_0900_as_ci_Weights_map = make(map[rune]int32)
var utf8mb4_0900_as_ci_Weights_once sync.Once

func utf8mb4_0900_as_ci_Weights() map[rune]int32 {
	utf8mb4_0900_as_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_0900_as_ci_Weights_map, utf8mb4_0900_as_ci_Weights_bin) })
	return utf8mb4_0900_as_ci_Weights_map
}

//go:embed utf8mb4_0900_as_cs_Weights.bin
var utf8mb4_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_0900_as_cs_Weights_once sync.Once

func utf8mb4_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_0900_as_cs_Weights_map, utf8mb4_0900_as_cs_Weights_bin) })
	return utf8mb4_0900_as_cs_Weights_map
}

//go:embed utf8mb4_cs_0900_ai_ci_Weights.bin
var utf8mb4_cs_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_cs_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_cs_0900_ai_ci_Weights_once sync.Once

func utf8mb4_cs_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_cs_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_cs_0900_ai_ci_Weights_map, utf8mb4_cs_0900_ai_ci_Weights_bin) })
	return utf8mb4_cs_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_cs_0900_as_cs_Weights.bin
var utf8mb4_cs_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_cs_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_cs_0900_as_cs_Weights_once sync.Once

func utf8mb4_cs_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_cs_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_cs_0900_as_cs_Weights_map, utf8mb4_cs_0900_as_cs_Weights_bin) })
	return utf8mb4_cs_0900_as_cs_Weights_map
}

//go:embed utf8mb4_da_0900_ai_ci_Weights.bin
var utf8mb4_da_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_da_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_da_0900_ai_ci_Weights_once sync.Once

func utf8mb4_da_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_da_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_da_0900_ai_ci_Weights_map, utf8mb4_da_0900_ai_ci_Weights_bin) })
	return utf8mb4_da_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_da_0900_as_cs_Weights.bin
var utf8mb4_da_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_da_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_da_0900_as_cs_Weights_once sync.Once

func utf8mb4_da_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_da_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_da_0900_as_cs_Weights_map, utf8mb4_da_0900_as_cs_Weights_bin) })
	return utf8mb4_da_0900_as_cs_Weights_map
}

//go:embed utf8mb4_de_pb_0900_ai_ci_Weights.bin
var utf8mb4_de_pb_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_de_pb_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_de_pb_0900_ai_ci_Weights_once sync.Once

func utf8mb4_de_pb_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_de_pb_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_de_pb_0900_ai_ci_Weights_map, utf8mb4_de_pb_0900_ai_ci_Weights_bin) })
	return utf8mb4_de_pb_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_de_pb_0900_as_cs_Weights.bin
var utf8mb4_de_pb_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_de_pb_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_de_pb_0900_as_cs_Weights_once sync.Once

func utf8mb4_de_pb_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_de_pb_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_de_pb_0900_as_cs_Weights_map, utf8mb4_de_pb_0900_as_cs_Weights_bin) })
	return utf8mb4_de_pb_0900_as_cs_Weights_map
}

//go:embed utf8mb4_eo_0900_ai_ci_Weights.bin
var utf8mb4_eo_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_eo_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_eo_0900_ai_ci_Weights_once sync.Once

func utf8mb4_eo_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_eo_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_eo_0900_ai_ci_Weights_map, utf8mb4_eo_0900_ai_ci_Weights_bin) })
	return utf8mb4_eo_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_eo_0900_as_cs_Weights.bin
var utf8mb4_eo_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_eo_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_eo_0900_as_cs_Weights_once sync.Once

func utf8mb4_eo_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_eo_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_eo_0900_as_cs_Weights_map, utf8mb4_eo_0900_as_cs_Weights_bin) })
	return utf8mb4_eo_0900_as_cs_Weights_map
}

//go:embed utf8mb4_et_0900_ai_ci_Weights.bin
var utf8mb4_et_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_et_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_et_0900_ai_ci_Weights_once sync.Once

func utf8mb4_et_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_et_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_et_0900_ai_ci_Weights_map, utf8mb4_et_0900_ai_ci_Weights_bin) })
	return utf8mb4_et_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_et_0900_as_cs_Weights.bin
var utf8mb4_et_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_et_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_et_0900_as_cs_Weights_once sync.Once

func utf8mb4_et_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_et_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_et_0900_as_cs_Weights_map, utf8mb4_et_0900_as_cs_Weights_bin) })
	return utf8mb4_et_0900_as_cs_Weights_map
}

//go:embed utf8mb4_hr_0900_ai_ci_Weights.bin
var utf8mb4_hr_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_hr_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_hr_0900_ai_ci_Weights_once sync.Once

func utf8mb4_hr_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_hr_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_hr_0900_ai_ci_Weights_map, utf8mb4_hr_0900_ai_ci_Weights_bin) })
	return utf8mb4_hr_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_hr_0900_as_cs_Weights.bin
var utf8mb4_hr_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_hr_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_hr_0900_as_cs_Weights_once sync.Once

func utf8mb4_hr_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_hr_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_hr_0900_as_cs_Weights_map, utf8mb4_hr_0900_as_cs_Weights_bin) })
	return utf8mb4_hr_0900_as_cs_Weights_map
}

//go:embed utf8mb4_hu_0900_ai_ci_Weights.bin
var utf8mb4_hu_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_hu_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_hu_0900_ai_ci_Weights_once sync.Once

func utf8mb4_hu_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_hu_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_hu_0900_ai_ci_Weights_map, utf8mb4_hu_0900_ai_ci_Weights_bin) })
	return utf8mb4_hu_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_hu_0900_as_cs_Weights.bin
var utf8mb4_hu_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_hu_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_hu_0900_as_cs_Weights_once sync.Once

func utf8mb4_hu_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_hu_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_hu_0900_as_cs_Weights_map, utf8mb4_hu_0900_as_cs_Weights_bin) })
	return utf8mb4_hu_0900_as_cs_Weights_map
}

//go:embed utf8mb4_is_0900_ai_ci_Weights.bin
var utf8mb4_is_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_is_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_is_0900_ai_ci_Weights_once sync.Once

func utf8mb4_is_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_is_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_is_0900_ai_ci_Weights_map, utf8mb4_is_0900_ai_ci_Weights_bin) })
	return utf8mb4_is_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_is_0900_as_cs_Weights.bin
var utf8mb4_is_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_is_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_is_0900_as_cs_Weights_once sync.Once

func utf8mb4_is_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_is_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_is_0900_as_cs_Weights_map, utf8mb4_is_0900_as_cs_Weights_bin) })
	return utf8mb4_is_0900_as_cs_Weights_map
}

//go:embed utf8mb4_ja_0900_as_cs_Weights.bin
var utf8mb4_ja_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_ja_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_ja_0900_as_cs_Weights_once sync.Once

func utf8mb4_ja_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_ja_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_ja_0900_as_cs_Weights_map, utf8mb4_ja_0900_as_cs_Weights_bin) })
	return utf8mb4_ja_0900_as_cs_Weights_map
}

//go:embed utf8mb4_ja_0900_as_cs_ks_Weights.bin
var utf8mb4_ja_0900_as_cs_ks_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_ja_0900_as_cs_ks_Weights_map = make(map[rune]int32)
var utf8mb4_ja_0900_as_cs_ks_Weights_once sync.Once

func utf8mb4_ja_0900_as_cs_ks_Weights() map[rune]int32 {
	utf8mb4_ja_0900_as_cs_ks_Weights_once.Do(func() { loadWeightsMap(utf8mb4_ja_0900_as_cs_ks_Weights_map, utf8mb4_ja_0900_as_cs_ks_Weights_bin) })
	return utf8mb4_ja_0900_as_cs_ks_Weights_map
}

//go:embed utf8mb4_la_0900_ai_ci_Weights.bin
var utf8mb4_la_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_la_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_la_0900_ai_ci_Weights_once sync.Once

func utf8mb4_la_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_la_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_la_0900_ai_ci_Weights_map, utf8mb4_la_0900_ai_ci_Weights_bin) })
	return utf8mb4_la_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_la_0900_as_cs_Weights.bin
var utf8mb4_la_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_la_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_la_0900_as_cs_Weights_once sync.Once

func utf8mb4_la_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_la_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_la_0900_as_cs_Weights_map, utf8mb4_la_0900_as_cs_Weights_bin) })
	return utf8mb4_la_0900_as_cs_Weights_map
}

//go:embed utf8mb4_lt_0900_ai_ci_Weights.bin
var utf8mb4_lt_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_lt_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_lt_0900_ai_ci_Weights_once sync.Once

func utf8mb4_lt_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_lt_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_lt_0900_ai_ci_Weights_map, utf8mb4_lt_0900_ai_ci_Weights_bin) })
	return utf8mb4_lt_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_lt_0900_as_cs_Weights.bin
var utf8mb4_lt_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_lt_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_lt_0900_as_cs_Weights_once sync.Once

func utf8mb4_lt_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_lt_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_lt_0900_as_cs_Weights_map, utf8mb4_lt_0900_as_cs_Weights_bin) })
	return utf8mb4_lt_0900_as_cs_Weights_map
}

//go:embed utf8mb4_lv_0900_ai_ci_Weights.bin
var utf8mb4_lv_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_lv_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_lv_0900_ai_ci_Weights_once sync.Once

func utf8mb4_lv_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_lv_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_lv_0900_ai_ci_Weights_map, utf8mb4_lv_0900_ai_ci_Weights_bin) })
	return utf8mb4_lv_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_lv_0900_as_cs_Weights.bin
var utf8mb4_lv_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_lv_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_lv_0900_as_cs_Weights_once sync.Once

func utf8mb4_lv_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_lv_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_lv_0900_as_cs_Weights_map, utf8mb4_lv_0900_as_cs_Weights_bin) })
	return utf8mb4_lv_0900_as_cs_Weights_map
}

//go:embed utf8mb4_pl_0900_ai_ci_Weights.bin
var utf8mb4_pl_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_pl_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_pl_0900_ai_ci_Weights_once sync.Once

func utf8mb4_pl_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_pl_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_pl_0900_ai_ci_Weights_map, utf8mb4_pl_0900_ai_ci_Weights_bin) })
	return utf8mb4_pl_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_pl_0900_as_cs_Weights.bin
var utf8mb4_pl_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_pl_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_pl_0900_as_cs_Weights_once sync.Once

func utf8mb4_pl_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_pl_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_pl_0900_as_cs_Weights_map, utf8mb4_pl_0900_as_cs_Weights_bin) })
	return utf8mb4_pl_0900_as_cs_Weights_map
}

//go:embed utf8mb4_ro_0900_ai_ci_Weights.bin
var utf8mb4_ro_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_ro_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_ro_0900_ai_ci_Weights_once sync.Once

func utf8mb4_ro_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_ro_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_ro_0900_ai_ci_Weights_map, utf8mb4_ro_0900_ai_ci_Weights_bin) })
	return utf8mb4_ro_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_ro_0900_as_cs_Weights.bin
var utf8mb4_ro_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_ro_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_ro_0900_as_cs_Weights_once sync.Once

func utf8mb4_ro_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_ro_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_ro_0900_as_cs_Weights_map, utf8mb4_ro_0900_as_cs_Weights_bin) })
	return utf8mb4_ro_0900_as_cs_Weights_map
}

//go:embed utf8mb4_ru_0900_ai_ci_Weights.bin
var utf8mb4_ru_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_ru_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_ru_0900_ai_ci_Weights_once sync.Once

func utf8mb4_ru_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_ru_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_ru_0900_ai_ci_Weights_map, utf8mb4_ru_0900_ai_ci_Weights_bin) })
	return utf8mb4_ru_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_ru_0900_as_cs_Weights.bin
var utf8mb4_ru_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_ru_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_ru_0900_as_cs_Weights_once sync.Once

func utf8mb4_ru_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_ru_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_ru_0900_as_cs_Weights_map, utf8mb4_ru_0900_as_cs_Weights_bin) })
	return utf8mb4_ru_0900_as_cs_Weights_map
}

//go:embed utf8mb4_sk_0900_ai_ci_Weights.bin
var utf8mb4_sk_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_sk_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_sk_0900_ai_ci_Weights_once sync.Once

func utf8mb4_sk_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_sk_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_sk_0900_ai_ci_Weights_map, utf8mb4_sk_0900_ai_ci_Weights_bin) })
	return utf8mb4_sk_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_sk_0900_as_cs_Weights.bin
var utf8mb4_sk_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_sk_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_sk_0900_as_cs_Weights_once sync.Once

func utf8mb4_sk_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_sk_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_sk_0900_as_cs_Weights_map, utf8mb4_sk_0900_as_cs_Weights_bin) })
	return utf8mb4_sk_0900_as_cs_Weights_map
}

//go:embed utf8mb4_sl_0900_ai_ci_Weights.bin
var utf8mb4_sl_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_sl_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_sl_0900_ai_ci_Weights_once sync.Once

func utf8mb4_sl_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_sl_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_sl_0900_ai_ci_Weights_map, utf8mb4_sl_0900_ai_ci_Weights_bin) })
	return utf8mb4_sl_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_sl_0900_as_cs_Weights.bin
var utf8mb4_sl_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_sl_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_sl_0900_as_cs_Weights_once sync.Once

func utf8mb4_sl_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_sl_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_sl_0900_as_cs_Weights_map, utf8mb4_sl_0900_as_cs_Weights_bin) })
	return utf8mb4_sl_0900_as_cs_Weights_map
}

//go:embed utf8mb4_sv_0900_ai_ci_Weights.bin
var utf8mb4_sv_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_sv_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_sv_0900_ai_ci_Weights_once sync.Once

func utf8mb4_sv_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_sv_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_sv_0900_ai_ci_Weights_map, utf8mb4_sv_0900_ai_ci_Weights_bin) })
	return utf8mb4_sv_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_sv_0900_as_cs_Weights.bin
var utf8mb4_sv_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_sv_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_sv_0900_as_cs_Weights_once sync.Once

func utf8mb4_sv_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_sv_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_sv_0900_as_cs_Weights_map, utf8mb4_sv_0900_as_cs_Weights_bin) })
	return utf8mb4_sv_0900_as_cs_Weights_map
}

//go:embed utf8mb4_tr_0900_ai_ci_Weights.bin
var utf8mb4_tr_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_tr_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_tr_0900_ai_ci_Weights_once sync.Once

func utf8mb4_tr_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_tr_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_tr_0900_ai_ci_Weights_map, utf8mb4_tr_0900_ai_ci_Weights_bin) })
	return utf8mb4_tr_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_tr_0900_as_cs_Weights.bin
var utf8mb4_tr_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_tr_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_tr_0900_as_cs_Weights_once sync.Once

func utf8mb4_tr_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_tr_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_tr_0900_as_cs_Weights_map, utf8mb4_tr_0900_as_cs_Weights_bin) })
	return utf8mb4_tr_0900_as_cs_Weights_map
}

//go:embed utf8mb4_vi_0900_ai_ci_Weights.bin
var utf8mb4_vi_0900_ai_ci_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_vi_0900_ai_ci_Weights_map = make(map[rune]int32)
var utf8mb4_vi_0900_ai_ci_Weights_once sync.Once

func utf8mb4_vi_0900_ai_ci_Weights() map[rune]int32 {
	utf8mb4_vi_0900_ai_ci_Weights_once.Do(func() { loadWeightsMap(utf8mb4_vi_0900_ai_ci_Weights_map, utf8mb4_vi_0900_ai_ci_Weights_bin) })
	return utf8mb4_vi_0900_ai_ci_Weights_map
}

//go:embed utf8mb4_vi_0900_as_cs_Weights.bin
var utf8mb4_vi_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_vi_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_vi_0900_as_cs_Weights_once sync.Once

func utf8mb4_vi_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_vi_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_vi_0900_as_cs_Weights_map, utf8mb4_vi_0900_as_cs_Weights_bin) })
	return utf8mb4_vi_0900_as_cs_Weights_map
}

//go:embed utf8mb4_zh_0900_as_cs_Weights.bin
var utf8mb4_zh_0900_as_cs_Weights_bin []byte // This is generated using the ./generate package.
var utf8mb4_zh_0900_as_cs_Weights_map = make(map[rune]int32)
var utf8mb4_zh_0900_as_cs_Weights_once sync.Once

func utf8mb4_zh_0900_as_cs_Weights() map[rune]int32 {
	utf8mb4_zh_0900_as_cs_Weights_once.Do(func() { loadWeightsMap(utf8mb4_zh_0900_as_cs_Weights_map, utf8mb4_zh_0900_as_cs_Weights_bin) })
	return utf8mb4_zh_0900_as_cs_Weights_map
}
