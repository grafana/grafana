// Copyright 2022-2023 Dolthub, Inc.
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

package sql

import (
	"fmt"
	"io"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/cespare/xxhash/v2"

	"github.com/dolthub/go-mysql-server/sql/encodings"
)

// Collation represents the collation of a string.
type Collation struct {
	ID                CollationID
	Name              string
	CharacterSet      CharacterSetID
	IsDefault         bool
	IsCompiled        bool
	IsCaseSensitive   bool
	IsAccentSensitive bool
	SortLength        uint8
	PadAttribute      string
	Sorter            CollationSorter
}

// CollationSorter is a collation's sort function. When given a rune, an integer is returned that represents that rune's
// order when sorted against all other runes. That integer is referred to as a sort order. When two runes have the same
// sort order, they are considered equivalent. For example, case-insensitive collations return the same sort order for
// uppercase and lowercase variants of a character, while case-sensitive collations return different sort orders.
// Comparing sort orders from different collations is meaningless, and therefore represents a logical error.
type CollationSorter func(r rune) int32

// CollationsIterator iterates over every collation available, ordered by their ID (ascending).
type CollationsIterator struct {
	idx int
}

var collationStringToID = map[string]CollationID{}

// CollationID represents the collation's unique identifier. May be safely converted to and from an uint16 for storage.
type CollationID uint16

// The collations below are ordered alphabetically to make it easier to visually parse them.
// Each collation's ID matches the ID from MySQL, which may be obtained by running `SHOW COLLATIONS;` on a MySQL server.
// These are guaranteed to be stable.

