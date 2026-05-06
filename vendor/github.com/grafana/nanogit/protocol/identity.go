package protocol

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Identity represents a Git identity (author or committer) in its raw form.
// This matches Git's internal format: "name <email> timestamp timezone"
type Identity struct {
	Name      string
	Email     string
	Timestamp int64
	Timezone  string
}

// ParseIdentity parses a Git identity string in the format "name <email> timestamp timezone"
// and returns an Identity struct.
func ParseIdentity(identity string) (*Identity, error) {
	// Find the last occurrence of '>' which marks the end of the email
	emailEnd := strings.LastIndex(identity, ">")
	if emailEnd == -1 {
		return nil, fmt.Errorf("invalid identity format: %s", identity)
	}

	// Find the start of the email
	emailStart := strings.LastIndex(identity[:emailEnd], "<")
	if emailStart == -1 {
		return nil, fmt.Errorf("invalid identity format: %s", identity)
	}

	// Extract name and email
	name := strings.TrimSpace(identity[:emailStart])
	email := identity[emailStart+1 : emailEnd]

	// Parse timestamp and timezone
	timeStr := strings.TrimSpace(identity[emailEnd+1:])
	parts := strings.Split(timeStr, " ")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid time format: %s", timeStr)
	}

	timestamp, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid timestamp: %w", err)
	}

	// Validate timezone format
	timezone := parts[1]
	if len(timezone) != 5 {
		return nil, fmt.Errorf("invalid timezone format: %s", timezone)
	}

	sign := timezone[0]
	if sign != '+' && sign != '-' {
		return nil, fmt.Errorf("invalid timezone sign: %c", sign)
	}

	// Validate hours and minutes
	hours, err := strconv.Atoi(timezone[1:3])
	if err != nil || hours > 23 {
		return nil, fmt.Errorf("invalid hours in timezone: %s", timezone)
	}

	minutes, err := strconv.Atoi(timezone[3:5])
	if err != nil || minutes > 59 {
		return nil, fmt.Errorf("invalid minutes in timezone: %s", timezone)
	}

	return &Identity{
		Name:      name,
		Email:     email,
		Timestamp: timestamp,
		Timezone:  timezone,
	}, nil
}

// String returns the string representation of the identity in Git format.
// Format: "Name <email> timestamp timezone"
func (i *Identity) String() string {
	return fmt.Sprintf("%s <%s> %d %s", i.Name, i.Email, i.Timestamp, i.Timezone)
}

// Time returns the time.Time representation of the identity's timestamp and timezone.
func (i *Identity) Time() (time.Time, error) {
	// Parse timezone offset
	if len(i.Timezone) != 5 {
		return time.Time{}, fmt.Errorf("invalid timezone offset format: %s", i.Timezone)
	}

	sign := i.Timezone[0]
	if sign != '+' && sign != '-' {
		return time.Time{}, fmt.Errorf("invalid timezone sign: %c", sign)
	}

	hours, err := strconv.Atoi(i.Timezone[1:3])
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid hours: %w", err)
	}
	if hours > 23 {
		return time.Time{}, fmt.Errorf("hours out of range (0-23): %d", hours)
	}

	minutes, err := strconv.Atoi(i.Timezone[3:5])
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid minutes: %w", err)
	}
	if minutes > 59 {
		return time.Time{}, fmt.Errorf("minutes out of range (0-59): %d", minutes)
	}

	// Convert to seconds
	seconds := hours*3600 + minutes*60
	if sign == '-' {
		seconds = -seconds
	}

	loc := time.FixedZone("", seconds)
	return time.Unix(i.Timestamp, 0).In(loc), nil
}
