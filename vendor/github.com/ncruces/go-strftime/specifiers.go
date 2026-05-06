package strftime

import "strings"

// https://strftime.org/
func goLayout(spec, flag byte, parsing bool) string {
	switch spec {
	default:
		return ""

	case 'B':
		return "January"
	case 'b', 'h':
		return "Jan"
	case 'm':
		if flag == '-' || parsing {
			return "1"
		}
		return "01"
	case 'A':
		return "Monday"
	case 'a':
		return "Mon"
	case 'e':
		return "_2"
	case 'd':
		if flag == '-' || parsing {
			return "2"
		}
		return "02"
	case 'j':
		if flag == '-' {
			if parsing {
				return "__2"
			}
			return ""
		}
		return "002"
	case 'I':
		if flag == '-' || parsing {
			return "3"
		}
		return "03"
	case 'H':
		if flag == '-' && !parsing {
			return ""
		}
		return "15"
	case 'M':
		if flag == '-' || parsing {
			return "4"
		}
		return "04"
	case 'S':
		if flag == '-' || parsing {
			return "5"
		}
		return "05"
	case 'y':
		return "06"
	case 'Y':
		return "2006"
	case 'p':
		return "PM"
	case 'P':
		return "pm"
	case 'Z':
		return "MST"
	case 'z':
		if flag == ':' {
			if parsing {
				return "Z07:00"
			}
			return "-07:00"
		}
		if parsing {
			return "Z0700"
		}
		return "-0700"

	case '+':
		if parsing {
			return "Mon Jan _2 15:4:5 MST 2006"
		}
		return "Mon Jan _2 15:04:05 MST 2006"
	case 'c':
		if parsing {
			return "Mon Jan _2 15:4:5 2006"
		}
		return "Mon Jan _2 15:04:05 2006"
	case 'v':
		return "_2-Jan-2006"
	case 'F':
		if parsing {
			return "2006-1-2"
		}
		return "2006-01-02"
	case 'D', 'x':
		if parsing {
			return "1/2/06"
		}
		return "01/02/06"
	case 'r':
		if parsing {
			return "3:4:5 PM"
		}
		return "03:04:05 PM"
	case 'T', 'X':
		if parsing {
			return "15:4:5"
		}
		return "15:04:05"
	case 'R':
		if parsing {
			return "15:4"
		}
		return "15:04"

	case '%':
		return "%"
	case 't':
		return "\t"
	case 'n':
		return "\n"
	}
}

// https://nsdateformatter.com/
func uts35Pattern(spec, flag byte) string {
	switch spec {
	default:
		return ""

	case 'B':
		return "MMMM"
	case 'b', 'h':
		return "MMM"
	case 'm':
		if flag == '-' {
			return "M"
		}
		return "MM"
	case 'A':
		return "EEEE"
	case 'a':
		return "E"
	case 'd':
		if flag == '-' {
			return "d"
		}
		return "dd"
	case 'j':
		if flag == '-' {
			return "D"
		}
		return "DDD"
	case 'I':
		if flag == '-' {
			return "h"
		}
		return "hh"
	case 'H':
		if flag == '-' {
			return "H"
		}
		return "HH"
	case 'M':
		if flag == '-' {
			return "m"
		}
		return "mm"
	case 'S':
		if flag == '-' {
			return "s"
		}
		return "ss"
	case 'y':
		return "yy"
	case 'Y':
		return "yyyy"
	case 'g':
		return "YY"
	case 'G':
		return "YYYY"
	case 'V':
		if flag == '-' {
			return "w"
		}
		return "ww"
	case 'p':
		return "a"
	case 'Z':
		return "zzz"
	case 'z':
		if flag == ':' {
			return "xxx"
		}
		return "xx"
	case 'L':
		return "SSS"
	case 'f':
		return "SSSSSS"
	case 'N':
		return "SSSSSSSSS"

	case '+':
		return "E MMM d HH:mm:ss zzz yyyy"
	case 'c':
		return "E MMM d HH:mm:ss yyyy"
	case 'v':
		return "d-MMM-yyyy"
	case 'F':
		return "yyyy-MM-dd"
	case 'D', 'x':
		return "MM/dd/yy"
	case 'r':
		return "hh:mm:ss a"
	case 'T', 'X':
		return "HH:mm:ss"
	case 'R':
		return "HH:mm"

	case '%':
		return "%"
	case 't':
		return "\t"
	case 'n':
		return "\n"
	}
}

// http://man.he.net/man3/strftime
func okModifier(mod, spec byte) bool {
	if mod == 'E' {
		return strings.Contains("cCxXyY", string(spec))
	}
	if mod == 'O' {
		return strings.Contains("deHImMSuUVwWy", string(spec))
	}
	return false
}
