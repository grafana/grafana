package data

import (
	"fmt"
	"sort"
	"strings"
)

// Labels are used to add metadata to an object.
type Labels map[string]string

// Equals returns true if the argument has the same k=v pairs as the receiver.
func (l Labels) Equals(arg Labels) bool {
	if len(l) != len(arg) {
		return false
	}
	for k, v := range l {
		if argVal, ok := arg[k]; !ok || argVal != v {
			return false
		}
	}
	return true
}

// Copy returns a copy of the labels.
func (l Labels) Copy() Labels {
	c := make(Labels, len(l))
	for k, v := range l {
		c[k] = v
	}
	return c
}

// Contains returns true if all k=v pairs of the argument are in the receiver.
func (l Labels) Contains(arg Labels) bool {
	if len(arg) > len(l) {
		return false
	}
	for k, v := range arg {
		if argVal, ok := l[k]; !ok || argVal != v {
			return false
		}
	}
	return true
}

func (l Labels) String() string {
	// Better structure, should be sorted, copy prom probably
	keys := make([]string, len(l))
	i := 0
	for k := range l {
		keys[i] = k
		i++
	}
	sort.Strings(keys)

	var sb strings.Builder

	i = 0
	for _, k := range keys {
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(l[k])
		if i != len(keys)-1 {
			sb.WriteString(", ")
		}
		i++
	}
	return sb.String()
}

// LabelsFromString parses the output of Labels.String() into
// a Labels object. It probably has some flaws.
func LabelsFromString(s string) (Labels, error) {
	if s == "" {
		return nil, nil
	}
	labels := make(map[string]string)

	for _, rawKV := range strings.Split(s, ", ") {
		kV := strings.SplitN(rawKV, "=", 2)
		if len(kV) != 2 {
			return nil, fmt.Errorf(`invalid label key=value pair "%v"`, rawKV)
		}
		labels[kV[0]] = kV[1]
	}

	return labels, nil
}
