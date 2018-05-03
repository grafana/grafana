package moment

import (
	"fmt"
	"strings"
	"time"
)

var (
	days = []time.Weekday{
		time.Sunday,
		time.Monday,
		time.Tuesday,
		time.Wednesday,
		time.Thursday,
		time.Friday,
		time.Saturday,
	}
)

func ParseWeekDay(day string) (time.Weekday, error) {

	day = strings.ToLower(day)

	for _, d := range days {
		if day == strings.ToLower(d.String()) {
			return d, nil
		}
	}

	return -1, fmt.Errorf("Unable to parse %s as week day", day)
}
