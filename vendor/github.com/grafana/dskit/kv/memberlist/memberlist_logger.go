package memberlist

import (
	"io"
	"regexp"
	"strings"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

// loggerAdapter wraps a Logger and allows it to be passed to the stdlib
// logger's SetOutput. It understand and parses output produced by memberlist
// library (esp. level). Timestamp from memberlist can be ignored (eg. pkg/util/log.Logger
// is set up to auto-include timestamp with every message already)
type loggerAdapter struct {
	log.Logger
	logTimestamp bool
}

// newMemberlistLoggerAdapter returns a new loggerAdapter, that can be passed
// memberlist.Config.LogOutput field.
func newMemberlistLoggerAdapter(logger log.Logger, logTimestamp bool) io.Writer {
	a := loggerAdapter{
		Logger:       logger,
		logTimestamp: logTimestamp,
	}
	return a
}

func (a loggerAdapter) Write(p []byte) (int, error) {
	result := subexps(p)
	keyvals := []interface{}{}
	var timestamp string
	if date, ok := result["date"]; ok && date != "" {
		timestamp = date
	}
	if time, ok := result["time"]; ok && time != "" {
		if timestamp != "" {
			timestamp += " "
		}
		timestamp += time
	}
	if a.logTimestamp && timestamp != "" {
		keyvals = append(keyvals, "ts", timestamp)
	}
	if file, ok := result["file"]; ok && file != "" {
		keyvals = append(keyvals, "file", file)
	}
	if lvl, ok := result["level"]; ok {
		lvl = strings.ToLower(lvl)
		var lvlVal level.Value

		switch lvl {
		case "debug":
			lvlVal = level.DebugValue()
		case "warn":
			lvlVal = level.WarnValue()
		case "info":
			lvlVal = level.InfoValue()
		case "err", "error":
			lvlVal = level.ErrorValue()
		}

		if lvlVal != nil {
			keyvals = append(keyvals, "level", lvlVal)
		} else {
			keyvals = append(keyvals, "level", lvl)
		}
	}
	if msg, ok := result["msg"]; ok {
		keyvals = append(keyvals, "msg", msg)
	}
	if err := a.Log(keyvals...); err != nil {
		return 0, err
	}
	return len(p), nil
}

// 2019/10/01 12:05:06 [DEBUG] memberlist: Failed to join 127.0.0.1: dial tcp 127.0.0.1:8012: connect: connection refused
// 2019/10/01 12:07:34 /Users/test/go/pkg/mod/github.com/hashicorp/memberlist@v0.1.4/memberlist.go:245: [DEBUG] memberlist: Failed to join ::1: dial tcp [::1]:8012: connect: connection refused
const (
	logRegexpDate  = `(?P<date>[0-9]{4}/[0-9]{2}/[0-9]{2})?[ ]?`
	logRegexpTime  = `(?P<time>[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?)?[ ]?`
	logRegexpFile  = `(?P<file>[^: ]+?:[0-9]+)?(: )?`
	logRegexpLevel = `(\[(?P<level>[A-Z]+)\] )?`
	logRegexpMsg   = `(?:memberlist: )?(?P<msg>.*)`
)

var (
	logRegexp = regexp.MustCompile(logRegexpDate + logRegexpTime + logRegexpFile + logRegexpLevel + logRegexpMsg)
)

func subexps(line []byte) map[string]string {
	m := logRegexp.FindSubmatch(line)
	if len(m) < len(logRegexp.SubexpNames()) {
		return map[string]string{}
	}
	result := map[string]string{}
	for i, name := range logRegexp.SubexpNames() {
		if name != "" {
			result[name] = string(m[i])
		}
	}
	return result
}
