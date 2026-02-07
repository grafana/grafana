/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package z

import (
	"errors"
	"fmt"
	"log"
	"os"
	"os/user"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// SuperFlagHelp makes it really easy to generate command line `--help` output for a SuperFlag. For
// example:
//
//	const flagDefaults = `enabled=true; path=some/path;`
//
//	var help string = z.NewSuperFlagHelp(flagDefaults).
//		Flag("enabled", "Turns on <something>.").
//		Flag("path", "The path to <something>.").
//		Flag("another", "Not present in defaults, but still included.").
//		String()
//
// The `help` string would then contain:
//
//	enabled=true; Turns on <something>.
//	path=some/path; The path to <something>.
//	another=; Not present in defaults, but still included.
//
// All flags are sorted alphabetically for consistent `--help` output. Flags with default values are
// placed at the top, and everything else goes under.
type SuperFlagHelp struct {
	head     string
	defaults *SuperFlag
	flags    map[string]string
}

func NewSuperFlagHelp(defaults string) *SuperFlagHelp {
	return &SuperFlagHelp{
		defaults: NewSuperFlag(defaults),
		flags:    make(map[string]string, 0),
	}
}

func (h *SuperFlagHelp) Head(head string) *SuperFlagHelp {
	h.head = head
	return h
}

func (h *SuperFlagHelp) Flag(name, description string) *SuperFlagHelp {
	h.flags[name] = description
	return h
}

func (h *SuperFlagHelp) String() string {
	defaultLines := make([]string, 0)
	otherLines := make([]string, 0)
	for name, help := range h.flags {
		val, found := h.defaults.m[name]
		line := fmt.Sprintf("    %s=%s; %s\n", name, val, help)
		if found {
			defaultLines = append(defaultLines, line)
		} else {
			otherLines = append(otherLines, line)
		}
	}
	sort.Strings(defaultLines)
	sort.Strings(otherLines)
	dls := strings.Join(defaultLines, "")
	ols := strings.Join(otherLines, "")
	if len(h.defaults.m) == 0 && len(ols) == 0 {
		// remove last newline
		dls = dls[:len(dls)-1]
	}
	// remove last newline
	if len(h.defaults.m) == 0 && len(ols) > 1 {
		ols = ols[:len(ols)-1]
	}
	return h.head + "\n" + dls + ols
}

func parseFlag(flag string) (map[string]string, error) {
	kvm := make(map[string]string)
	for _, kv := range strings.Split(flag, ";") {
		if strings.TrimSpace(kv) == "" {
			continue
		}
		// For a non-empty separator, 0 < len(splits) ≤ 2.
		splits := strings.SplitN(kv, "=", 2)
		k := strings.TrimSpace(splits[0])
		if len(splits) < 2 {
			return nil, fmt.Errorf("superflag: missing value for '%s' in flag: %s", k, flag)
		}
		k = strings.ToLower(k)
		k = strings.ReplaceAll(k, "_", "-")
		kvm[k] = strings.TrimSpace(splits[1])
	}
	return kvm, nil
}

type SuperFlag struct {
	m map[string]string
}

func NewSuperFlag(flag string) *SuperFlag {
	sf, err := newSuperFlagImpl(flag)
	if err != nil {
		log.Fatal(err)
	}
	return sf
}

func newSuperFlagImpl(flag string) (*SuperFlag, error) {
	m, err := parseFlag(flag)
	if err != nil {
		return nil, err
	}
	return &SuperFlag{m}, nil
}

func (sf *SuperFlag) String() string {
	if sf == nil {
		return ""
	}
	kvs := make([]string, 0, len(sf.m))
	for k, v := range sf.m {
		kvs = append(kvs, fmt.Sprintf("%s=%s", k, v))
	}
	return strings.Join(kvs, "; ")
}

func (sf *SuperFlag) MergeAndCheckDefault(flag string) *SuperFlag {
	sf, err := sf.mergeAndCheckDefaultImpl(flag)
	if err != nil {
		log.Fatal(err)
	}
	return sf
}

func (sf *SuperFlag) mergeAndCheckDefaultImpl(flag string) (*SuperFlag, error) {
	if sf == nil {
		m, err := parseFlag(flag)
		if err != nil {
			return nil, err
		}
		return &SuperFlag{m}, nil
	}

	src, err := parseFlag(flag)
	if err != nil {
		return nil, err
	}

	numKeys := len(sf.m)
	for k := range src {
		if _, ok := sf.m[k]; ok {
			numKeys--
		}
	}
	if numKeys != 0 {
		return nil, fmt.Errorf("superflag: found invalid options: %s.\nvalid options: %v", sf, flag)
	}
	for k, v := range src {
		if _, ok := sf.m[k]; !ok {
			sf.m[k] = v
		}
	}
	return sf, nil
}

func (sf *SuperFlag) Has(opt string) bool {
	val := sf.GetString(opt)
	return val != ""
}

func (sf *SuperFlag) GetDuration(opt string) time.Duration {
	val := sf.GetString(opt)
	if val == "" {
		return time.Duration(0)
	}
	if strings.Contains(val, "d") {
		val = strings.Replace(val, "d", "", 1)
		days, err := strconv.ParseInt(val, 0, 64)
		if err != nil {
			return time.Duration(0)
		}
		return time.Hour * 24 * time.Duration(days)
	}
	d, err := time.ParseDuration(val)
	if err != nil {
		return time.Duration(0)
	}
	return d
}

func (sf *SuperFlag) GetBool(opt string) bool {
	val := sf.GetString(opt)
	if val == "" {
		return false
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		err = errors.Join(err,
			fmt.Errorf("Unable to parse %s as bool for key: %s. Options: %s\n", val, opt, sf))
		log.Fatalf("%+v", err)
	}
	return b
}

func (sf *SuperFlag) GetFloat64(opt string) float64 {
	val := sf.GetString(opt)
	if val == "" {
		return 0
	}
	f, err := strconv.ParseFloat(val, 64)
	if err != nil {
		err = errors.Join(err,
			fmt.Errorf("Unable to parse %s as float64 for key: %s. Options: %s\n", val, opt, sf))
		log.Fatalf("%+v", err)
	}
	return f
}

func (sf *SuperFlag) GetInt64(opt string) int64 {
	val := sf.GetString(opt)
	if val == "" {
		return 0
	}
	i, err := strconv.ParseInt(val, 0, 64)
	if err != nil {
		err = errors.Join(err,
			fmt.Errorf("Unable to parse %s as int64 for key: %s. Options: %s\n", val, opt, sf))
		log.Fatalf("%+v", err)
	}
	return i
}

func (sf *SuperFlag) GetUint64(opt string) uint64 {
	val := sf.GetString(opt)
	if val == "" {
		return 0
	}
	u, err := strconv.ParseUint(val, 0, 64)
	if err != nil {
		err = errors.Join(err,
			fmt.Errorf("Unable to parse %s as uint64 for key: %s. Options: %s\n", val, opt, sf))
		log.Fatalf("%+v", err)
	}
	return u
}

func (sf *SuperFlag) GetUint32(opt string) uint32 {
	val := sf.GetString(opt)
	if val == "" {
		return 0
	}
	u, err := strconv.ParseUint(val, 0, 32)
	if err != nil {
		err = errors.Join(err,
			fmt.Errorf("Unable to parse %s as uint32 for key: %s. Options: %s\n", val, opt, sf))
		log.Fatalf("%+v", err)
	}
	return uint32(u)
}

func (sf *SuperFlag) GetString(opt string) string {
	if sf == nil {
		return ""
	}
	return sf.m[opt]
}

func (sf *SuperFlag) GetPath(opt string) string {
	p := sf.GetString(opt)
	path, err := expandPath(p)
	if err != nil {
		log.Fatalf("Failed to get path: %+v", err)
	}
	return path
}

// expandPath expands the paths containing ~ to /home/user. It also computes the absolute path
// from the relative paths. For example: ~/abc/../cef will be transformed to /home/user/cef.
func expandPath(path string) (string, error) {
	if len(path) == 0 {
		return "", nil
	}
	if path[0] == '~' && (len(path) == 1 || os.IsPathSeparator(path[1])) {
		usr, err := user.Current()
		if err != nil {
			return "", errors.Join(err, errors.New("Failed to get the home directory of the user"))
		}
		path = filepath.Join(usr.HomeDir, path[1:])
	}

	var err error
	path, err = filepath.Abs(path)
	if err != nil {
		return "", errors.Join(err, errors.New("Failed to generate absolute path"))
	}
	return path, nil
}
