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
	"strings"

	"github.com/dolthub/go-mysql-server/sql/encodings"
)

// CharacterSet represents the character set of a string.
type CharacterSet struct {
	ID               CharacterSetID
	Name             string
	DefaultCollation CollationID
	BinaryCollation  CollationID
	Description      string
	MaxLength        uint8
	Encoder          encodings.Encoder
}

// CharacterSetsIterator iterates over every character set available.
type CharacterSetsIterator struct {
	idx int
}

// CharacterSetID represents a character set. Unlike collations, this ID is not intended for storage and may change as
// the default collation changes. It is recommended to use the character set's name if persistence is desired.
type CharacterSetID uint16

// The character sets below are ordered alphabetically to make it easier to visually parse them.
// As each ID acts as an index to the `characterSetArray`, they are explicitly defined.
// A character set's ID is defined as the default collation's ID.

const (
	CharacterSet_armscii8 CharacterSetID = 32
	CharacterSet_ascii    CharacterSetID = 11
	CharacterSet_big5     CharacterSetID = 1
	CharacterSet_binary   CharacterSetID = 63
	CharacterSet_cp1250   CharacterSetID = 26
	CharacterSet_cp1251   CharacterSetID = 51
	CharacterSet_cp1256   CharacterSetID = 57
	CharacterSet_cp1257   CharacterSetID = 59
	CharacterSet_cp850    CharacterSetID = 4
	CharacterSet_cp852    CharacterSetID = 40
	CharacterSet_cp866    CharacterSetID = 36
	CharacterSet_cp932    CharacterSetID = 95
	CharacterSet_dec8     CharacterSetID = 3
	CharacterSet_eucjpms  CharacterSetID = 97
	CharacterSet_euckr    CharacterSetID = 19
	CharacterSet_gb18030  CharacterSetID = 248
	CharacterSet_gb2312   CharacterSetID = 24
	CharacterSet_gbk      CharacterSetID = 28
	CharacterSet_geostd8  CharacterSetID = 92
	CharacterSet_greek    CharacterSetID = 25
	CharacterSet_hebrew   CharacterSetID = 16
	CharacterSet_hp8      CharacterSetID = 6
	CharacterSet_keybcs2  CharacterSetID = 37
	CharacterSet_koi8r    CharacterSetID = 7
	CharacterSet_koi8u    CharacterSetID = 22
	CharacterSet_latin1   CharacterSetID = 8
	CharacterSet_latin2   CharacterSetID = 9
	CharacterSet_latin5   CharacterSetID = 30
	CharacterSet_latin7   CharacterSetID = 41
	CharacterSet_macce    CharacterSetID = 38
	CharacterSet_macroman CharacterSetID = 39
	CharacterSet_sjis     CharacterSetID = 13
	CharacterSet_swe7     CharacterSetID = 10
	CharacterSet_tis620   CharacterSetID = 18
	CharacterSet_ucs2     CharacterSetID = 35
	CharacterSet_ujis     CharacterSetID = 12
	CharacterSet_utf16    CharacterSetID = 54
	CharacterSet_utf16le  CharacterSetID = 56
	CharacterSet_utf32    CharacterSetID = 60
	CharacterSet_utf8mb3  CharacterSetID = 33
	CharacterSet_utf8mb4  CharacterSetID = 255

	CharacterSet_utf8 = CharacterSet_utf8mb3

	// CharacterSet_Unspecified is used when a character set has not been specified, either explicitly or implicitly.
	// This is usually used as an intermediate character set to be later replaced by an analyzer pass or a plan,
	// although it is valid to use it directly. When used, behaves identically to the character set belonging to the
	// default collation, although it will NOT match the aforementioned character set.
	CharacterSet_Unspecified CharacterSetID = 0
)