const (
	Collation_armscii8_bin                CollationID = 64
	Collation_armscii8_general_ci         CollationID = 32
	Collation_ascii_bin                   CollationID = 65
	Collation_ascii_general_ci            CollationID = 11
	Collation_big5_bin                    CollationID = 84
	Collation_big5_chinese_ci             CollationID = 1
	Collation_binary                      CollationID = 63
	Collation_cp1250_bin                  CollationID = 66
	Collation_cp1250_croatian_ci          CollationID = 44
	Collation_cp1250_czech_cs             CollationID = 34
	Collation_cp1250_general_ci           CollationID = 26
	Collation_cp1250_polish_ci            CollationID = 99
	Collation_cp1251_bin                  CollationID = 50
	Collation_cp1251_bulgarian_ci         CollationID = 14
	Collation_cp1251_general_ci           CollationID = 51
	Collation_cp1251_general_cs           CollationID = 52
	Collation_cp1251_ukrainian_ci         CollationID = 23
	Collation_cp1256_bin                  CollationID = 67
	Collation_cp1256_general_ci           CollationID = 57
	Collation_cp1257_bin                  CollationID = 58
	Collation_cp1257_general_ci           CollationID = 59
	Collation_cp1257_lithuanian_ci        CollationID = 29
	Collation_cp850_bin                   CollationID = 80
	Collation_cp850_general_ci            CollationID = 4
	Collation_cp852_bin                   CollationID = 81
	Collation_cp852_general_ci            CollationID = 40
	Collation_cp866_bin                   CollationID = 68
	Collation_cp866_general_ci            CollationID = 36
	Collation_cp932_bin                   CollationID = 96
	Collation_cp932_japanese_ci           CollationID = 95
	Collation_dec8_bin                    CollationID = 69
	Collation_dec8_swedish_ci             CollationID = 3
	Collation_eucjpms_bin                 CollationID = 98
	Collation_eucjpms_japanese_ci         CollationID = 97
	Collation_euckr_bin                   CollationID = 85
	Collation_euckr_korean_ci             CollationID = 19
	Collation_gb18030_bin                 CollationID = 249
	Collation_gb18030_chinese_ci          CollationID = 248
	Collation_gb18030_unicode_520_ci      CollationID = 250
	Collation_gb2312_bin                  CollationID = 86
	Collation_gb2312_chinese_ci           CollationID = 24
	Collation_gbk_bin                     CollationID = 87
	Collation_gbk_chinese_ci              CollationID = 28
	Collation_geostd8_bin                 CollationID = 93
	Collation_geostd8_general_ci          CollationID = 92
	Collation_greek_bin                   CollationID = 70
	Collation_greek_general_ci            CollationID = 25
	Collation_hebrew_bin                  CollationID = 71
	Collation_hebrew_general_ci           CollationID = 16
	Collation_hp8_bin                     CollationID = 72
	Collation_hp8_english_ci              CollationID = 6
	Collation_keybcs2_bin                 CollationID = 73
	Collation_keybcs2_general_ci          CollationID = 37
	Collation_koi8r_bin                   CollationID = 74
	Collation_koi8r_general_ci            CollationID = 7
	Collation_koi8u_bin                   CollationID = 75
	Collation_koi8u_general_ci            CollationID = 22
	Collation_latin1_bin                  CollationID = 47
	Collation_latin1_danish_ci            CollationID = 15
	Collation_latin1_general_ci           CollationID = 48
	Collation_latin1_general_cs           CollationID = 49
	Collation_latin1_german1_ci           CollationID = 5
	Collation_latin1_german2_ci           CollationID = 31
	Collation_latin1_spanish_ci           CollationID = 94
	Collation_latin1_swedish_ci           CollationID = 8
	Collation_latin2_bin                  CollationID = 77
	Collation_latin2_croatian_ci          CollationID = 27
	Collation_latin2_czech_cs             CollationID = 2
	Collation_latin2_general_ci           CollationID = 9
	Collation_latin2_hungarian_ci         CollationID = 21
	Collation_latin5_bin                  CollationID = 78
	Collation_latin5_turkish_ci           CollationID = 30
	Collation_latin7_bin                  CollationID = 79
	Collation_latin7_estonian_cs          CollationID = 20
	Collation_latin7_general_ci           CollationID = 41
	Collation_latin7_general_cs           CollationID = 42
	Collation_macce_bin                   CollationID = 43
	Collation_macce_general_ci            CollationID = 38
	Collation_macroman_bin                CollationID = 53
	Collation_macroman_general_ci         CollationID = 39
	Collation_sjis_bin                    CollationID = 88
	Collation_sjis_japanese_ci            CollationID = 13
	Collation_swe7_bin                    CollationID = 82
	Collation_swe7_swedish_ci             CollationID = 10
	Collation_tis620_bin                  CollationID = 89
	Collation_tis620_thai_ci              CollationID = 18
	Collation_ucs2_bin                    CollationID = 90
	Collation_ucs2_croatian_ci            CollationID = 149
	Collation_ucs2_czech_ci               CollationID = 138
	Collation_ucs2_danish_ci              CollationID = 139
	Collation_ucs2_esperanto_ci           CollationID = 145
	Collation_ucs2_estonian_ci            CollationID = 134
	Collation_ucs2_general_ci             CollationID = 35
	Collation_ucs2_general_mysql500_ci    CollationID = 159
	Collation_ucs2_german2_ci             CollationID = 148
	Collation_ucs2_hungarian_ci           CollationID = 146
	Collation_ucs2_icelandic_ci           CollationID = 129
	Collation_ucs2_latvian_ci             CollationID = 130
	Collation_ucs2_lithuanian_ci          CollationID = 140
	Collation_ucs2_persian_ci             CollationID = 144
	Collation_ucs2_polish_ci              CollationID = 133
	Collation_ucs2_roman_ci               CollationID = 143
	Collation_ucs2_romanian_ci            CollationID = 131
	Collation_ucs2_sinhala_ci             CollationID = 147
	Collation_ucs2_slovak_ci              CollationID = 141
	Collation_ucs2_slovenian_ci           CollationID = 132
	Collation_ucs2_spanish2_ci            CollationID = 142
	Collation_ucs2_spanish_ci             CollationID = 135
	Collation_ucs2_swedish_ci             CollationID = 136
	Collation_ucs2_turkish_ci             CollationID = 137
	Collation_ucs2_unicode_520_ci         CollationID = 150
	Collation_ucs2_unicode_ci             CollationID = 128
	Collation_ucs2_vietnamese_ci          CollationID = 151
	Collation_ujis_bin                    CollationID = 91
	Collation_ujis_japanese_ci            CollationID = 12
	Collation_utf16_bin                   CollationID = 55
	Collation_utf16_croatian_ci           CollationID = 122
	Collation_utf16_czech_ci              CollationID = 111
	Collation_utf16_danish_ci             CollationID = 112
	Collation_utf16_esperanto_ci          CollationID = 118
	Collation_utf16_estonian_ci           CollationID = 107
	Collation_utf16_general_ci            CollationID = 54
	Collation_utf16_german2_ci            CollationID = 121
	Collation_utf16_hungarian_ci          CollationID = 119
	Collation_utf16_icelandic_ci          CollationID = 102
	Collation_utf16_latvian_ci            CollationID = 103
	Collation_utf16_lithuanian_ci         CollationID = 113
	Collation_utf16_persian_ci            CollationID = 117
	Collation_utf16_polish_ci             CollationID = 106
	Collation_utf16_roman_ci              CollationID = 116
	Collation_utf16_romanian_ci           CollationID = 104
	Collation_utf16_sinhala_ci            CollationID = 120
	Collation_utf16_slovak_ci             CollationID = 114
	Collation_utf16_slovenian_ci          CollationID = 105
	Collation_utf16_spanish2_ci           CollationID = 115
	Collation_utf16_spanish_ci            CollationID = 108
	Collation_utf16_swedish_ci            CollationID = 109
	Collation_utf16_turkish_ci            CollationID = 110
	Collation_utf16_unicode_520_ci        CollationID = 123
	Collation_utf16_unicode_ci            CollationID = 101
	Collation_utf16_vietnamese_ci         CollationID = 124
	Collation_utf16le_bin                 CollationID = 62
	Collation_utf16le_general_ci          CollationID = 56
	Collation_utf32_bin                   CollationID = 61
	Collation_utf32_croatian_ci           CollationID = 181
	Collation_utf32_czech_ci              CollationID = 170
	Collation_utf32_danish_ci             CollationID = 171
	Collation_utf32_esperanto_ci          CollationID = 177
	Collation_utf32_estonian_ci           CollationID = 166
	Collation_utf32_general_ci            CollationID = 60
	Collation_utf32_german2_ci            CollationID = 180
	Collation_utf32_hungarian_ci          CollationID = 178
	Collation_utf32_icelandic_ci          CollationID = 161
	Collation_utf32_latvian_ci            CollationID = 162
	Collation_utf32_lithuanian_ci         CollationID = 172
	Collation_utf32_persian_ci            CollationID = 176
	Collation_utf32_polish_ci             CollationID = 165
	Collation_utf32_roman_ci              CollationID = 175
	Collation_utf32_romanian_ci           CollationID = 163
	Collation_utf32_sinhala_ci            CollationID = 179
	Collation_utf32_slovak_ci             CollationID = 173
	Collation_utf32_slovenian_ci          CollationID = 164
	Collation_utf32_spanish2_ci           CollationID = 174
	Collation_utf32_spanish_ci            CollationID = 167
	Collation_utf32_swedish_ci            CollationID = 168
	Collation_utf32_turkish_ci            CollationID = 169
	Collation_utf32_unicode_520_ci        CollationID = 182
	Collation_utf32_unicode_ci            CollationID = 160
	Collation_utf32_vietnamese_ci         CollationID = 183
	Collation_utf8mb3_bin                 CollationID = 83
	Collation_utf8mb3_croatian_ci         CollationID = 213
	Collation_utf8mb3_czech_ci            CollationID = 202
	Collation_utf8mb3_danish_ci           CollationID = 203
	Collation_utf8mb3_esperanto_ci        CollationID = 209
	Collation_utf8mb3_estonian_ci         CollationID = 198
	Collation_utf8mb3_general_ci          CollationID = 33
	Collation_utf8mb3_general_mysql500_ci CollationID = 223
	Collation_utf8mb3_german2_ci          CollationID = 212
	Collation_utf8mb3_hungarian_ci        CollationID = 210
	Collation_utf8mb3_icelandic_ci        CollationID = 193
	Collation_utf8mb3_latvian_ci          CollationID = 194
	Collation_utf8mb3_lithuanian_ci       CollationID = 204
	Collation_utf8mb3_persian_ci          CollationID = 208
	Collation_utf8mb3_polish_ci           CollationID = 197
	Collation_utf8mb3_roman_ci            CollationID = 207
	Collation_utf8mb3_romanian_ci         CollationID = 195
	Collation_utf8mb3_sinhala_ci          CollationID = 211
	Collation_utf8mb3_slovak_ci           CollationID = 205
	Collation_utf8mb3_slovenian_ci        CollationID = 196
	Collation_utf8mb3_spanish2_ci         CollationID = 206
	Collation_utf8mb3_spanish_ci          CollationID = 199
	Collation_utf8mb3_swedish_ci          CollationID = 200
	Collation_utf8mb3_tolower_ci          CollationID = 76
	Collation_utf8mb3_turkish_ci          CollationID = 201
	Collation_utf8mb3_unicode_520_ci      CollationID = 214
	Collation_utf8mb3_unicode_ci          CollationID = 192
	Collation_utf8mb3_vietnamese_ci       CollationID = 215
	Collation_utf8mb4_0900_ai_ci          CollationID = 255
	Collation_utf8mb4_0900_as_ci          CollationID = 305
	Collation_utf8mb4_0900_as_cs          CollationID = 278
	Collation_utf8mb4_0900_bin            CollationID = 309
	Collation_utf8mb4_bg_0900_ai_ci       CollationID = 318
	Collation_utf8mb4_bg_0900_as_cs       CollationID = 319
	Collation_utf8mb4_bin                 CollationID = 46
	Collation_utf8mb4_bs_0900_ai_ci       CollationID = 316
	Collation_utf8mb4_bs_0900_as_cs       CollationID = 317
	Collation_utf8mb4_croatian_ci         CollationID = 245
	Collation_utf8mb4_cs_0900_ai_ci       CollationID = 266
	Collation_utf8mb4_cs_0900_as_cs       CollationID = 289
	Collation_utf8mb4_czech_ci            CollationID = 234
	Collation_utf8mb4_da_0900_ai_ci       CollationID = 267
	Collation_utf8mb4_da_0900_as_cs       CollationID = 290
	Collation_utf8mb4_danish_ci           CollationID = 235
	Collation_utf8mb4_de_pb_0900_ai_ci    CollationID = 256
	Collation_utf8mb4_de_pb_0900_as_cs    CollationID = 279
	Collation_utf8mb4_eo_0900_ai_ci       CollationID = 273
	Collation_utf8mb4_eo_0900_as_cs       CollationID = 296
	Collation_utf8mb4_es_0900_ai_ci       CollationID = 263
	Collation_utf8mb4_es_0900_as_cs       CollationID = 286
	Collation_utf8mb4_es_trad_0900_ai_ci  CollationID = 270
	Collation_utf8mb4_es_trad_0900_as_cs  CollationID = 293
	Collation_utf8mb4_esperanto_ci        CollationID = 241
	Collation_utf8mb4_estonian_ci         CollationID = 230
	Collation_utf8mb4_et_0900_ai_ci       CollationID = 262
	Collation_utf8mb4_et_0900_as_cs       CollationID = 285
	Collation_utf8mb4_general_ci          CollationID = 45
	Collation_utf8mb4_german2_ci          CollationID = 244
	Collation_utf8mb4_gl_0900_ai_ci       CollationID = 320
	Collation_utf8mb4_gl_0900_as_cs       CollationID = 321
	Collation_utf8mb4_hr_0900_ai_ci       CollationID = 275
	Collation_utf8mb4_hr_0900_as_cs       CollationID = 298
	Collation_utf8mb4_hu_0900_ai_ci       CollationID = 274
	Collation_utf8mb4_hu_0900_as_cs       CollationID = 297
	Collation_utf8mb4_hungarian_ci        CollationID = 242
	Collation_utf8mb4_icelandic_ci        CollationID = 225
	Collation_utf8mb4_is_0900_ai_ci       CollationID = 257
	Collation_utf8mb4_is_0900_as_cs       CollationID = 280
	Collation_utf8mb4_ja_0900_as_cs       CollationID = 303
	Collation_utf8mb4_ja_0900_as_cs_ks    CollationID = 304
	Collation_utf8mb4_la_0900_ai_ci       CollationID = 271
	Collation_utf8mb4_la_0900_as_cs       CollationID = 294
	Collation_utf8mb4_latvian_ci          CollationID = 226
	Collation_utf8mb4_lithuanian_ci       CollationID = 236
	Collation_utf8mb4_lt_0900_ai_ci       CollationID = 268
	Collation_utf8mb4_lt_0900_as_cs       CollationID = 291
	Collation_utf8mb4_lv_0900_ai_ci       CollationID = 258
	Collation_utf8mb4_lv_0900_as_cs       CollationID = 281
	Collation_utf8mb4_mn_cyrl_0900_ai_ci  CollationID = 322
	Collation_utf8mb4_mn_cyrl_0900_as_cs  CollationID = 323
	Collation_utf8mb4_nb_0900_ai_ci       CollationID = 310
	Collation_utf8mb4_nb_0900_as_cs       CollationID = 311
	Collation_utf8mb4_nn_0900_ai_ci       CollationID = 312
	Collation_utf8mb4_nn_0900_as_cs       CollationID = 313
	Collation_utf8mb4_persian_ci          CollationID = 240
	Collation_utf8mb4_pl_0900_ai_ci       CollationID = 261
	Collation_utf8mb4_pl_0900_as_cs       CollationID = 284
	Collation_utf8mb4_polish_ci           CollationID = 229
	Collation_utf8mb4_ro_0900_ai_ci       CollationID = 259
	Collation_utf8mb4_ro_0900_as_cs       CollationID = 282
	Collation_utf8mb4_roman_ci            CollationID = 239
	Collation_utf8mb4_romanian_ci         CollationID = 227
	Collation_utf8mb4_ru_0900_ai_ci       CollationID = 306
	Collation_utf8mb4_ru_0900_as_cs       CollationID = 307
	Collation_utf8mb4_sinhala_ci          CollationID = 243
	Collation_utf8mb4_sk_0900_ai_ci       CollationID = 269
	Collation_utf8mb4_sk_0900_as_cs       CollationID = 292
	Collation_utf8mb4_sl_0900_ai_ci       CollationID = 260
	Collation_utf8mb4_sl_0900_as_cs       CollationID = 283
	Collation_utf8mb4_slovak_ci           CollationID = 237
	Collation_utf8mb4_slovenian_ci        CollationID = 228
	Collation_utf8mb4_spanish2_ci         CollationID = 238
	Collation_utf8mb4_spanish_ci          CollationID = 231
	Collation_utf8mb4_sr_latn_0900_ai_ci  CollationID = 314
	Collation_utf8mb4_sr_latn_0900_as_cs  CollationID = 315
	Collation_utf8mb4_sv_0900_ai_ci       CollationID = 264
	Collation_utf8mb4_sv_0900_as_cs       CollationID = 287
	Collation_utf8mb4_swedish_ci          CollationID = 232
	Collation_utf8mb4_tr_0900_ai_ci       CollationID = 265
	Collation_utf8mb4_tr_0900_as_cs       CollationID = 288
	Collation_utf8mb4_turkish_ci          CollationID = 233
	Collation_utf8mb4_unicode_520_ci      CollationID = 246
	Collation_utf8mb4_unicode_ci          CollationID = 224
	Collation_utf8mb4_vi_0900_ai_ci       CollationID = 277
	Collation_utf8mb4_vi_0900_as_cs       CollationID = 300
	Collation_utf8mb4_vietnamese_ci       CollationID = 247
	Collation_utf8mb4_zh_0900_as_cs       CollationID = 308

	Collation_utf8_general_ci          = Collation_utf8mb3_general_ci
	Collation_utf8_tolower_ci          = Collation_utf8mb3_tolower_ci
	Collation_utf8_bin                 = Collation_utf8mb3_bin
	Collation_utf8_unicode_ci          = Collation_utf8mb3_unicode_ci
	Collation_utf8_icelandic_ci        = Collation_utf8mb3_icelandic_ci
	Collation_utf8_latvian_ci          = Collation_utf8mb3_latvian_ci
	Collation_utf8_romanian_ci         = Collation_utf8mb3_romanian_ci
	Collation_utf8_slovenian_ci        = Collation_utf8mb3_slovenian_ci
	Collation_utf8_polish_ci           = Collation_utf8mb3_polish_ci
	Collation_utf8_estonian_ci         = Collation_utf8mb3_estonian_ci
	Collation_utf8_spanish_ci          = Collation_utf8mb3_spanish_ci
	Collation_utf8_swedish_ci          = Collation_utf8mb3_swedish_ci
	Collation_utf8_turkish_ci          = Collation_utf8mb3_turkish_ci
	Collation_utf8_czech_ci            = Collation_utf8mb3_czech_ci
	Collation_utf8_danish_ci           = Collation_utf8mb3_danish_ci
	Collation_utf8_lithuanian_ci       = Collation_utf8mb3_lithuanian_ci
	Collation_utf8_slovak_ci           = Collation_utf8mb3_slovak_ci
	Collation_utf8_spanish2_ci         = Collation_utf8mb3_spanish2_ci
	Collation_utf8_roman_ci            = Collation_utf8mb3_roman_ci
	Collation_utf8_persian_ci          = Collation_utf8mb3_persian_ci
	Collation_utf8_esperanto_ci        = Collation_utf8mb3_esperanto_ci
	Collation_utf8_hungarian_ci        = Collation_utf8mb3_hungarian_ci
	Collation_utf8_sinhala_ci          = Collation_utf8mb3_sinhala_ci
	Collation_utf8_german2_ci          = Collation_utf8mb3_german2_ci
	Collation_utf8_croatian_ci         = Collation_utf8mb3_croatian_ci
	Collation_utf8_unicode_520_ci      = Collation_utf8mb3_unicode_520_ci
	Collation_utf8_vietnamese_ci       = Collation_utf8mb3_vietnamese_ci
	Collation_utf8_general_mysql500_ci = Collation_utf8mb3_general_mysql500_ci

	Collation_Default                    = Collation_utf8mb4_0900_bin
	Collation_Information_Schema_Default = Collation_utf8mb3_general_ci
	// Collation_Unspecified is used when a collation has not been specified, either explicitly or implicitly. This is
	// usually used as an intermediate collation to be later replaced by an analyzer pass or a plan, although it is
	// valid to use it directly. When used, behaves identically to the default collation, although it will NOT match
	// the default collation.
	Collation_Unspecified CollationID = 0
)

