package cp

import (
	"strings"
)

type charsetMap struct {
	sb [256]rune    // single byte runes, -1 for a double byte character lead byte
	db map[int]rune // double byte runes
}

func collation2charset(col Collation) *charsetMap {
	// http://msdn.microsoft.com/en-us/library/ms144250.aspx
	// http://msdn.microsoft.com/en-us/library/ms144250(v=sql.105).aspx
	switch col.SortId {
	case 30, 31, 32, 33, 34:
		return getcp437()
	case 40, 41, 42, 44, 49, 55, 56, 57, 58, 59, 60, 61:
		return getcp850()
	case 50, 51, 52, 53, 54, 71, 72, 73, 74, 75:
		return getcp1252()
	case 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96:
		return getcp1250()
	case 104, 105, 106, 107, 108:
		return getcp1251()
	case 112, 113, 114, 121, 124:
		return getcp1253()
	case 128, 129, 130:
		return getcp1254()
	case 136, 137, 138:
		return getcp1255()
	case 144, 145, 146:
		return getcp1256()
	case 152, 153, 154, 155, 156, 157, 158, 159, 160:
		return getcp1257()
	case 183, 184, 185, 186:
		return getcp1252()
	case 192, 193:
		return getcp932()
	case 194, 195:
		return getcp949()
	case 196, 197:
		return getcp950()
	case 198, 199:
		return getcp936()
	case 200:
		return getcp932()
	case 201:
		return getcp949()
	case 202:
		return getcp950()
	case 203:
		return getcp936()
	case 204, 205, 206:
		return getcp874()
	case 210, 211, 212, 213, 214, 215, 216, 217:
		return getcp1252()
	}
	// http://technet.microsoft.com/en-us/library/aa176553(v=sql.80).aspx
	switch col.getLcid() {
	case 0x001e, 0x041e:
		return getcp874()
	case 0x0411, 0x10411, 0x40411:
		return getcp932()
	case 0x0804, 0x1004, 0x20804:
		return getcp936()
	case 0x0012, 0x0412:
		return getcp949()
	case 0x0404, 0x1404, 0x0c04, 0x7c04, 0x30404, 0x21404:
		return getcp950()
	case 0x041c, 0x041a, 0x0405, 0x040e, 0x104e, 0x0415, 0x0418, 0x041b, 0x0424, 0x1040e, 0x0442, 0x081A, 0x141A:
		return getcp1250()
	case 0x0423, 0x0402, 0x042f, 0x0419, 0x0c1a, 0x0422, 0x043f, 0x0444, 0x082c, 0x046D, 0x0485, 0x201A:
		return getcp1251()
	case 0x0408:
		return getcp1253()
	case 0x041f, 0x042c, 0x0443:
		return getcp1254()
	case 0x040d:
		return getcp1255()
	case 0x0401, 0x0801, 0xc01, 0x1001, 0x1401, 0x1801, 0x1c01, 0x2001, 0x2401, 0x2801, 0x2c01, 0x3001, 0x3401, 0x3801, 0x3c01, 0x4001, 0x0429, 0x0420, 0x0480, 0x048C:
		return getcp1256()
	case 0x0425, 0x0426, 0x0427, 0x0827:
		return getcp1257()
	case 0x042a:
		return getcp1258()
	case 0x0439, 0x045a, 0x0465, 0x043A, 0x0445, 0x044D, 0x0451, 0x0453, 0x0454, 0x0461, 0x0463, 0x0481:
		return nil
	}
	return getcp1252()
}

func CharsetToUTF8(col Collation, s []byte) string {
	cm := collation2charset(col)
	if cm == nil {
		return string(s)
	}

	buf := strings.Builder{}
	buf.Grow(len(s))
	for i := 0; i < len(s); i++ {
		ch := cm.sb[s[i]]
		if ch == -1 {
			if i+1 == len(s) {
				ch = 0xfffd
			} else {
				n := int(s[i+1]) + (int(s[i]) << 8)
				i++
				var ok bool
				ch, ok = cm.db[n]
				if !ok {
					ch = 0xfffd
				}
			}
		}
		buf.WriteRune(ch)
	}
	return buf.String()
}