// characterSetArray contains the details of every character set, indexed by their ID. This allows for character sets to
// be efficiently passed around (since only an uint16 is needed), while still being able to quickly access all of their
// properties (index lookups are significantly faster than map lookups).
var characterSetArray = [256]CharacterSet{
	/*000*/ {CharacterSet_Unspecified, "", Collation_Unspecified, Collation_Unspecified, "", 0, nil},
	/*001*/ {CharacterSet_big5, "big5", Collation_big5_chinese_ci, Collation_big5_bin, "Big5 Traditional Chinese", 2, nil},
	/*002*/ {},
	/*003*/ {CharacterSet_dec8, "dec8", Collation_dec8_swedish_ci, Collation_dec8_bin, "DEC West European", 1, encodings.Dec8},
	/*004*/ {CharacterSet_cp850, "cp850", Collation_cp850_general_ci, Collation_cp850_bin, "DOS West European", 1, nil},
	/*005*/ {},
	/*006*/ {CharacterSet_hp8, "hp8", Collation_hp8_english_ci, Collation_hp8_bin, "HP West European", 1, nil},
	/*007*/ {CharacterSet_koi8r, "koi8r", Collation_koi8r_general_ci, Collation_koi8r_bin, "KOI8-R Relcom Russian", 1, nil},
	/*008*/ {CharacterSet_latin1, "latin1", Collation_latin1_swedish_ci, Collation_latin1_bin, "cp1252 West European", 1, encodings.Latin1},
	/*009*/ {CharacterSet_latin2, "latin2", Collation_latin2_general_ci, Collation_latin2_bin, "ISO 8859-2 Central European", 1, nil},
	/*010*/ {CharacterSet_swe7, "swe7", Collation_swe7_swedish_ci, Collation_swe7_bin, "7bit Swedish", 1, encodings.Swe7},
	/*011*/ {CharacterSet_ascii, "ascii", Collation_ascii_general_ci, Collation_ascii_bin, "US ASCII", 1, encodings.Ascii},
	/*012*/ {CharacterSet_ujis, "ujis", Collation_ujis_japanese_ci, Collation_ujis_bin, "EUC-JP Japanese", 3, nil},
	/*013*/ {CharacterSet_sjis, "sjis", Collation_sjis_japanese_ci, Collation_sjis_bin, "Shift-JIS Japanese", 2, nil},
	/*014*/ {},
	/*015*/ {},
	/*016*/ {CharacterSet_hebrew, "hebrew", Collation_hebrew_general_ci, Collation_hebrew_bin, "ISO 8859-8 Hebrew", 1, nil},
	/*017*/ {},
	/*018*/ {CharacterSet_tis620, "tis620", Collation_tis620_thai_ci, Collation_tis620_bin, "TIS620 Thai", 1, nil},
	/*019*/ {CharacterSet_euckr, "euckr", Collation_euckr_korean_ci, Collation_euckr_bin, "EUC-KR Korean", 2, nil},
	/*020*/ {},
	/*021*/ {},
	/*022*/ {CharacterSet_koi8u, "koi8u", Collation_koi8u_general_ci, Collation_koi8u_bin, "KOI8-U Ukrainian", 1, nil},
	/*023*/ {},
	/*024*/ {CharacterSet_gb2312, "gb2312", Collation_gb2312_chinese_ci, Collation_gb2312_bin, "GB2312 Simplified Chinese", 2, nil},
	/*025*/ {CharacterSet_greek, "greek", Collation_greek_general_ci, Collation_greek_bin, "ISO 8859-7 Greek", 1, nil},
	/*026*/ {CharacterSet_cp1250, "cp1250", Collation_cp1250_general_ci, Collation_cp1250_bin, "Windows Central European", 1, nil},
	/*027*/ {},
	/*028*/ {CharacterSet_gbk, "gbk", Collation_gbk_chinese_ci, Collation_gbk_bin, "GBK Simplified Chinese", 2, nil},
	/*029*/ {},
	/*030*/ {CharacterSet_latin5, "latin5", Collation_latin5_turkish_ci, Collation_latin5_bin, "ISO 8859-9 Turkish", 1, nil},
	/*031*/ {},
	/*032*/ {CharacterSet_armscii8, "armscii8", Collation_armscii8_general_ci, Collation_armscii8_bin, "ARMSCII-8 Armenian", 1, encodings.Armscii8},
	/*033*/ {CharacterSet_utf8mb3, "utf8mb3", Collation_utf8mb3_general_ci, Collation_utf8mb3_bin, "UTF-8 Unicode", 3, encodings.Utf8mb3},
	/*034*/ {},
	/*035*/ {CharacterSet_ucs2, "ucs2", Collation_ucs2_general_ci, Collation_ucs2_bin, "UCS-2 Unicode", 2, nil},
	/*036*/ {CharacterSet_cp866, "cp866", Collation_cp866_general_ci, Collation_cp866_bin, "DOS Russian", 1, nil},
	/*037*/ {CharacterSet_keybcs2, "keybcs2", Collation_keybcs2_general_ci, Collation_keybcs2_bin, "DOS Kamenicky Czech-Slovak", 1, nil},
	/*038*/ {CharacterSet_macce, "macce", Collation_macce_general_ci, Collation_macce_bin, "Mac Central European", 1, nil},
	/*039*/ {CharacterSet_macroman, "macroman", Collation_macroman_general_ci, Collation_macroman_bin, "Mac West European", 1, nil},
	/*040*/ {CharacterSet_cp852, "cp852", Collation_cp852_general_ci, Collation_cp852_bin, "DOS Central European", 1, nil},
	/*041*/ {CharacterSet_latin7, "latin7", Collation_latin7_general_ci, Collation_latin7_bin, "ISO 8859-13 Baltic", 1, encodings.Latin7},
	/*042*/ {},
	/*043*/ {},
	/*044*/ {},
	/*045*/ {},
	/*046*/ {},
	/*047*/ {},
	/*048*/ {},
	/*049*/ {},
	/*050*/ {},
	/*051*/ {CharacterSet_cp1251, "cp1251", Collation_cp1251_general_ci, Collation_cp1251_bin, "Windows Cyrillic", 1, nil},
	/*052*/ {},
	/*053*/ {},
	/*054*/ {CharacterSet_utf16, "utf16", Collation_utf16_general_ci, Collation_utf16_bin, "UTF-16 Unicode", 4, encodings.Utf16},
	/*055*/ {},
	/*056*/ {CharacterSet_utf16le, "utf16le", Collation_utf16le_general_ci, Collation_utf16le_bin, "UTF-16LE Unicode", 4, nil},
	/*057*/ {CharacterSet_cp1256, "cp1256", Collation_cp1256_general_ci, Collation_cp1256_bin, "Windows Arabic", 1, encodings.Cp1256},
	/*058*/ {},
	/*059*/ {CharacterSet_cp1257, "cp1257", Collation_cp1257_general_ci, Collation_cp1257_bin, "Windows Baltic", 1, encodings.Cp1257},
	/*060*/ {CharacterSet_utf32, "utf32", Collation_utf32_general_ci, Collation_utf32_bin, "UTF-32 Unicode", 4, encodings.Utf32},
	/*061*/ {},
	/*062*/ {},
	/*063*/ {CharacterSet_binary, "binary", Collation_binary, Collation_binary, "Binary pseudo charset", 1, encodings.Binary},
	/*064*/ {},
	/*065*/ {},
	/*066*/ {},
	/*067*/ {},
	/*068*/ {},
	/*069*/ {},
	/*070*/ {},
	/*071*/ {},
	/*072*/ {},
	/*073*/ {},
	/*074*/ {},
	/*075*/ {},
	/*076*/ {},
	/*077*/ {},
	/*078*/ {},
	/*079*/ {},
	/*080*/ {},
	/*081*/ {},
	/*082*/ {},
	/*083*/ {},
	/*084*/ {},
	/*085*/ {},
	/*086*/ {},
	/*087*/ {},
	/*088*/ {},
	/*089*/ {},
	/*090*/ {},
	/*091*/ {},
	/*092*/ {CharacterSet_geostd8, "geostd8", Collation_geostd8_general_ci, Collation_geostd8_bin, "GEOSTD8 Georgian", 1, encodings.Geostd8},
	/*093*/ {},
	/*094*/ {},
	/*095*/ {CharacterSet_cp932, "cp932", Collation_cp932_japanese_ci, Collation_cp932_bin, "SJIS for Windows Japanese", 2, nil},
	/*096*/ {},
	/*097*/ {CharacterSet_eucjpms, "eucjpms", Collation_eucjpms_japanese_ci, Collation_eucjpms_bin, "UJIS for Windows Japanese", 3, nil},
	/*098*/ {},
	/*099*/ {},
	/*100*/ {},
	/*101*/ {},
	/*102*/ {},
	/*103*/ {},
	/*104*/ {},
	/*105*/ {},
	/*106*/ {},
	/*107*/ {},
	/*108*/ {},
	/*109*/ {},
	/*110*/ {},
	/*111*/ {},
	/*112*/ {},
	/*113*/ {},
	/*114*/ {},
	/*115*/ {},
	/*116*/ {},
	/*117*/ {},
	/*118*/ {},
	/*119*/ {},
	/*120*/ {},
	/*121*/ {},
	/*122*/ {},
	/*123*/ {},
	/*124*/ {},
	/*125*/ {},
	/*126*/ {},
	/*127*/ {},
	/*128*/ {},
	/*129*/ {},
	/*130*/ {},
	/*131*/ {},
	/*132*/ {},
	/*133*/ {},
	/*134*/ {},
	/*135*/ {},
	/*136*/ {},
	/*137*/ {},
	/*138*/ {},
	/*139*/ {},
	/*140*/ {},
	/*141*/ {},
	/*142*/ {},
	/*143*/ {},
	/*144*/ {},
	/*145*/ {},
	/*146*/ {},
	/*147*/ {},
	/*148*/ {},
	/*149*/ {},
	/*150*/ {},
	/*151*/ {},
	/*152*/ {},
	/*153*/ {},
	/*154*/ {},
	/*155*/ {},
	/*156*/ {},
	/*157*/ {},
	/*158*/ {},
	/*159*/ {},
	/*160*/ {},
	/*161*/ {},
	/*162*/ {},
	/*163*/ {},
	/*164*/ {},
	/*165*/ {},
	/*166*/ {},
	/*167*/ {},
	/*168*/ {},
	/*169*/ {},
	/*170*/ {},
	/*171*/ {},
	/*172*/ {},
	/*173*/ {},
	/*174*/ {},
	/*175*/ {},
	/*176*/ {},
	/*177*/ {},
	/*178*/ {},
	/*179*/ {},
	/*180*/ {},
	/*181*/ {},
	/*182*/ {},
	/*183*/ {},
	/*184*/ {},
	/*185*/ {},
	/*186*/ {},
	/*187*/ {},
	/*188*/ {},
	/*189*/ {},
	/*100*/ {},
	/*191*/ {},
	/*192*/ {},
	/*193*/ {},
	/*194*/ {},
	/*195*/ {},
	/*196*/ {},
	/*197*/ {},
	/*198*/ {},
	/*199*/ {},
	/*200*/ {},
	/*201*/ {},
	/*202*/ {},
	/*203*/ {},
	/*204*/ {},
	/*205*/ {},
	/*206*/ {},
	/*207*/ {},
	/*208*/ {},
	/*209*/ {},
	/*210*/ {},
	/*211*/ {},
	/*212*/ {},
	/*213*/ {},
	/*214*/ {},
	/*215*/ {},
	/*216*/ {},
	/*217*/ {},
	/*218*/ {},
	/*219*/ {},
	/*220*/ {},
	/*221*/ {},
	/*222*/ {},
	/*223*/ {},
	/*224*/ {},
	/*225*/ {},
	/*226*/ {},
	/*227*/ {},
	/*228*/ {},
	/*229*/ {},
	/*230*/ {},
	/*231*/ {},
	/*232*/ {},
	/*233*/ {},
	/*234*/ {},
	/*235*/ {},
	/*236*/ {},
	/*237*/ {},
	/*238*/ {},
	/*239*/ {},
	/*240*/ {},
	/*241*/ {},
	/*242*/ {},
	/*243*/ {},
	/*244*/ {},
	/*245*/ {},
	/*246*/ {},
	/*247*/ {},
	/*248*/ {CharacterSet_gb18030, "gb18030", Collation_gb18030_chinese_ci, Collation_gb18030_bin, "China National Standard GB18030", 4, nil},
	/*249*/ {},
	/*250*/ {},
	/*251*/ {},
	/*252*/ {},
	/*253*/ {},
	/*254*/ {},
	/*255*/ {CharacterSet_utf8mb4, "utf8mb4", Collation_utf8mb4_0900_ai_ci, Collation_utf8mb4_bin, "UTF-8 Unicode", 4, encodings.Utf8mb4},
}

