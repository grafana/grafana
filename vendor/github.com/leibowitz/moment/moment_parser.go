package moment

import (
	"regexp"
	"strings"
)

type MomentParser struct{}

var (
	date_pattern = regexp.MustCompile("(LT|LL?L?L?|l{1,4}|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|SS?S?|X|zz?|ZZ?|Q)")
)

/*
	+	<stdOrdinal> 					S (makes any number before it ordinal)
	+	stdDayOfYear					1,2,365
	+	stdDayOfYearZero			001, 002, 365
	+	stdDayOfWeek					w 0, 1, 2 numeric day of the week (0 = sunday)
	+	stdDayOfWeekISO				N 1 = Monday
	+	stdWeekOfYear					W Iso week number of year
	+	stdUnix								U
    +   stdQuarter
*/

// Thanks to https://github.com/fightbulc/moment.php for replacement keys and regex
var moment_replacements = map[string]string{
	"M":    "1",                           // stdNumMonth 1 2 ... 11 12
	"Mo":   "1<stdOrdinal>",               // stdNumMonth 1st 2nd ... 11th 12th
	"MM":   "01",                          // stdZeroMonth 01 02 ... 11 12
	"MMM":  "Jan",                         // stdMonth Jan Feb ... Nov Dec
	"MMMM": "January",                     // stdLongMonth January February ... November December
	"D":    "2",                           // stdDay 1 2 ... 30 30
	"Do":   "2<stdOrdinal>",               // stdDay 1st 2nd ... 30th 31st  @todo support st nd th etch
	"DD":   "02",                          // stdZeroDay 01 02 ... 30 31
	"DDD":  "<stdDayOfYear>",              // Day of the year 1 2 ... 364 365
	"DDDo": "<stdDayOfYear><stdOrdinal>",  // Day of the year 1st 2nd ... 364th 365th
	"DDDD": "<stdDayOfYearZero>",          // Day of the year 001 002 ... 364 365 @todo****
	"d":    "<stdDayOfWeek>",              // Numeric representation of day of the week 0 1 ... 5 6
	"do":   "<stdDayOfWeek><stdOrdinal>",  // 0th 1st ... 5th 6th
	"dd":   "Mon",                         // ***Su Mo ... Fr Sa @todo
	"ddd":  "Mon",                         // Sun Mon ... Fri Sat
	"dddd": "Monday",                      // stdLongWeekDay Sunday Monday ... Friday Saturday
	"e":    "<stdDayOfWeek>",              // Numeric representation of day of the week 0 1 ... 5 6 @todo
	"E":    "<stdDayOfWeekISO>",           // ISO-8601 numeric representation of the day of the week (added in PHP 5.1.0) 1 2 ... 6 7 @todo
	"w":    "<stdWeekOfYear>",             // 1 2 ... 52 53
	"wo":   "<stdWeekOfYear><stdOrdinal>", // 1st 2nd ... 52nd 53rd
	"ww":   "<stdWeekOfYear>",             // ***01 02 ... 52 53 @todo
	"W":    "<stdWeekOfYear>",             // 1 2 ... 52 53
	"Wo":   "<stdWeekOfYear><stdOrdinal>", // 1st 2nd ... 52nd 53rd
	"WW":   "<stdWeekOfYear>",             // ***01 02 ... 52 53 @todo
	"YY":   "06",                          // stdYear 70 71 ... 29 30
	"YYYY": "2006",                        // stdLongYear 1970 1971 ... 2029 2030
	// "gg"      : "o", 				 // ISO-8601 year number 70 71 ... 29 30 @todo
	// "gggg"    : "o", // ***1970 1971 ... 2029 2030 @todo
	// "GG"      : "o", //70 71 ... 29 30 @todo
	// "GGGG"    : "o", // ***1970 1971 ... 2029 2030 @todo
	"Q":  "<stdQuarter>",
	"A":  "PM",              // stdPM AM PM
	"a":  "pm",              // stdpm am pm
	"H":  "<stdHourNoZero>", // stdHour 0 1 ... 22 23
	"HH": "15",              // 00 01 ... 22 23
	"h":  "3",               // stdHour12 1 2 ... 11 12
	"hh": "03",              // stdZeroHour12 01 02 ... 11 12
	"m":  "4",               // stdZeroMinute 0 1 ... 58 59
	"mm": "04",              // stdZeroMinute 00 01 ... 58 59
	"s":  "5",               // stdSecond 0 1 ... 58 59
	"ss": "05",              // stdZeroSecond ***00 01 ... 58 59
	// "S"       : "", //0 1 ... 8 9
	// "SS"      : "", //0 1 ... 98 99
	// "SSS"     : "", //0 1 ... 998 999
	"z":    "MST",                                        //EST CST ... MST PST
	"zz":   "MST",                                        //EST CST ... MST PST
	"Z":    "Z07:00",                                     // stdNumColonTZ -07:00 -06:00 ... +06:00 +07:00
	"ZZ":   "-0700",                                      // stdNumTZ -0700 -0600 ... +0600 +0700
	"X":    "<stdUnix>",                                  // Seconds since unix epoch 1360013296
	"LT":   "3:04 PM",                                    // 8:30 PM
	"L":    "01/02/2006",                                 //09/04/1986
	"l":    "1/2/2006",                                   //9/4/1986
	"LL":   "January 2<stdOrdinal> 2006",                 //September 4th 1986 the php s flag isn't supported
	"ll":   "Jan 2 2006",                                 //Sep 4 1986
	"LLL":  "January 2<stdOrdinal> 2006 3:04 PM",         //September 4th 1986 8:30 PM @todo the php s flag isn't supported
	"lll":  "Jan 2 2006 3:04 PM",                         //Sep 4 1986 8:30 PM
	"LLLL": "Monday, January 2<stdOrdinal> 2006 3:04 PM", //Thursday, September 4th 1986 8:30 PM the php s flag isn't supported
	"llll": "Mon, Jan 2 2006 3:04 PM",                    //Thu, Sep 4 1986 8:30 PM
}

func (p *MomentParser) Convert(layout string) string {
	var match [][]string
	if match = date_pattern.FindAllStringSubmatch(layout, -1); match == nil {
		return layout
	}

	for i := range match {
		if replace, ok := moment_replacements[match[i][0]]; ok {
			layout = strings.Replace(layout, match[i][0], replace, 1)
		}
	}

	return layout
}