// collationArray contains the details of every collation, indexed by their ID. This allows for collations to be
// efficiently passed around (since only an uint16 is needed), while still being able to quickly access all of their
// properties (index lookups are significantly faster than map lookups). Not all IDs are used, which is why there are
// gaps in the array.
var collationArray = [324]Collation{
	/*000*/ {Collation_Unspecified, "", CharacterSet_Unspecified, true, true, true, true, 0, "", nil},
	/*001*/ {Collation_big5_chinese_ci, "big5_chinese_ci", CharacterSet_big5, true, true, false, true, 1, "PAD SPACE", nil},
	/*002*/ {Collation_latin2_czech_cs, "latin2_czech_cs", CharacterSet_latin2, false, true, true, true, 4, "PAD SPACE", nil},
	/*003*/ {Collation_dec8_swedish_ci, "dec8_swedish_ci", CharacterSet_dec8, true, true, false, true, 1, "PAD SPACE", encodings.Dec8_swedish_ci_RuneWeight},
	/*004*/ {Collation_cp850_general_ci, "cp850_general_ci", CharacterSet_cp850, true, true, false, true, 1, "PAD SPACE", nil},
	/*005*/ {Collation_latin1_german1_ci, "latin1_german1_ci", CharacterSet_latin1, false, true, false, true, 1, "PAD SPACE", encodings.Latin1_german1_ci_RuneWeight},
	/*006*/ {Collation_hp8_english_ci, "hp8_english_ci", CharacterSet_hp8, true, true, false, true, 1, "PAD SPACE", nil},
	/*007*/ {Collation_koi8r_general_ci, "koi8r_general_ci", CharacterSet_koi8r, true, true, false, true, 1, "PAD SPACE", nil},
	/*008*/ {Collation_latin1_swedish_ci, "latin1_swedish_ci", CharacterSet_latin1, true, true, false, true, 1, "PAD SPACE", encodings.Latin1_swedish_ci_RuneWeight},
	/*009*/ {Collation_latin2_general_ci, "latin2_general_ci", CharacterSet_latin2, true, true, false, true, 1, "PAD SPACE", nil},
	/*010*/ {Collation_swe7_swedish_ci, "swe7_swedish_ci", CharacterSet_swe7, true, true, false, true, 1, "PAD SPACE", encodings.Swe7_swedish_ci_RuneWeight},
	/*011*/ {Collation_ascii_general_ci, "ascii_general_ci", CharacterSet_ascii, true, true, false, true, 1, "PAD SPACE", encodings.Ascii_general_ci_RuneWeight},
	/*012*/ {Collation_ujis_japanese_ci, "ujis_japanese_ci", CharacterSet_ujis, true, true, false, true, 1, "PAD SPACE", nil},
	/*013*/ {Collation_sjis_japanese_ci, "sjis_japanese_ci", CharacterSet_sjis, true, true, false, true, 1, "PAD SPACE", nil},
	/*014*/ {Collation_cp1251_bulgarian_ci, "cp1251_bulgarian_ci", CharacterSet_cp1251, false, true, false, true, 1, "PAD SPACE", nil},
	/*015*/ {Collation_latin1_danish_ci, "latin1_danish_ci", CharacterSet_latin1, false, true, false, true, 1, "PAD SPACE", encodings.Latin1_danish_ci_RuneWeight},
	/*016*/ {Collation_hebrew_general_ci, "hebrew_general_ci", CharacterSet_hebrew, true, true, false, true, 1, "PAD SPACE", nil},
	/*017*/ {},
	/*018*/ {Collation_tis620_thai_ci, "tis620_thai_ci", CharacterSet_tis620, true, true, false, true, 4, "PAD SPACE", nil},
	/*019*/ {Collation_euckr_korean_ci, "euckr_korean_ci", CharacterSet_euckr, true, true, false, true, 1, "PAD SPACE", nil},
	/*020*/ {Collation_latin7_estonian_cs, "latin7_estonian_cs", CharacterSet_latin7, false, true, true, true, 1, "PAD SPACE", encodings.Latin7_estonian_cs_RuneWeight},
	/*021*/ {Collation_latin2_hungarian_ci, "latin2_hungarian_ci", CharacterSet_latin2, false, true, false, true, 1, "PAD SPACE", nil},
	/*022*/ {Collation_koi8u_general_ci, "koi8u_general_ci", CharacterSet_koi8u, true, true, false, true, 1, "PAD SPACE", nil},
	/*023*/ {Collation_cp1251_ukrainian_ci, "cp1251_ukrainian_ci", CharacterSet_cp1251, false, true, false, true, 1, "PAD SPACE", nil},
	/*024*/ {Collation_gb2312_chinese_ci, "gb2312_chinese_ci", CharacterSet_gb2312, true, true, false, true, 1, "PAD SPACE", nil},
	/*025*/ {Collation_greek_general_ci, "greek_general_ci", CharacterSet_greek, true, true, false, true, 1, "PAD SPACE", nil},
	/*026*/ {Collation_cp1250_general_ci, "cp1250_general_ci", CharacterSet_cp1250, true, true, false, true, 1, "PAD SPACE", nil},
	/*027*/ {Collation_latin2_croatian_ci, "latin2_croatian_ci", CharacterSet_latin2, false, true, false, true, 1, "PAD SPACE", nil},
	/*028*/ {Collation_gbk_chinese_ci, "gbk_chinese_ci", CharacterSet_gbk, true, true, false, true, 1, "PAD SPACE", nil},
	/*029*/ {Collation_cp1257_lithuanian_ci, "cp1257_lithuanian_ci", CharacterSet_cp1257, false, true, false, true, 1, "PAD SPACE", encodings.Cp1257_lithuanian_ci_RuneWeight},
	/*030*/ {Collation_latin5_turkish_ci, "latin5_turkish_ci", CharacterSet_latin5, true, true, false, true, 1, "PAD SPACE", nil},
	/*031*/ {Collation_latin1_german2_ci, "latin1_german2_ci", CharacterSet_latin1, false, true, false, true, 2, "PAD SPACE", encodings.Latin1_german2_ci_RuneWeight},
	/*032*/ {Collation_armscii8_general_ci, "armscii8_general_ci", CharacterSet_armscii8, true, true, false, true, 1, "PAD SPACE", encodings.Armscii8_general_ci_RuneWeight},
	/*033*/ {Collation_utf8mb3_general_ci, "utf8mb3_general_ci", CharacterSet_utf8mb3, true, true, false, true, 1, "PAD SPACE", encodings.Utf8mb3_general_ci_RuneWeight},
	/*034*/ {Collation_cp1250_czech_cs, "cp1250_czech_cs", CharacterSet_cp1250, false, true, true, true, 2, "PAD SPACE", nil},
	/*035*/ {Collation_ucs2_general_ci, "ucs2_general_ci", CharacterSet_ucs2, true, true, false, true, 1, "PAD SPACE", nil},
	/*036*/ {Collation_cp866_general_ci, "cp866_general_ci", CharacterSet_cp866, true, true, false, true, 1, "PAD SPACE", nil},
	/*037*/ {Collation_keybcs2_general_ci, "keybcs2_general_ci", CharacterSet_keybcs2, true, true, false, true, 1, "PAD SPACE", nil},
	/*038*/ {Collation_macce_general_ci, "macce_general_ci", CharacterSet_macce, true, true, false, true, 1, "PAD SPACE", nil},
	/*039*/ {Collation_macroman_general_ci, "macroman_general_ci", CharacterSet_macroman, true, true, false, true, 1, "PAD SPACE", nil},
	/*040*/ {Collation_cp852_general_ci, "cp852_general_ci", CharacterSet_cp852, true, true, false, true, 1, "PAD SPACE", nil},
	/*041*/ {Collation_latin7_general_ci, "latin7_general_ci", CharacterSet_latin7, true, true, false, true, 1, "PAD SPACE", encodings.Latin7_general_ci_RuneWeight},
	/*042*/ {Collation_latin7_general_cs, "latin7_general_cs", CharacterSet_latin7, false, true, true, true, 1, "PAD SPACE", encodings.Latin7_general_cs_RuneWeight},
	/*043*/ {Collation_macce_bin, "macce_bin", CharacterSet_macce, false, true, true, true, 1, "PAD SPACE", nil},
	/*044*/ {Collation_cp1250_croatian_ci, "cp1250_croatian_ci", CharacterSet_cp1250, false, true, false, true, 1, "PAD SPACE", nil},
	/*045*/ {Collation_utf8mb4_general_ci, "utf8mb4_general_ci", CharacterSet_utf8mb4, false, true, false, true, 1, "PAD SPACE", encodings.Utf8mb4_general_ci_RuneWeight},
	/*046*/ {Collation_utf8mb4_bin, "utf8mb4_bin", CharacterSet_utf8mb4, false, true, true, true, 1, "PAD SPACE", encodings.Utf8mb4_bin_RuneWeight},
	/*047*/ {Collation_latin1_bin, "latin1_bin", CharacterSet_latin1, false, true, true, true, 1, "PAD SPACE", encodings.Latin1_bin_RuneWeight},
	/*048*/ {Collation_latin1_general_ci, "latin1_general_ci", CharacterSet_latin1, false, true, false, true, 1, "PAD SPACE", encodings.Latin1_general_ci_RuneWeight},
	/*049*/ {Collation_latin1_general_cs, "latin1_general_cs", CharacterSet_latin1, false, true, true, true, 1, "PAD SPACE", encodings.Latin1_general_cs_RuneWeight},
	/*050*/ {Collation_cp1251_bin, "cp1251_bin", CharacterSet_cp1251, false, true, true, true, 1, "PAD SPACE", nil},
	/*051*/ {Collation_cp1251_general_ci, "cp1251_general_ci", CharacterSet_cp1251, true, true, false, true, 1, "PAD SPACE", nil},
	/*052*/ {Collation_cp1251_general_cs, "cp1251_general_cs", CharacterSet_cp1251, false, true, true, true, 1, "PAD SPACE", nil},
	/*053*/ {Collation_macroman_bin, "macroman_bin", CharacterSet_macroman, false, true, true, true, 1, "PAD SPACE", nil},
	/*054*/ {Collation_utf16_general_ci, "utf16_general_ci", CharacterSet_utf16, true, true, false, true, 1, "PAD SPACE", encodings.Utf16_general_ci_RuneWeight},
	/*055*/ {Collation_utf16_bin, "utf16_bin", CharacterSet_utf16, false, true, true, true, 1, "PAD SPACE", encodings.Utf16_bin_RuneWeight},
	/*056*/ {Collation_utf16le_general_ci, "utf16le_general_ci", CharacterSet_utf16le, true, true, false, true, 1, "PAD SPACE", nil},
	/*057*/ {Collation_cp1256_general_ci, "cp1256_general_ci", CharacterSet_cp1256, true, true, false, true, 1, "PAD SPACE", encodings.Cp1256_general_ci_RuneWeight},
	/*058*/ {Collation_cp1257_bin, "cp1257_bin", CharacterSet_cp1257, false, true, true, true, 1, "PAD SPACE", encodings.Cp1257_bin_RuneWeight},
	/*059*/ {Collation_cp1257_general_ci, "cp1257_general_ci", CharacterSet_cp1257, true, true, false, true, 1, "PAD SPACE", encodings.Cp1257_general_ci_RuneWeight},
	/*060*/ {Collation_utf32_general_ci, "utf32_general_ci", CharacterSet_utf32, true, true, false, true, 1, "PAD SPACE", encodings.Utf32_general_ci_RuneWeight},
	/*061*/ {Collation_utf32_bin, "utf32_bin", CharacterSet_utf32, false, true, true, true, 1, "PAD SPACE", encodings.Utf32_bin_RuneWeight},
	/*062*/ {Collation_utf16le_bin, "utf16le_bin", CharacterSet_utf16le, false, true, true, true, 1, "PAD SPACE", nil},
	/*063*/ {Collation_binary, "binary", CharacterSet_binary, true, true, true, true, 1, "NO PAD", encodings.Binary_RuneWeight},
	/*064*/ {Collation_armscii8_bin, "armscii8_bin", CharacterSet_armscii8, false, true, true, true, 1, "PAD SPACE", encodings.Armscii8_bin_RuneWeight},
	/*065*/ {Collation_ascii_bin, "ascii_bin", CharacterSet_ascii, false, true, true, true, 1, "PAD SPACE", encodings.Ascii_bin_RuneWeight},
	/*066*/ {Collation_cp1250_bin, "cp1250_bin", CharacterSet_cp1250, false, true, true, true, 1, "PAD SPACE", nil},
	/*067*/ {Collation_cp1256_bin, "cp1256_bin", CharacterSet_cp1256, false, true, true, true, 1, "PAD SPACE", encodings.Cp1256_bin_RuneWeight},
	/*068*/ {Collation_cp866_bin, "cp866_bin", CharacterSet_cp866, false, true, true, true, 1, "PAD SPACE", nil},
	/*069*/ {Collation_dec8_bin, "dec8_bin", CharacterSet_dec8, false, true, true, true, 1, "PAD SPACE", encodings.Dec8_bin_RuneWeight},
	/*070*/ {Collation_greek_bin, "greek_bin", CharacterSet_greek, false, true, true, true, 1, "PAD SPACE", nil},
	/*071*/ {Collation_hebrew_bin, "hebrew_bin", CharacterSet_hebrew, false, true, true, true, 1, "PAD SPACE", nil},
	/*072*/ {Collation_hp8_bin, "hp8_bin", CharacterSet_hp8, false, true, true, true, 1, "PAD SPACE", nil},
	/*073*/ {Collation_keybcs2_bin, "keybcs2_bin", CharacterSet_keybcs2, false, true, true, true, 1, "PAD SPACE", nil},
	/*074*/ {Collation_koi8r_bin, "koi8r_bin", CharacterSet_koi8r, false, true, true, true, 1, "PAD SPACE", nil},
	/*075*/ {Collation_koi8u_bin, "koi8u_bin", CharacterSet_koi8u, false, true, true, true, 1, "PAD SPACE", nil},
	/*076*/ {Collation_utf8mb3_tolower_ci, "utf8mb3_tolower_ci", CharacterSet_utf8mb3, false, true, false, true, 1, "PAD SPACE", encodings.Utf8mb3_tolower_ci_RuneWeight},
	/*077*/ {Collation_latin2_bin, "latin2_bin", CharacterSet_latin2, false, true, true, true, 1, "PAD SPACE", nil},
	/*078*/ {Collation_latin5_bin, "latin5_bin", CharacterSet_latin5, false, true, true, true, 1, "PAD SPACE", nil},
	/*079*/ {Collation_latin7_bin, "latin7_bin", CharacterSet_latin7, false, true, true, true, 1, "PAD SPACE", encodings.Latin7_bin_RuneWeight},
	/*080*/ {Collation_cp850_bin, "cp850_bin", CharacterSet_cp850, false, true, true, true, 1, "PAD SPACE", nil},
	/*081*/ {Collation_cp852_bin, "cp852_bin", CharacterSet_cp852, false, true, true, true, 1, "PAD SPACE", nil},
	/*082*/ {Collation_swe7_bin, "swe7_bin", CharacterSet_swe7, false, true, true, true, 1, "PAD SPACE", encodings.Swe7_bin_RuneWeight},
	/*083*/ {Collation_utf8mb3_bin, "utf8mb3_bin", CharacterSet_utf8mb3, false, true, true, true, 1, "PAD SPACE", encodings.Utf8mb3_bin_RuneWeight},
	/*084*/ {Collation_big5_bin, "big5_bin", CharacterSet_big5, false, true, true, true, 1, "PAD SPACE", nil},
	/*085*/ {Collation_euckr_bin, "euckr_bin", CharacterSet_euckr, false, true, true, true, 1, "PAD SPACE", nil},
	/*086*/ {Collation_gb2312_bin, "gb2312_bin", CharacterSet_gb2312, false, true, true, true, 1, "PAD SPACE", nil},
	/*087*/ {Collation_gbk_bin, "gbk_bin", CharacterSet_gbk, false, true, true, true, 1, "PAD SPACE", nil},
	/*088*/ {Collation_sjis_bin, "sjis_bin", CharacterSet_sjis, false, true, true, true, 1, "PAD SPACE", nil},
	/*089*/ {Collation_tis620_bin, "tis620_bin", CharacterSet_tis620, false, true, true, true, 1, "PAD SPACE", nil},
	/*090*/ {Collation_ucs2_bin, "ucs2_bin", CharacterSet_ucs2, false, true, true, true, 1, "PAD SPACE", nil},
	/*091*/ {Collation_ujis_bin, "ujis_bin", CharacterSet_ujis, false, true, true, true, 1, "PAD SPACE", nil},
	/*092*/ {Collation_geostd8_general_ci, "geostd8_general_ci", CharacterSet_geostd8, true, true, false, true, 1, "PAD SPACE", encodings.Geostd8_general_ci_RuneWeight},
	/*093*/ {Collation_geostd8_bin, "geostd8_bin", CharacterSet_geostd8, false, true, true, true, 1, "PAD SPACE", encodings.Geostd8_bin_RuneWeight},
	/*094*/ {Collation_latin1_spanish_ci, "latin1_spanish_ci", CharacterSet_latin1, false, true, false, true, 1, "PAD SPACE", encodings.Latin1_spanish_ci_RuneWeight},
	/*095*/ {Collation_cp932_japanese_ci, "cp932_japanese_ci", CharacterSet_cp932, true, true, false, true, 1, "PAD SPACE", nil},
	/*096*/ {Collation_cp932_bin, "cp932_bin", CharacterSet_cp932, false, true, true, true, 1, "PAD SPACE", nil},
	/*097*/ {Collation_eucjpms_japanese_ci, "eucjpms_japanese_ci", CharacterSet_eucjpms, true, true, false, true, 1, "PAD SPACE", nil},
	/*098*/ {Collation_eucjpms_bin, "eucjpms_bin", CharacterSet_eucjpms, false, true, true, true, 1, "PAD SPACE", nil},
	/*099*/ {Collation_cp1250_polish_ci, "cp1250_polish_ci", CharacterSet_cp1250, false, true, false, true, 1, "PAD SPACE", nil},
	/*100*/ {},
	/*101*/ {Collation_utf16_unicode_ci, "utf16_unicode_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_unicode_ci_RuneWeight},
	/*102*/ {Collation_utf16_icelandic_ci, "utf16_icelandic_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_icelandic_ci_RuneWeight},
	/*103*/ {Collation_utf16_latvian_ci, "utf16_latvian_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_latvian_ci_RuneWeight},
	/*104*/ {Collation_utf16_romanian_ci, "utf16_romanian_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_romanian_ci_RuneWeight},
	/*105*/ {Collation_utf16_slovenian_ci, "utf16_slovenian_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_slovenian_ci_RuneWeight},
	/*106*/ {Collation_utf16_polish_ci, "utf16_polish_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_polish_ci_RuneWeight},
	/*107*/ {Collation_utf16_estonian_ci, "utf16_estonian_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_estonian_ci_RuneWeight},
	/*108*/ {Collation_utf16_spanish_ci, "utf16_spanish_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_spanish_ci_RuneWeight},
	/*109*/ {Collation_utf16_swedish_ci, "utf16_swedish_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_swedish_ci_RuneWeight},
	/*110*/ {Collation_utf16_turkish_ci, "utf16_turkish_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_turkish_ci_RuneWeight},
	/*111*/ {Collation_utf16_czech_ci, "utf16_czech_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_czech_ci_RuneWeight},
	/*112*/ {Collation_utf16_danish_ci, "utf16_danish_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_danish_ci_RuneWeight},
	/*113*/ {Collation_utf16_lithuanian_ci, "utf16_lithuanian_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_lithuanian_ci_RuneWeight},
	/*114*/ {Collation_utf16_slovak_ci, "utf16_slovak_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_slovak_ci_RuneWeight},
	/*115*/ {Collation_utf16_spanish2_ci, "utf16_spanish2_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_spanish2_ci_RuneWeight},
	/*116*/ {Collation_utf16_roman_ci, "utf16_roman_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_roman_ci_RuneWeight},
	/*117*/ {Collation_utf16_persian_ci, "utf16_persian_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_persian_ci_RuneWeight},
	/*118*/ {Collation_utf16_esperanto_ci, "utf16_esperanto_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_esperanto_ci_RuneWeight},
	/*119*/ {Collation_utf16_hungarian_ci, "utf16_hungarian_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_hungarian_ci_RuneWeight},
	/*120*/ {Collation_utf16_sinhala_ci, "utf16_sinhala_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_sinhala_ci_RuneWeight},
	/*121*/ {Collation_utf16_german2_ci, "utf16_german2_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_german2_ci_RuneWeight},
	/*122*/ {Collation_utf16_croatian_ci, "utf16_croatian_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_croatian_ci_RuneWeight},
	/*123*/ {Collation_utf16_unicode_520_ci, "utf16_unicode_520_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_unicode_520_ci_RuneWeight},
	/*124*/ {Collation_utf16_vietnamese_ci, "utf16_vietnamese_ci", CharacterSet_utf16, false, true, false, true, 8, "PAD SPACE", encodings.Utf16_vietnamese_ci_RuneWeight},
	/*125*/ {},
	/*126*/ {},
	/*127*/ {},
	/*128*/ {Collation_ucs2_unicode_ci, "ucs2_unicode_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*129*/ {Collation_ucs2_icelandic_ci, "ucs2_icelandic_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*130*/ {Collation_ucs2_latvian_ci, "ucs2_latvian_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*131*/ {Collation_ucs2_romanian_ci, "ucs2_romanian_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*132*/ {Collation_ucs2_slovenian_ci, "ucs2_slovenian_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*133*/ {Collation_ucs2_polish_ci, "ucs2_polish_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*134*/ {Collation_ucs2_estonian_ci, "ucs2_estonian_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*135*/ {Collation_ucs2_spanish_ci, "ucs2_spanish_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*136*/ {Collation_ucs2_swedish_ci, "ucs2_swedish_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*137*/ {Collation_ucs2_turkish_ci, "ucs2_turkish_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*138*/ {Collation_ucs2_czech_ci, "ucs2_czech_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*139*/ {Collation_ucs2_danish_ci, "ucs2_danish_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*140*/ {Collation_ucs2_lithuanian_ci, "ucs2_lithuanian_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*141*/ {Collation_ucs2_slovak_ci, "ucs2_slovak_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*142*/ {Collation_ucs2_spanish2_ci, "ucs2_spanish2_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*143*/ {Collation_ucs2_roman_ci, "ucs2_roman_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*144*/ {Collation_ucs2_persian_ci, "ucs2_persian_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*145*/ {Collation_ucs2_esperanto_ci, "ucs2_esperanto_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*146*/ {Collation_ucs2_hungarian_ci, "ucs2_hungarian_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*147*/ {Collation_ucs2_sinhala_ci, "ucs2_sinhala_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*148*/ {Collation_ucs2_german2_ci, "ucs2_german2_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*149*/ {Collation_ucs2_croatian_ci, "ucs2_croatian_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*150*/ {Collation_ucs2_unicode_520_ci, "ucs2_unicode_520_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*151*/ {Collation_ucs2_vietnamese_ci, "ucs2_vietnamese_ci", CharacterSet_ucs2, false, true, false, true, 8, "PAD SPACE", nil},
	/*152*/ {},
	/*153*/ {},
	/*154*/ {},
	/*155*/ {},
	/*156*/ {},
	/*157*/ {},
	/*158*/ {},
	/*159*/ {Collation_ucs2_general_mysql500_ci, "ucs2_general_mysql500_ci", CharacterSet_ucs2, false, true, false, true, 1, "PAD SPACE", nil},
	/*160*/ {Collation_utf32_unicode_ci, "utf32_unicode_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_unicode_ci_RuneWeight},
	/*161*/ {Collation_utf32_icelandic_ci, "utf32_icelandic_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_icelandic_ci_RuneWeight},
	/*162*/ {Collation_utf32_latvian_ci, "utf32_latvian_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_latvian_ci_RuneWeight},
	/*163*/ {Collation_utf32_romanian_ci, "utf32_romanian_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_romanian_ci_RuneWeight},
	/*164*/ {Collation_utf32_slovenian_ci, "utf32_slovenian_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_slovenian_ci_RuneWeight},
	/*165*/ {Collation_utf32_polish_ci, "utf32_polish_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_polish_ci_RuneWeight},
	/*166*/ {Collation_utf32_estonian_ci, "utf32_estonian_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_estonian_ci_RuneWeight},
	/*167*/ {Collation_utf32_spanish_ci, "utf32_spanish_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_spanish_ci_RuneWeight},
	/*168*/ {Collation_utf32_swedish_ci, "utf32_swedish_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_swedish_ci_RuneWeight},
	/*169*/ {Collation_utf32_turkish_ci, "utf32_turkish_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_turkish_ci_RuneWeight},
	/*170*/ {Collation_utf32_czech_ci, "utf32_czech_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_czech_ci_RuneWeight},
	/*171*/ {Collation_utf32_danish_ci, "utf32_danish_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_danish_ci_RuneWeight},
	/*172*/ {Collation_utf32_lithuanian_ci, "utf32_lithuanian_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_lithuanian_ci_RuneWeight},
	/*173*/ {Collation_utf32_slovak_ci, "utf32_slovak_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_slovak_ci_RuneWeight},
	/*174*/ {Collation_utf32_spanish2_ci, "utf32_spanish2_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_spanish2_ci_RuneWeight},
	/*175*/ {Collation_utf32_roman_ci, "utf32_roman_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_roman_ci_RuneWeight},
	/*176*/ {Collation_utf32_persian_ci, "utf32_persian_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_persian_ci_RuneWeight},
	/*177*/ {Collation_utf32_esperanto_ci, "utf32_esperanto_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_esperanto_ci_RuneWeight},
	/*178*/ {Collation_utf32_hungarian_ci, "utf32_hungarian_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_hungarian_ci_RuneWeight},
	/*179*/ {Collation_utf32_sinhala_ci, "utf32_sinhala_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_sinhala_ci_RuneWeight},
	/*180*/ {Collation_utf32_german2_ci, "utf32_german2_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_german2_ci_RuneWeight},
	/*181*/ {Collation_utf32_croatian_ci, "utf32_croatian_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_croatian_ci_RuneWeight},
	/*182*/ {Collation_utf32_unicode_520_ci, "utf32_unicode_520_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_unicode_520_ci_RuneWeight},
	/*183*/ {Collation_utf32_vietnamese_ci, "utf32_vietnamese_ci", CharacterSet_utf32, false, true, false, true, 8, "PAD SPACE", encodings.Utf32_vietnamese_ci_RuneWeight},
	/*184*/ {},
	/*185*/ {},
	/*186*/ {},
	/*187*/ {},
	/*188*/ {},
	/*189*/ {},
	/*190*/ {},
	/*191*/ {},
	/*192*/ {Collation_utf8mb3_unicode_ci, "utf8mb3_unicode_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_unicode_ci_RuneWeight},
	/*193*/ {Collation_utf8mb3_icelandic_ci, "utf8mb3_icelandic_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_icelandic_ci_RuneWeight},
	/*194*/ {Collation_utf8mb3_latvian_ci, "utf8mb3_latvian_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_latvian_ci_RuneWeight},
	/*195*/ {Collation_utf8mb3_romanian_ci, "utf8mb3_romanian_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_romanian_ci_RuneWeight},
	/*196*/ {Collation_utf8mb3_slovenian_ci, "utf8mb3_slovenian_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_slovenian_ci_RuneWeight},
	/*197*/ {Collation_utf8mb3_polish_ci, "utf8mb3_polish_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_polish_ci_RuneWeight},
	/*198*/ {Collation_utf8mb3_estonian_ci, "utf8mb3_estonian_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_estonian_ci_RuneWeight},
	/*199*/ {Collation_utf8mb3_spanish_ci, "utf8mb3_spanish_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_spanish_ci_RuneWeight},
	/*200*/ {Collation_utf8mb3_swedish_ci, "utf8mb3_swedish_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_swedish_ci_RuneWeight},
	/*201*/ {Collation_utf8mb3_turkish_ci, "utf8mb3_turkish_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_turkish_ci_RuneWeight},
	/*202*/ {Collation_utf8mb3_czech_ci, "utf8mb3_czech_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_czech_ci_RuneWeight},
	/*203*/ {Collation_utf8mb3_danish_ci, "utf8mb3_danish_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_danish_ci_RuneWeight},
	/*204*/ {Collation_utf8mb3_lithuanian_ci, "utf8mb3_lithuanian_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_lithuanian_ci_RuneWeight},
	/*205*/ {Collation_utf8mb3_slovak_ci, "utf8mb3_slovak_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_slovak_ci_RuneWeight},
	/*206*/ {Collation_utf8mb3_spanish2_ci, "utf8mb3_spanish2_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_spanish2_ci_RuneWeight},
	/*207*/ {Collation_utf8mb3_roman_ci, "utf8mb3_roman_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_roman_ci_RuneWeight},
	/*208*/ {Collation_utf8mb3_persian_ci, "utf8mb3_persian_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_persian_ci_RuneWeight},
	/*209*/ {Collation_utf8mb3_esperanto_ci, "utf8mb3_esperanto_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_esperanto_ci_RuneWeight},
	/*210*/ {Collation_utf8mb3_hungarian_ci, "utf8mb3_hungarian_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_hungarian_ci_RuneWeight},
	/*211*/ {Collation_utf8mb3_sinhala_ci, "utf8mb3_sinhala_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_sinhala_ci_RuneWeight},
	/*212*/ {Collation_utf8mb3_german2_ci, "utf8mb3_german2_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_german2_ci_RuneWeight},
	/*213*/ {Collation_utf8mb3_croatian_ci, "utf8mb3_croatian_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_croatian_ci_RuneWeight},
	/*214*/ {Collation_utf8mb3_unicode_520_ci, "utf8mb3_unicode_520_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_unicode_520_ci_RuneWeight},
	/*215*/ {Collation_utf8mb3_vietnamese_ci, "utf8mb3_vietnamese_ci", CharacterSet_utf8mb3, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb3_vietnamese_ci_RuneWeight},
	/*216*/ {},
	/*217*/ {},
	/*218*/ {},
	/*219*/ {},
	/*220*/ {},
	/*221*/ {},
	/*222*/ {},
	/*223*/ {Collation_utf8mb3_general_mysql500_ci, "utf8mb3_general_mysql500_ci", CharacterSet_utf8mb3, false, true, false, true, 1, "PAD SPACE", encodings.Utf8mb3_general_mysql500_ci_RuneWeight},
	/*224*/ {Collation_utf8mb4_unicode_ci, "utf8mb4_unicode_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_unicode_ci_RuneWeight},
	/*225*/ {Collation_utf8mb4_icelandic_ci, "utf8mb4_icelandic_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_icelandic_ci_RuneWeight},
	/*226*/ {Collation_utf8mb4_latvian_ci, "utf8mb4_latvian_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_latvian_ci_RuneWeight},
	/*227*/ {Collation_utf8mb4_romanian_ci, "utf8mb4_romanian_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_romanian_ci_RuneWeight},
	/*228*/ {Collation_utf8mb4_slovenian_ci, "utf8mb4_slovenian_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_slovenian_ci_RuneWeight},
	/*229*/ {Collation_utf8mb4_polish_ci, "utf8mb4_polish_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_polish_ci_RuneWeight},
	/*230*/ {Collation_utf8mb4_estonian_ci, "utf8mb4_estonian_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_estonian_ci_RuneWeight},
	/*231*/ {Collation_utf8mb4_spanish_ci, "utf8mb4_spanish_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_spanish_ci_RuneWeight},
	/*232*/ {Collation_utf8mb4_swedish_ci, "utf8mb4_swedish_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_swedish_ci_RuneWeight},
	/*233*/ {Collation_utf8mb4_turkish_ci, "utf8mb4_turkish_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_turkish_ci_RuneWeight},
	/*234*/ {Collation_utf8mb4_czech_ci, "utf8mb4_czech_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_czech_ci_RuneWeight},
	/*235*/ {Collation_utf8mb4_danish_ci, "utf8mb4_danish_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_danish_ci_RuneWeight},
	/*236*/ {Collation_utf8mb4_lithuanian_ci, "utf8mb4_lithuanian_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_lithuanian_ci_RuneWeight},
	/*237*/ {Collation_utf8mb4_slovak_ci, "utf8mb4_slovak_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_slovak_ci_RuneWeight},
	/*238*/ {Collation_utf8mb4_spanish2_ci, "utf8mb4_spanish2_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_spanish2_ci_RuneWeight},
	/*239*/ {Collation_utf8mb4_roman_ci, "utf8mb4_roman_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_roman_ci_RuneWeight},
	/*240*/ {Collation_utf8mb4_persian_ci, "utf8mb4_persian_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_persian_ci_RuneWeight},
	/*241*/ {Collation_utf8mb4_esperanto_ci, "utf8mb4_esperanto_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_esperanto_ci_RuneWeight},
	/*242*/ {Collation_utf8mb4_hungarian_ci, "utf8mb4_hungarian_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_hungarian_ci_RuneWeight},
	/*243*/ {Collation_utf8mb4_sinhala_ci, "utf8mb4_sinhala_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_sinhala_ci_RuneWeight},
	/*244*/ {Collation_utf8mb4_german2_ci, "utf8mb4_german2_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_german2_ci_RuneWeight},
	/*245*/ {Collation_utf8mb4_croatian_ci, "utf8mb4_croatian_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_croatian_ci_RuneWeight},
	/*246*/ {Collation_utf8mb4_unicode_520_ci, "utf8mb4_unicode_520_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_unicode_520_ci_RuneWeight},
	/*247*/ {Collation_utf8mb4_vietnamese_ci, "utf8mb4_vietnamese_ci", CharacterSet_utf8mb4, false, true, false, true, 8, "PAD SPACE", encodings.Utf8mb4_vietnamese_ci_RuneWeight},
	/*248*/ {Collation_gb18030_chinese_ci, "gb18030_chinese_ci", CharacterSet_gb18030, true, true, false, true, 2, "PAD SPACE", nil},
	/*249*/ {Collation_gb18030_bin, "gb18030_bin", CharacterSet_gb18030, false, true, true, true, 1, "PAD SPACE", nil},
	/*250*/ {Collation_gb18030_unicode_520_ci, "gb18030_unicode_520_ci", CharacterSet_gb18030, false, true, false, true, 8, "PAD SPACE", nil},
	/*251*/ {},
	/*252*/ {},
	/*253*/ {},
	/*254*/ {},
	/*255*/ {Collation_utf8mb4_0900_ai_ci, "utf8mb4_0900_ai_ci", CharacterSet_utf8mb4, true, true, false, false, 0, "NO PAD", encodings.Utf8mb4_0900_ai_ci_RuneWeight},
	/*256*/ {Collation_utf8mb4_de_pb_0900_ai_ci, "utf8mb4_de_pb_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_de_pb_0900_ai_ci_RuneWeight},
	/*257*/ {Collation_utf8mb4_is_0900_ai_ci, "utf8mb4_is_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_is_0900_ai_ci_RuneWeight},
	/*258*/ {Collation_utf8mb4_lv_0900_ai_ci, "utf8mb4_lv_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_lv_0900_ai_ci_RuneWeight},
	/*259*/ {Collation_utf8mb4_ro_0900_ai_ci, "utf8mb4_ro_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_ro_0900_ai_ci_RuneWeight},
	/*260*/ {Collation_utf8mb4_sl_0900_ai_ci, "utf8mb4_sl_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_sl_0900_ai_ci_RuneWeight},
	/*261*/ {Collation_utf8mb4_pl_0900_ai_ci, "utf8mb4_pl_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_pl_0900_ai_ci_RuneWeight},
	/*262*/ {Collation_utf8mb4_et_0900_ai_ci, "utf8mb4_et_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_et_0900_ai_ci_RuneWeight},
	/*263*/ {Collation_utf8mb4_es_0900_ai_ci, "utf8mb4_es_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_es_0900_ai_ci_RuneWeight},
	/*264*/ {Collation_utf8mb4_sv_0900_ai_ci, "utf8mb4_sv_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_sv_0900_ai_ci_RuneWeight},
	/*265*/ {Collation_utf8mb4_tr_0900_ai_ci, "utf8mb4_tr_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_tr_0900_ai_ci_RuneWeight},
	/*266*/ {Collation_utf8mb4_cs_0900_ai_ci, "utf8mb4_cs_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_cs_0900_ai_ci_RuneWeight},
	/*267*/ {Collation_utf8mb4_da_0900_ai_ci, "utf8mb4_da_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_da_0900_ai_ci_RuneWeight},
	/*268*/ {Collation_utf8mb4_lt_0900_ai_ci, "utf8mb4_lt_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_lt_0900_ai_ci_RuneWeight},
	/*269*/ {Collation_utf8mb4_sk_0900_ai_ci, "utf8mb4_sk_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_sk_0900_ai_ci_RuneWeight},
	/*270*/ {Collation_utf8mb4_es_trad_0900_ai_ci, "utf8mb4_es_trad_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_es_trad_0900_ai_ci_RuneWeight},
	/*271*/ {Collation_utf8mb4_la_0900_ai_ci, "utf8mb4_la_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_la_0900_ai_ci_RuneWeight},
	/*272*/ {},
	/*273*/ {Collation_utf8mb4_eo_0900_ai_ci, "utf8mb4_eo_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_eo_0900_ai_ci_RuneWeight},
	/*274*/ {Collation_utf8mb4_hu_0900_ai_ci, "utf8mb4_hu_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_hu_0900_ai_ci_RuneWeight},
	/*275*/ {Collation_utf8mb4_hr_0900_ai_ci, "utf8mb4_hr_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_hr_0900_ai_ci_RuneWeight},
	/*276*/ {},
	/*277*/ {Collation_utf8mb4_vi_0900_ai_ci, "utf8mb4_vi_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, false, 0, "NO PAD", encodings.Utf8mb4_vi_0900_ai_ci_RuneWeight},
	/*278*/ {Collation_utf8mb4_0900_as_cs, "utf8mb4_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_0900_as_cs_RuneWeight},
	/*279*/ {Collation_utf8mb4_de_pb_0900_as_cs, "utf8mb4_de_pb_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_de_pb_0900_as_cs_RuneWeight},
	/*280*/ {Collation_utf8mb4_is_0900_as_cs, "utf8mb4_is_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_is_0900_as_cs_RuneWeight},
	/*281*/ {Collation_utf8mb4_lv_0900_as_cs, "utf8mb4_lv_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_lv_0900_as_cs_RuneWeight},
	/*282*/ {Collation_utf8mb4_ro_0900_as_cs, "utf8mb4_ro_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_ro_0900_as_cs_RuneWeight},
	/*283*/ {Collation_utf8mb4_sl_0900_as_cs, "utf8mb4_sl_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_sl_0900_as_cs_RuneWeight},
	/*284*/ {Collation_utf8mb4_pl_0900_as_cs, "utf8mb4_pl_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_pl_0900_as_cs_RuneWeight},
	/*285*/ {Collation_utf8mb4_et_0900_as_cs, "utf8mb4_et_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_et_0900_as_cs_RuneWeight},
	/*286*/ {Collation_utf8mb4_es_0900_as_cs, "utf8mb4_es_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_es_0900_as_cs_RuneWeight},
	/*287*/ {Collation_utf8mb4_sv_0900_as_cs, "utf8mb4_sv_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_sv_0900_as_cs_RuneWeight},
	/*288*/ {Collation_utf8mb4_tr_0900_as_cs, "utf8mb4_tr_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_tr_0900_as_cs_RuneWeight},
	/*289*/ {Collation_utf8mb4_cs_0900_as_cs, "utf8mb4_cs_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_cs_0900_as_cs_RuneWeight},
	/*290*/ {Collation_utf8mb4_da_0900_as_cs, "utf8mb4_da_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_da_0900_as_cs_RuneWeight},
	/*291*/ {Collation_utf8mb4_lt_0900_as_cs, "utf8mb4_lt_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_lt_0900_as_cs_RuneWeight},
	/*292*/ {Collation_utf8mb4_sk_0900_as_cs, "utf8mb4_sk_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_sk_0900_as_cs_RuneWeight},
	/*293*/ {Collation_utf8mb4_es_trad_0900_as_cs, "utf8mb4_es_trad_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_es_trad_0900_as_cs_RuneWeight},
	/*294*/ {Collation_utf8mb4_la_0900_as_cs, "utf8mb4_la_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_la_0900_as_cs_RuneWeight},
	/*295*/ {},
	/*296*/ {Collation_utf8mb4_eo_0900_as_cs, "utf8mb4_eo_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_eo_0900_as_cs_RuneWeight},
	/*297*/ {Collation_utf8mb4_hu_0900_as_cs, "utf8mb4_hu_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_hu_0900_as_cs_RuneWeight},
	/*298*/ {Collation_utf8mb4_hr_0900_as_cs, "utf8mb4_hr_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_hr_0900_as_cs_RuneWeight},
	/*299*/ {},
	/*300*/ {Collation_utf8mb4_vi_0900_as_cs, "utf8mb4_vi_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_vi_0900_as_cs_RuneWeight},
	/*301*/ {},
	/*302*/ {},
	/*303*/ {Collation_utf8mb4_ja_0900_as_cs, "utf8mb4_ja_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_ja_0900_as_cs_RuneWeight},
	/*304*/ {Collation_utf8mb4_ja_0900_as_cs_ks, "utf8mb4_ja_0900_as_cs_ks", CharacterSet_utf8mb4, false, true, false, true, 24, "NO PAD", encodings.Utf8mb4_ja_0900_as_cs_ks_RuneWeight},
	/*305*/ {Collation_utf8mb4_0900_as_ci, "utf8mb4_0900_as_ci", CharacterSet_utf8mb4, false, true, false, true, 0, "NO PAD", encodings.Utf8mb4_0900_as_ci_RuneWeight},
	/*306*/ {Collation_utf8mb4_ru_0900_ai_ci, "utf8mb4_ru_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, true, 0, "NO PAD", encodings.Utf8mb4_ru_0900_ai_ci_RuneWeight},
	/*307*/ {Collation_utf8mb4_ru_0900_as_cs, "utf8mb4_ru_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_ru_0900_as_cs_RuneWeight},
	/*308*/ {Collation_utf8mb4_zh_0900_as_cs, "utf8mb4_zh_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", encodings.Utf8mb4_zh_0900_as_cs_RuneWeight},
	/*309*/ {Collation_utf8mb4_0900_bin, "utf8mb4_0900_bin", CharacterSet_utf8mb4, false, true, true, true, 1, "NO PAD", encodings.Utf8mb4_0900_bin_RuneWeight},
	/*310*/ {Collation_utf8mb4_nb_0900_ai_ci, "utf8mb4_nb_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, true, 0, "NO PAD", nil},
	/*311*/ {Collation_utf8mb4_nb_0900_as_cs, "utf8mb4_nb_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", nil},
	/*312*/ {Collation_utf8mb4_nn_0900_ai_ci, "utf8mb4_nn_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, true, 0, "NO PAD", nil},
	/*313*/ {Collation_utf8mb4_nn_0900_as_cs, "utf8mb4_nn_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", nil},
	/*314*/ {Collation_utf8mb4_sr_latn_0900_ai_ci, "utf8mb4_sr_latn_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, true, 0, "NO PAD", nil},
	/*315*/ {Collation_utf8mb4_sr_latn_0900_as_cs, "utf8mb4_sr_latn_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", nil},
	/*316*/ {Collation_utf8mb4_bs_0900_ai_ci, "utf8mb4_bs_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, true, 0, "NO PAD", nil},
	/*317*/ {Collation_utf8mb4_bs_0900_as_cs, "utf8mb4_bs_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", nil},
	/*318*/ {Collation_utf8mb4_bg_0900_ai_ci, "utf8mb4_bg_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, true, 0, "NO PAD", nil},
	/*319*/ {Collation_utf8mb4_bg_0900_as_cs, "utf8mb4_bg_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", nil},
	/*320*/ {Collation_utf8mb4_gl_0900_ai_ci, "utf8mb4_gl_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, true, 0, "NO PAD", nil},
	/*321*/ {Collation_utf8mb4_gl_0900_as_cs, "utf8mb4_gl_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", nil},
	/*322*/ {Collation_utf8mb4_mn_cyrl_0900_ai_ci, "utf8mb4_mn_cyrl_0900_ai_ci", CharacterSet_utf8mb4, false, true, false, true, 0, "NO PAD", nil},
	/*323*/ {Collation_utf8mb4_mn_cyrl_0900_as_cs, "utf8mb4_mn_cyrl_0900_as_cs", CharacterSet_utf8mb4, false, true, true, true, 0, "NO PAD", nil},
}

func init() {
	for _, collation := range collationArray {
		if len(collation.Name) == 0 {
			continue
		}
		collationStringToID[collation.Name] = collation.ID
	}

	defaultCollation := collationArray[Collation_Default]
	collationArray[0].Name = defaultCollation.Name
	collationArray[0].SortLength = defaultCollation.SortLength
	collationArray[0].PadAttribute = defaultCollation.PadAttribute
	collationArray[0].Sorter = defaultCollation.Sorter

	collationStringToID["utf8_general_ci"] = Collation_utf8mb3_general_ci
	collationStringToID["utf8_tolower_ci"] = Collation_utf8mb3_tolower_ci
	collationStringToID["utf8_bin"] = Collation_utf8mb3_bin
	collationStringToID["utf8_unicode_ci"] = Collation_utf8mb3_unicode_ci
	collationStringToID["utf8_icelandic_ci"] = Collation_utf8mb3_icelandic_ci
	collationStringToID["utf8_latvian_ci"] = Collation_utf8mb3_latvian_ci
	collationStringToID["utf8_romanian_ci"] = Collation_utf8mb3_romanian_ci
	collationStringToID["utf8_slovenian_ci"] = Collation_utf8mb3_slovenian_ci
	collationStringToID["utf8_polish_ci"] = Collation_utf8mb3_polish_ci
	collationStringToID["utf8_estonian_ci"] = Collation_utf8mb3_estonian_ci
	collationStringToID["utf8_spanish_ci"] = Collation_utf8mb3_spanish_ci
	collationStringToID["utf8_swedish_ci"] = Collation_utf8mb3_swedish_ci
	collationStringToID["utf8_turkish_ci"] = Collation_utf8mb3_turkish_ci
	collationStringToID["utf8_czech_ci"] = Collation_utf8mb3_czech_ci
	collationStringToID["utf8_danish_ci"] = Collation_utf8mb3_danish_ci
	collationStringToID["utf8_lithuanian_ci"] = Collation_utf8mb3_lithuanian_ci
	collationStringToID["utf8_slovak_ci"] = Collation_utf8mb3_slovak_ci
	collationStringToID["utf8_spanish2_ci"] = Collation_utf8mb3_spanish2_ci
	collationStringToID["utf8_roman_ci"] = Collation_utf8mb3_roman_ci
	collationStringToID["utf8_persian_ci"] = Collation_utf8mb3_persian_ci
	collationStringToID["utf8_esperanto_ci"] = Collation_utf8mb3_esperanto_ci
	collationStringToID["utf8_hungarian_ci"] = Collation_utf8mb3_hungarian_ci
	collationStringToID["utf8_sinhala_ci"] = Collation_utf8mb3_sinhala_ci
	collationStringToID["utf8_german2_ci"] = Collation_utf8mb3_german2_ci
	collationStringToID["utf8_croatian_ci"] = Collation_utf8mb3_croatian_ci
	collationStringToID["utf8_unicode_520_ci"] = Collation_utf8mb3_unicode_520_ci
	collationStringToID["utf8_vietnamese_ci"] = Collation_utf8mb3_vietnamese_ci
	collationStringToID["utf8_general_mysql500_ci"] = Collation_utf8mb3_general_mysql500_ci
}

// ParseCollation takes in an optional character set and collation, along with the binary attribute if present,
// and returns a valid collation or error. A nil character set and collation will return the default collation.
func ParseCollation(characterSetStr string, collationStr string, binary bool) (CollationID, error) {
	if len(characterSetStr) == 0 {
		if len(collationStr) == 0 {
			// No character set or collation specified: return unspecified collation
			return Collation_Unspecified, nil
		}
		// No character set specified, but a collation was specified: use collation
		collation, ok := collationStringToID[strings.ToLower(collationStr)]
		if !ok {
			return Collation_Unspecified, ErrCollationUnknown.New(collationStr)
		}
		if binary {
			return collation.CharacterSet().BinaryCollation(), nil
		}
		return collation, nil
	}

	characterSet, err := ParseCharacterSet(characterSetStr)
	if err != nil {
		return Collation_Unspecified, err
	}

	if len(collationStr) == 0 {
		// Character set specified, but no collation: grab default collation for character set
		if binary {
			return characterSet.BinaryCollation(), nil
		}
		return characterSet.DefaultCollation(), nil
	}

	// Both character set and collation specified: check compatibility and use collation
	collation, ok := collationStringToID[strings.ToLower(collationStr)]
	if !ok {
		return Collation_Unspecified, ErrCollationUnknown.New(collationStr)
	}
	if !collation.WorksWithCharacterSet(characterSet) {
		return Collation_Unspecified, fmt.Errorf("%v is not a valid character set for %v", characterSet, collation)
	}
	return collation, nil
}

// Name returns the name of this collation.
func (c CollationID) Name() string {
	return collationArray[c].Name
}

// CharacterSet returns the CharacterSetID belonging to this Collation.
func (c CollationID) CharacterSet() CharacterSetID {
	return collationArray[c].CharacterSet
}

// WorksWithCharacterSet returns whether the Collation is valid for the given CharacterSet.
func (c CollationID) WorksWithCharacterSet(cs CharacterSetID) bool {
	return collationArray[c].CharacterSet == cs
}

// String returns the string representation of the Collation.
func (c CollationID) String() string {
	return collationArray[c].Name
}

// IsDefault returns a string indicating whether this collation is the default for the character set.
func (c CollationID) IsDefault() string {
	if collationArray[c].IsDefault {
		return "Yes"
	}
	return ""
}

// IsCompiled returns a string indicating whether this collation is compiled.
func (c CollationID) IsCompiled() string {
	if collationArray[c].IsCompiled {
		return "Yes"
	}
	return ""
}

// SortLength returns the sort length of the collation.
func (c CollationID) SortLength() uint32 {
	return uint32(collationArray[c].SortLength)
}

// PadAttribute returns a string representing the pad attribute of the collation.
func (c CollationID) PadAttribute() string {
	return collationArray[c].PadAttribute
}

// Equals returns whether the given collation is the same as the calling collation.
func (c CollationID) Equals(other CollationID) bool {
	return c == other
}

// Collation returns the Collation with this ID.
func (c CollationID) Collation() Collation {
	return collationArray[c]
}

var weightBuffers = sync.Pool{
	New: func() interface{} {
		return new([]byte)
	},
}

// WriteWeightString writes the weights of each codepoint in the string into the given io.Writer.
// Two strings with technically different contents may generate the same WeightString to the same value, as the collation
// considers them the same string.
func (c CollationID) WriteWeightString(hash io.Writer, str string) error {
	if c == Collation_binary {
		// Binary strings are almost always malformed due to their usage, therefore we treat them differently
		_, err := hash.Write(encodings.StringToBytes(str))
		if err != nil {
			return err
		}
	} else {
		getRuneWeight := collationArray[c].Sorter
		i := 0
		buf := *weightBuffers.Get().(*[]byte)
		if cap(buf) < len(str)*4 {
			buf = make([]byte, len(str)*4)
		}
		for len(str) > 0 {
			// All strings (should) have been decoded at this point, so we can rely on Go's internal string encoding
			runeFromString, strRead := utf8.DecodeRuneInString(str)
			if strRead == 0 || strRead == utf8.RuneError {
				return ErrCollationMalformedString.New("hashing")
			}
			runeWeight := getRuneWeight(runeFromString)
			buf[i*4] = byte(runeWeight)
			buf[i*4+1] = byte(runeWeight >> 8)
			buf[i*4+2] = byte(runeWeight >> 16)
			buf[i*4+3] = byte(runeWeight >> 24)
			_, err := hash.Write(buf[i*4 : i*4+4])
			if err != nil {
				return err
			}
			str = str[strRead:]
			i++
		}
		weightBuffers.Put(&buf)
	}
	return nil
}

// HashToUint returns a hash of the given decoded string based on the collation. Collations take each rune's weight into
// account, therefore two strings with technically different contents may hash to the same value, as the collation
// considers them the same string.
func (c CollationID) HashToUint(str string) (uint64, error) {
	hash := xxhash.New()
	err := c.WriteWeightString(hash, str)
	if err != nil {
		return 0, err
	}
	return hash.Sum64(), nil
}

// HashToBytes returns a hash of the given decoded string based on the collation. Collations take each rune's weight
// into account, therefore two strings with technically different contents may hash to the same value, as the collation
// considers them the same string. This is equivalent to HashToUint, except that it converts the uint64 to a byte slice.
func (c CollationID) HashToBytes(str string) ([]byte, error) {
	hash, err := c.HashToUint(str)
	if err != nil {
		return nil, err
	}
	return []byte{
		byte(hash),
		byte(hash >> 8),
		byte(hash >> 16),
		byte(hash >> 24),
		byte(hash >> 32),
		byte(hash >> 40),
		byte(hash >> 48),
		byte(hash >> 56),
	}, nil
}

// Sorter returns this collation's sort function. As collations are a work-in-progress, it is recommended to avoid
// using any collations that return a nil sort function.
func (c CollationID) Sorter() CollationSorter {
	return collationArray[c].Sorter
}

// NewCollationsIterator returns a new CollationsIterator.
func NewCollationsIterator() *CollationsIterator {
	return &CollationsIterator{0}
}

// Next returns the next collation. If all collations have been iterated over, returns false.
func (ci *CollationsIterator) Next() (Collation, bool) {
	for ; ci.idx < len(collationArray); ci.idx++ {
		if collationArray[ci.idx].ID == 0 {
			continue
		}
		ci.idx++
		return collationArray[ci.idx-1], true
	}
	return Collation{}, false
}

// TypeWithCollation is implemented on all types that may return a collation.
type TypeWithCollation interface {
	// Collation returns the collation belonging to this type.
	Collation() CollationID
	// WithNewCollation returns a replica of this type, except with the given collation replacing the existing collation.
	WithNewCollation(collation CollationID) (Type, error)
	// StringWithTableCollation converts this type to a string, however it uses the given table collation to determine
	// whether to include the character set and/or collation information.
	StringWithTableCollation(tableCollation CollationID) string
}
