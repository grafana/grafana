package system

import (
	"errors"
	"fmt"
	"strings"
)

// SecurityOpt contains the name and options of a security option
type SecurityOpt struct {
	Name    string
	Options []KeyValue
}

// DecodeSecurityOptions decodes a security options string slice to a
// type-safe [SecurityOpt].
func DecodeSecurityOptions(opts []string) ([]SecurityOpt, error) {
	so := []SecurityOpt{}
	for _, opt := range opts {
		// support output from a < 1.13 docker daemon
		if !strings.Contains(opt, "=") {
			so = append(so, SecurityOpt{Name: opt})
			continue
		}
		secopt := SecurityOpt{}
		for _, s := range strings.Split(opt, ",") {
			k, v, ok := strings.Cut(s, "=")
			if !ok {
				return nil, fmt.Errorf("invalid security option %q", s)
			}
			if k == "" || v == "" {
				return nil, errors.New("invalid empty security option")
			}
			if k == "name" {
				secopt.Name = v
				continue
			}
			secopt.Options = append(secopt.Options, KeyValue{Key: k, Value: v})
		}
		so = append(so, secopt)
	}
	return so, nil
}

// KeyValue holds a key/value pair.
type KeyValue struct {
	Key, Value string
}
