package moment

import (
	"fmt"
	"math"
	"time"
)

// @todo In months/years requires the old and new to calculate correctly, right?
// @todo decide how to handle rounding (i.e. always floor?)
type Diff struct {
	duration time.Duration
}

func (d *Diff) InSeconds() int {
	return int(d.duration.Seconds())
}

func (d *Diff) InMinutes() int {
	return int(d.duration.Minutes())
}

func (d *Diff) InHours() int {
	return int(d.duration.Hours())
}

func (d *Diff) InDays() int {
	return int(math.Floor(float64(d.InSeconds()) / 86400))
}

// This depends on where the weeks fall?
func (d *Diff) InWeeks() int {
	return int(math.Floor(float64(d.InDays() / 7)))
}

func (d *Diff) InMonths() int {
	return 0
}

func (d *Diff) InYears() int {
	return 0
}

// http://momentjs.com/docs/#/durations/humanize/
func (d *Diff) Humanize() string {
	diffInSeconds := d.InSeconds()

	if diffInSeconds <= 45 {
		return fmt.Sprintf("%d seconds ago", diffInSeconds)
	} else if diffInSeconds <= 90 {
		return "a minute ago"
	}

	diffInMinutes := d.InMinutes()

	if diffInMinutes <= 45 {
		return fmt.Sprintf("%d minutes ago", diffInMinutes)
	} else if diffInMinutes <= 90 {
		return "an hour ago"
	}

	diffInHours := d.InHours()

	if diffInHours <= 22 {
		return fmt.Sprintf("%d hours ago", diffInHours)
	} else if diffInHours <= 36 {
		return "a day ago"
	}

	return "diff is in days"
}

// In Months

// In years
