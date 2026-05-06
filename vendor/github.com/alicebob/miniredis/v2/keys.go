package miniredis

// Translate the 'KEYS' or 'PSUBSCRIBE' argument ('foo*', 'f??', &c.) into a regexp.

import (
	"bytes"
	"regexp"
)

// patternRE compiles a glob to a regexp. Returns nil if the given
// pattern will never match anything.
// The general strategy is to sandwich all non-meta characters between \Q...\E.
func patternRE(k string) *regexp.Regexp {
	re := bytes.Buffer{}
	re.WriteString(`(?s)^\Q`)
	for i := 0; i < len(k); i++ {
		p := k[i]
		switch p {
		case '*':
			re.WriteString(`\E.*\Q`)
		case '?':
			re.WriteString(`\E.\Q`)
		case '[':
			charClass := bytes.Buffer{}
			i++
			for ; i < len(k); i++ {
				if k[i] == ']' {
					break
				}
				if k[i] == '\\' {
					if i == len(k)-1 {
						// Ends with a '\'. U-huh.
						return nil
					}
					charClass.WriteByte(k[i])
					i++
					charClass.WriteByte(k[i])
					continue
				}
				charClass.WriteByte(k[i])
			}
			if charClass.Len() == 0 {
				// '[]' is valid in Redis, but matches nothing.
				return nil
			}
			re.WriteString(`\E[`)
			re.Write(charClass.Bytes())
			re.WriteString(`]\Q`)

		case '\\':
			if i == len(k)-1 {
				// Ends with a '\'. U-huh.
				return nil
			}
			// Forget the \, keep the next char.
			i++
			re.WriteByte(k[i])
			continue
		default:
			re.WriteByte(p)
		}
	}
	re.WriteString(`\E$`)
	return regexp.MustCompile(re.String())
}

// matchKeys filters only matching keys.
// The returned boolean is whether the match pattern was valid
func matchKeys(keys []string, match string) ([]string, bool) {
	re := patternRE(match)
	if re == nil {
		// Special case: the given pattern won't match anything or is invalid.
		return nil, false
	}
	var res []string
	for _, k := range keys {
		if !re.MatchString(k) {
			continue
		}
		res = append(res, k)
	}
	return res, true
}
