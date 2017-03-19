package moment

import (
	"regexp"
	"strings"
)

type StrftimeParser struct{}

var (
	replacements_pattern = regexp.MustCompile("%[mbhBedjwuaAVgyGYpPkHlIMSZzsTrRTDFXx]")
)

// Not implemented
// U
// C

var strftime_replacements = map[string]string{
	"%m": "01",  // stdZeroMonth 01 02 ... 11 12
	"%b": "Jan", // stdMonth Jan Feb ... Nov Dec
	"%h": "Jan",
	"%B": "January",           // stdLongMonth January February ... November December
	"%e": "2",                 // stdDay 1 2 ... 30 30
	"%d": "02",                // stdZeroDay 01 02 ... 30 31
	"%j": "<stdDayOfYear>",    // Day of the year ***001 002 ... 364 365 @todo****
	"%w": "<stdDayOfWeek>",    // Numeric representation of day of the week 0 1 ... 5 6
	"%u": "<stdDayOfWeekISO>", // ISO-8601 numeric representation of the day of the week (added in PHP 5.1.0) 1 2 ... 6 7 @todo
	"%a": "Mon",               // Sun Mon ... Fri Sat
	"%A": "Monday",            // stdLongWeekDay Sunday Monday ... Friday Saturday
	"%V": "<stdWeekOfYear>",   // ***01 02 ... 52 53  @todo begin with zeros
	"%g": "06",                // stdYear 70 71 ... 29 30
	"%y": "06",
	"%G": "2006", // stdLongYear 1970 1971 ... 2029 2030
	"%Y": "2006",
	"%p": "PM",        // stdPM AM PM
	"%P": "pm",        // stdpm am pm
	"%k": "15",        // stdHour 0 1 ... 22 23
	"%H": "15",        // 00 01 ... 22 23
	"%l": "3",         // stdHour12 1 2 ... 11 12
	"%I": "03",        // stdZeroHour12 01 02 ... 11 12
	"%M": "04",        // stdZeroMinute 00 01 ... 58 59
	"%S": "05",        // stdZeroSecond ***00 01 ... 58 59
	"%Z": "MST",       //EST CST ... MST PST
	"%z": "-0700",     // stdNumTZ -0700 -0600 ... +0600 +0700
	"%s": "<stdUnix>", // Seconds since unix epoch 1360013296
	"%r": "03:04:05 PM",
	"%R": "15:04",
	"%T": "15:04:05",
	"%D": "01/02/06",
	"%F": "2006-01-02",
	"%X": "15:04:05",
	"%x": "01/02/06",
}

func (p *StrftimeParser) Convert(layout string) string {
	var match [][]string
	if match = replacements_pattern.FindAllStringSubmatch(layout, -1); match == nil {
		return layout
	}

	for i := range match {
		if replace, ok := strftime_replacements[match[i][0]]; ok {
			layout = strings.Replace(layout, match[i][0], replace, 1)
		}
	}

	return layout
}
