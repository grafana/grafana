/*
Package strftime provides strftime/strptime compatible time formatting and parsing.

The following formatting specifiers are available:

	Date (Year, Month, Day):
	  %Y - Year with century (can be negative, 4 digits at least)
	          -0001, 0000, 1995, 2009, 14292, etc.
	  %C - year / 100 (round down, 20 in 2009)
	  %y - year % 100 (00..99)

	  %m - Month of the year, zero-padded (01..12)
	          %-m  no-padded (1..12)
	  %B - Full month name (January)
	  %b - Abbreviated month name (Jan)
	  %h - Equivalent to %b

	  %d - Day of the month, zero-padded  (01..31)
	          %-d  no-padded (1..31)
	  %e - Day of the month, blank-padded ( 1..31)

	  %j - Day of the year (001..366)
	          %-j  no-padded (1..366)

	Time (Hour, Minute, Second, Subsecond):
	  %H - Hour of the day, 24-hour clock, zero-padded  (00..23)
	          %-H  no-padded (0..23)
	  %k - Hour of the day, 24-hour clock, blank-padded ( 0..23)
	  %I - Hour of the day, 12-hour clock, zero-padded  (01..12)
	          %-I  no-padded (1..12)
	  %l - Hour of the day, 12-hour clock, blank-padded ( 1..12)
	  %P - Meridian indicator, lowercase (am or pm)
	  %p - Meridian indicator, uppercase (AM or PM)

	  %M - Minute of the hour (00..59)
	          %-M  no-padded (0..59)

	  %S - Second of the minute (00..60)
	          %-S  no-padded (0..60)

	  %L - Millisecond of the second (000..999)
	  %f - Microsecond of the second (000000..999999)
	  %N - Nanosecond  of the second (000000000..999999999)

	Time zone:
	  %z - Time zone as hour and minute offset from UTC (e.g. +0900)
	          %:z - hour and minute offset from UTC with a colon (e.g. +09:00)
	  %Z - Time zone abbreviation (e.g. MST)

	Weekday:
	  %A - Full weekday name (Sunday)
	  %a - Abbreviated weekday name (Sun)
	  %u - Day of the week (Monday is 1, 1..7)
	  %w - Day of the week (Sunday is 0, 0..6)

	ISO 8601 week-based year and week number:
	Week 1 of YYYY starts with a Monday and includes YYYY-01-04.
	The days in the year before the first week are in the last week of
	the previous year.
	  %G - Week-based year
	  %g - Last 2 digits of the week-based year (00..99)
	  %V - Week number of the week-based year (01..53)
	          %-V  no-padded (1..53)

	Week number:
	Week 1 of YYYY starts with a Sunday or Monday (according to %U or %W).
	The days in the year before the first week are in week 0.
	  %U - Week number of the year.  The week starts with Sunday.  (00..53)
	          %-U  no-padded (0..53)
	  %W - Week number of the year.  The week starts with Monday.  (00..53)
	          %-W  no-padded (0..53)

	Seconds since the Unix Epoch:
	  %s - Number of seconds since 1970-01-01 00:00:00 UTC.
	  %Q - Number of milliseconds since 1970-01-01 00:00:00 UTC.

	Literal string:
	  %n - Newline character (\n)
	  %t - Tab character (\t)
	  %% - Literal % character

	Combination:
	  %c - date and time (%a %b %e %T %Y)
	  %D - Date (%m/%d/%y)
	  %F - ISO 8601 date format (%Y-%m-%d)
	  %v - VMS date (%e-%b-%Y)
	  %x - Same as %D
	  %X - Same as %T
	  %r - 12-hour time (%I:%M:%S %p)
	  %R - 24-hour time (%H:%M)
	  %T - 24-hour time (%H:%M:%S)
	  %+ - date(1) (%a %b %e %H:%M:%S %Z %Y)

The modifiers “E” and “O” are ignored.
*/
package strftime
