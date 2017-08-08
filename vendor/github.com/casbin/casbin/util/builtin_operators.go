// Copyright 2017 The casbin Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package util

import (
	"net"
	"regexp"
	"strings"
)

// KeyMatch determines whether key1 matches the pattern of key2 (similar to RESTful path), key2 can contain a *.
// For example, "/foo/bar" matches "/foo/*"
func KeyMatch(key1 string, key2 string) bool {
	i := strings.Index(key2, "*")
	if i == -1 {
		return key1 == key2
	}

	if len(key1) > i {
		return key1[:i] == key2[:i]
	}
	return key1 == key2[:i]
}

// KeyMatchFunc is the wrapper for KeyMatch.
func KeyMatchFunc(args ...interface{}) (interface{}, error) {
	name1 := args[0].(string)
	name2 := args[1].(string)

	return (bool)(KeyMatch(name1, name2)), nil
}

// KeyMatch2 determines whether key1 matches the pattern of key2 (similar to RESTful path), key2 can contain a *.
// For example, "/foo/bar" matches "/foo/*", "/resource1" matches "/:resource"
func KeyMatch2(key1 string, key2 string) bool {
	key2 = strings.Replace(key2, "/*", "/.*", -1)

	re := regexp.MustCompile(`(.*):[^/]+(.*)`)
	for {
		if !strings.Contains(key2, "/:") {
			break
		}

		key2 = re.ReplaceAllString(key2, "$1[^/]+$2")
	}

	return RegexMatch(key1, key2)
}

// KeyMatch2Func is the wrapper for KeyMatch2.
func KeyMatch2Func(args ...interface{}) (interface{}, error) {
	name1 := args[0].(string)
	name2 := args[1].(string)

	return (bool)(KeyMatch2(name1, name2)), nil
}

// RegexMatch determines whether key1 matches the pattern of key2 in regular expression.
func RegexMatch(key1 string, key2 string) bool {
	res, err := regexp.MatchString(key2, key1)
	if err != nil {
		panic(err)
	}
	return res
}

// RegexMatchFunc is the wrapper for RegexMatch.
func RegexMatchFunc(args ...interface{}) (interface{}, error) {
	name1 := args[0].(string)
	name2 := args[1].(string)

	return (bool)(RegexMatch(name1, name2)), nil
}

// IPMatch determines whether IP address ip1 matches the pattern of IP address ip2, ip2 can be an IP address or a CIDR pattern.
// For example, "192.168.2.123" matches "192.168.2.0/24"
func IPMatch(ip1 string, ip2 string) bool {
	ip := net.ParseIP(ip1)
	if ip == nil {
		panic("invalid argument: ip1 in IPMatch() function is not an IP address.")
	}

	_, cidr, err := net.ParseCIDR(ip2)
	if err != nil {
		ip2_ip := net.ParseIP(ip2)
		if ip2_ip == nil {
			panic("invalid argument: ip2 in IPMatch() function is neither an IP address nor a CIDR.")
		}

		return ip.Equal(ip2_ip)
	}

	return cidr.Contains(ip)
}

// IPMatchFunc is the wrapper for IPMatch.
func IPMatchFunc(args ...interface{}) (interface{}, error) {
	ip1 := args[0].(string)
	ip2 := args[1].(string)

	return (bool)(IPMatch(ip1, ip2)), nil
}