// init is used to set the unspecified character set's details to match those of the default collation's character set.
func init() {
	defaultCharacterSet := characterSetArray[Collation_Default.CharacterSet()]
	characterSetArray[0].Name = defaultCharacterSet.Name
	characterSetArray[0].Description = defaultCharacterSet.Description
	characterSetArray[0].MaxLength = defaultCharacterSet.MaxLength
	characterSetArray[0].Encoder = defaultCharacterSet.Encoder
}

// characterSetStringToID maps a character set's name to its ID.
var characterSetStringToID = map[string]CharacterSetID{
	"armscii8": CharacterSet_armscii8,
	"ascii":    CharacterSet_ascii,
	"big5":     CharacterSet_big5,
	"binary":   CharacterSet_binary,
	"cp1250":   CharacterSet_cp1250,
	"cp1251":   CharacterSet_cp1251,
	"cp1256":   CharacterSet_cp1256,
	"cp1257":   CharacterSet_cp1257,
	"cp850":    CharacterSet_cp850,
	"cp852":    CharacterSet_cp852,
	"cp866":    CharacterSet_cp866,
	"cp932":    CharacterSet_cp932,
	"dec8":     CharacterSet_dec8,
	"eucjpms":  CharacterSet_eucjpms,
	"euckr":    CharacterSet_euckr,
	"gb18030":  CharacterSet_gb18030,
	"gb2312":   CharacterSet_gb2312,
	"gbk":      CharacterSet_gbk,
	"geostd8":  CharacterSet_geostd8,
	"greek":    CharacterSet_greek,
	"hebrew":   CharacterSet_hebrew,
	"hp8":      CharacterSet_hp8,
	"keybcs2":  CharacterSet_keybcs2,
	"koi8r":    CharacterSet_koi8r,
	"koi8u":    CharacterSet_koi8u,
	"latin1":   CharacterSet_latin1,
	"latin2":   CharacterSet_latin2,
	"latin5":   CharacterSet_latin5,
	"latin7":   CharacterSet_latin7,
	"macce":    CharacterSet_macce,
	"macroman": CharacterSet_macroman,
	"sjis":     CharacterSet_sjis,
	"swe7":     CharacterSet_swe7,
	"tis620":   CharacterSet_tis620,
	"ucs2":     CharacterSet_ucs2,
	"ujis":     CharacterSet_ujis,
	"utf16":    CharacterSet_utf16,
	"utf16le":  CharacterSet_utf16le,
	"utf32":    CharacterSet_utf32,
	"utf8":     CharacterSet_utf8mb3,
	"utf8mb3":  CharacterSet_utf8mb3,
	"utf8mb4":  CharacterSet_utf8mb4,
}

