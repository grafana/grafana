package ctype

const (
	UPPER     = 0x01       /* upper case letter[A-Z] */
	LOWER     = 0x02       /* lower case letter[a-z] */
	DIGIT     = 0x04       /* digit[0-9] */
	UNDERLINE = 0x08       /* underline[_] */
	XDIGIT    = 0x10       /* xdigit[0-9a-fA-F] */
	EOL       = 0x20       /* [\r\n] */
	ADD       = 0x40       /* [+] */
	SUB       = 0x80       /* [-] */
	MUL       = 0x100      /* [*] */
	DIV       = 0x200      /* [/] */
	LT        = 0x400      /* [<] */
	GT        = 0x800      /* [>] */
	EQ        = 0x1000     /* [=] */
	RDIV      = 0x2000     /* [\\], right-division, anti-slash */
	DOT       = 0x4000     /* [.] */
	COLON     = 0x8000     /* [:], colon */
	PERCENT   = 0x10000    /* [%] */
	AND       = 0x20000    /* [&] */
	OR        = 0x40000    /* [|] */
	SPACE_BAR = 0x80000    /* [ ] */
	LCAP_R    = 0x100000   /* [r] */
	LCAP_T    = 0x200000   /* [t] */
	LCAP_N    = 0x400000   /* [n] */
	LCAP_W    = 0x800000   /* [w] */
	COMMA     = 0x1000000  /* [,] */
	SEMICOLON = 0x2000000  /* [;] */
	TAB       = 0x4000000  /* [\t] */
	QUOT      = 0x8000000  /* ["] */
	BACKTICK  = 0x10000000 /* [`] */
)

const (
	BLANK                = SPACE_BAR
	TSPACE               = TAB | EOL
	SPACE                = SPACE_BAR | TSPACE
	PATH_SEP             = DIV | RDIV
	ALPHA                = UPPER | LOWER
	SYMBOL_FIRST_CHAR    = ALPHA
	SYMBOL_NEXT_CHAR     = SYMBOL_FIRST_CHAR | DIGIT
	CSYMBOL_FIRST_CHAR   = ALPHA | UNDERLINE
	CSYMBOL_NEXT_CHAR    = CSYMBOL_FIRST_CHAR | DIGIT
	XMLSYMBOL_FIRST_CHAR = CSYMBOL_FIRST_CHAR
	XMLSYMBOL_NEXT_CHAR  = CSYMBOL_NEXT_CHAR | SUB
	DOMAIN_CHAR          = ALPHA | DIGIT | SUB | ADD | DOT
	BASE64               = ALPHA | DIGIT | ADD | DIV       // [a-zA-Z0-9+/]
	URLSAFE_BASE64       = ALPHA | DIGIT | SUB | UNDERLINE // [a-zA-Z0-9\-_]
)

// -----------------------------------------------------------

