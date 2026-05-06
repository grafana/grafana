package internal

import (
	"context"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9/internal/util"
)

func Sleep(ctx context.Context, dur time.Duration) error {
	t := time.NewTimer(dur)
	defer t.Stop()

	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func ToLower(s string) string {
	if isLower(s) {
		return s
	}

	b := make([]byte, len(s))
	for i := range b {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return util.BytesToString(b)
}

func isLower(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			return false
		}
	}
	return true
}

func ReplaceSpaces(s string) string {
	// Pre-allocate a builder with the same length as s to minimize allocations.
	// This is a basic optimization; adjust the initial size based on your use case.
	var builder strings.Builder
	builder.Grow(len(s))

	for _, char := range s {
		if char == ' ' {
			// Replace space with a hyphen.
			builder.WriteRune('-')
		} else {
			// Copy the character as-is.
			builder.WriteRune(char)
		}
	}

	return builder.String()
}

func GetAddr(addr string) string {
	ind := strings.LastIndexByte(addr, ':')
	if ind == -1 {
		return ""
	}

	if strings.IndexByte(addr, '.') != -1 {
		return addr
	}

	if addr[0] == '[' {
		return addr
	}
	return net.JoinHostPort(addr[:ind], addr[ind+1:])
}

func ToInteger(val interface{}) int {
	switch v := val.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case string:
		i, _ := strconv.Atoi(v)
		return i
	default:
		return 0
	}
}

func ToFloat(val interface{}) float64 {
	switch v := val.(type) {
	case float64:
		return v
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	default:
		return 0.0
	}
}

func ToString(val interface{}) string {
	if str, ok := val.(string); ok {
		return str
	}
	return ""
}

func ToStringSlice(val interface{}) []string {
	if arr, ok := val.([]interface{}); ok {
		result := make([]string, len(arr))
		for i, v := range arr {
			result[i] = ToString(v)
		}
		return result
	}
	return nil
}