// SupportedCharsets contains all non-binary character sets that are currently supported.
var SupportedCharsets = []CharacterSetID{
	CharacterSet_utf8mb4,
}

// ParseCharacterSet takes in a string representing a CharacterSet and returns the result if a match is found, or an
// error if not.
func ParseCharacterSet(str string) (CharacterSetID, error) {
	// Empty string is valid, as some analyzer steps may temporarily use the invalid charset
	if len(str) == 0 {
		return CharacterSet_Unspecified, nil
	}
	cs, ok := characterSetStringToID[strings.ToLower(str)]
	if !ok {
		return CharacterSet_Unspecified, ErrCharSetUnknown.New(str)
	}
	return cs, nil
}

// Name returns the name of this CharacterSet.
func (cs CharacterSetID) Name() string {
	return characterSetArray[cs].Name
}

// DefaultCollation returns the default CollationID for this CharacterSet.
func (cs CharacterSetID) DefaultCollation() CollationID {
	return characterSetArray[cs].DefaultCollation
}

// BinaryCollation returns the binary CollationID for this CharacterSet.
func (cs CharacterSetID) BinaryCollation() CollationID {
	return characterSetArray[cs].BinaryCollation
}

// Description returns the plain-English description of the CharacterSet.
func (cs CharacterSetID) Description() string {
	return characterSetArray[cs].Description
}

// MaxLength returns the maximum size of a single character in the CharacterSet.
func (cs CharacterSetID) MaxLength() int64 {
	return int64(characterSetArray[cs].MaxLength)
}

// String returns the string representation of the CharacterSet.
func (cs CharacterSetID) String() string {
	return characterSetArray[cs].Name
}

// Encoder returns this CharacterSet's encoder. As character sets are a work-in-progress, it is
// recommended to check if it is nil before allowing the character set to be set within a table.
func (cs CharacterSetID) Encoder() encodings.Encoder {
	return characterSetArray[cs].Encoder
}

// NewCharacterSetsIterator returns a new CharacterSetsIterator.
func NewCharacterSetsIterator() *CharacterSetsIterator {
	return &CharacterSetsIterator{0}
}

// Next returns the next character set. If all character sets have been iterated over, returns false.
func (csi *CharacterSetsIterator) Next() (CharacterSet, bool) {
	for ; csi.idx < len(characterSetArray); csi.idx++ {
		if characterSetArray[csi.idx].ID == 0 {
			continue
		}
		csi.idx++
		return characterSetArray[csi.idx-1], true
	}
	return CharacterSet{}, false
}