var table = []uint32{
	0,              //   [0]
	0,              //   [1]
	0,              //   [2]
	0,              //   [3]
	0,              //   [4]
	0,              //   [5]
	0,              //   [6]
	0,              //   [7]
	0,              //   [8]
	TAB,            //   [9]
	EOL,            //   [10]
	0,              //   [11]
	0,              //   [12]
	EOL,            //   [13]
	0,              //   [14]
	0,              //   [15]
	0,              //   [16]
	0,              //   [17]
	0,              //   [18]
	0,              //   [19]
	0,              //   [20]
	0,              //   [21]
	0,              //   [22]
	0,              //   [23]
	0,              //   [24]
	0,              //   [25]
	0,              //   [26]
	0,              //   [27]
	0,              //   [28]
	0,              //   [29]
	0,              //   [30]
	0,              //   [31]
	SPACE_BAR,      //   [32]
	0,              // ! [33]
	QUOT,           // " [34]
	0,              // # [35]
	0,              // $ [36]
	PERCENT,        // % [37]
	AND,            // & [38]
	0,              // ' [39]
	0,              // ( [40]
	0,              // ) [41]
	MUL,            // * [42]
	ADD,            // + [43]
	COMMA,          // , [44]
	SUB,            // - [45]
	DOT,            // . [46]
	DIV,            // / [47]
	DIGIT | XDIGIT, // 0 [48]
	DIGIT | XDIGIT, // 1 [49]
	DIGIT | XDIGIT, // 2 [50]
	DIGIT | XDIGIT, // 3 [51]
	DIGIT | XDIGIT, // 4 [52]
	DIGIT | XDIGIT, // 5 [53]
	DIGIT | XDIGIT, // 6 [54]
	DIGIT | XDIGIT, // 7 [55]
	DIGIT | XDIGIT, // 8 [56]
	DIGIT | XDIGIT, // 9 [57]
	COLON,          // : [58]
	SEMICOLON,      // ; [59]
	LT,             // < [60]
	EQ,             // = [61]
	GT,             // > [62]
	0,              // ? [63]
	0,              // @ [64]
	UPPER | XDIGIT, // A [65]
	UPPER | XDIGIT, // B [66]
	UPPER | XDIGIT, // C [67]
	UPPER | XDIGIT, // D [68]
	UPPER | XDIGIT, // E [69]
	UPPER | XDIGIT, // F [70]
	UPPER,          // G [71]
	UPPER,          // H [72]
	UPPER,          // I [73]
	UPPER,          // J [74]
	UPPER,          // K [75]
	UPPER,          // L [76]
	UPPER,          // M [77]
	UPPER,          // N [78]
	UPPER,          // O [79]
	UPPER,          // P [80]
	UPPER,          // Q [81]
	UPPER,          // R [82]
	UPPER,          // S [83]
	UPPER,          // T [84]
	UPPER,          // U [85]
	UPPER,          // V [86]
	UPPER,          // W [87]
	UPPER,          // X [88]
	UPPER,          // Y [89]
	UPPER,          // Z [90]
	0,              // [ [91]
	RDIV,           // \ [92]
	0,              // ] [93]
	0,              // ^ [94]
	UNDERLINE,      // _ [95]
	BACKTICK,       // ` [96]
	LOWER | XDIGIT, // a [97]
	LOWER | XDIGIT, // b [98]
	LOWER | XDIGIT, // c [99]
	LOWER | XDIGIT, // d [100]
	LOWER | XDIGIT, // e [101]
	LOWER | XDIGIT, // f [102]
	LOWER,          // g [103]
	LOWER,          // h [104]
	LOWER,          // i [105]
	LOWER,          // j [106]
	LOWER,          // k [107]
	LOWER,          // l [108]
	LOWER,          // m [109]
	LCAP_N | LOWER, // n [110]
	LOWER,          // o [111]
	LOWER,          // p [112]
	LOWER,          // q [113]
	LCAP_R | LOWER, // r [114]
	LOWER,          // s [115]
	LCAP_T | LOWER, // t [116]
	LOWER,          // u [117]
	LOWER,          // v [118]
	LCAP_W | LOWER, // w [119]
	LOWER,          // x [120]
	LOWER,          // y [121]
	LOWER,          // z [122]
	0,              // { [123]
	OR,             // | [124]
	0,              // } [125]
	0,              // ~ [126]
	0,              // del [127]
}

// -----------------------------------------------------------

func Is(typeMask uint32, c rune) bool {

	if uint(c) < uint(len(table)) {
		return (typeMask & table[c]) != 0
	}
	return false
}

func IsType(typeMask uint32, str string) bool {

	if str == "" {
		return false
	}
	for _, c := range str {
		if !Is(typeMask, c) {
			return false
		}
	}
	return true
}

func IsTypeEx(typeFirst, typeNext uint32, str string) bool {

	if str == "" {
		return false
	}
	for i, c := range str {
		if i > 0 {
			if !Is(typeNext, c) {
				return false
			}
		} else {
			if !Is(typeFirst, c) {
				return false
			}
		}
	}
	return true
}

func IsCSymbol(str string) bool {

	return IsTypeEx(CSYMBOL_FIRST_CHAR, CSYMBOL_NEXT_CHAR, str)
}

func IsXmlSymbol(str string) bool {

	return IsTypeEx(XMLSYMBOL_FIRST_CHAR, XMLSYMBOL_NEXT_CHAR, str)
}

// -----------------------------------------------------------
