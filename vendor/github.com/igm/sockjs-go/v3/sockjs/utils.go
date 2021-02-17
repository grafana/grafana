package sockjs

import "encoding/json"

func quote(in string) string {
	quoted, _ := json.Marshal(in)
	return string(quoted)
}

func transform(values []string, transformFn func(string) string) []string {
	ret := make([]string, len(values))
	for i, msg := range values {
		ret[i] = transformFn(msg)
	}
	return ret
}
