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

package config

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"sync"
)

var (
	DEFAULT_SECTION     = "default"
	DEFAULT_COMMENT     = []byte{'#'}
	DEFAULT_COMMENT_SEM = []byte{';'}
)

type ConfigInterface interface {
	String(key string) string
	Strings(key string) []string
	Bool(key string) (bool, error)
	Int(key string) (int, error)
	Int64(key string) (int64, error)
	Float64(key string) (float64, error)
	Set(key string, value string) error
}

type Config struct {
	// map is not safe.
	sync.RWMutex
	// Section:key=value
	data map[string]map[string]string
}

// NewConfig create an empty configuration representation.
func NewConfig(confName string) (ConfigInterface, error) {
	c := &Config{
		data: make(map[string]map[string]string),
	}
	err := c.parse(confName)
	return c, err
}

// AddConfig adds a new section->key:value to the configuration.
func (c *Config) AddConfig(section string, option string, value string) bool {
	if section == "" {
		section = DEFAULT_SECTION
	}

	if _, ok := c.data[section]; !ok {
		c.data[section] = make(map[string]string)
	}

	_, ok := c.data[section][option]
	c.data[section][option] = value

	return !ok
}

func (c *Config) parse(fname string) (err error) {
	c.Lock()
	f, err := os.Open(fname)
	if err != nil {
		return err
	}
	defer c.Unlock()
	defer f.Close()

	buf := bufio.NewReader(f)

	var section string
	var lineNum int

	for {
		lineNum++
		line, _, err := buf.ReadLine()
		if err == io.EOF {
			break
		} else if bytes.Equal(line, []byte{}) {
			continue
		} else if err != nil {
			return err
		}

		line = bytes.TrimSpace(line)
		switch {
		case bytes.HasPrefix(line, DEFAULT_COMMENT):
			continue
		case bytes.HasPrefix(line, DEFAULT_COMMENT_SEM):
			continue
		case bytes.HasPrefix(line, []byte{'['}) && bytes.HasSuffix(line, []byte{']'}):
			section = string(line[1 : len(line)-1])
		default:
			optionVal := bytes.SplitN(line, []byte{'='}, 2)
			if len(optionVal) != 2 {
				return fmt.Errorf("parse %s the content error : line %d , %s = ? ", fname, lineNum, optionVal[0])
			}
			option := bytes.TrimSpace(optionVal[0])
			value := bytes.TrimSpace(optionVal[1])
			c.AddConfig(section, string(option), string(value))
		}
	}

	return nil
}

func (c *Config) Bool(key string) (bool, error) {
	return strconv.ParseBool(c.get(key))
}

func (c *Config) Int(key string) (int, error) {
	return strconv.Atoi(c.get(key))
}

func (c *Config) Int64(key string) (int64, error) {
	return strconv.ParseInt(c.get(key), 10, 64)
}

func (c *Config) Float64(key string) (float64, error) {
	return strconv.ParseFloat(c.get(key), 64)
}

func (c *Config) String(key string) string {
	return c.get(key)
}

func (c *Config) Strings(key string) []string {
	v := c.get(key)
	if v == "" {
		return nil
	}
	return strings.Split(v, ",")
}

func (c *Config) Set(key string, value string) error {
	c.Lock()
	defer c.Unlock()
	if len(key) == 0 {
		return errors.New("key is empty.")
	}

	var (
		section string
		option  string
	)

	keys := strings.Split(strings.ToLower(key), "::")
	if len(keys) >= 2 {
		section = keys[0]
		option = keys[1]
	} else {
		option = keys[0]
	}

	c.AddConfig(section, option, value)
	return nil
}

// section.key or key
func (c *Config) get(key string) string {
	var (
		section string
		option  string
	)

	keys := strings.Split(strings.ToLower(key), "::")

	if len(keys) >= 2 {
		section = keys[0]
		option = keys[1]
	} else {
		section = DEFAULT_SECTION
		option = keys[0]
	}

	if value, ok := c.data[section][option]; ok {
		return value
	}

	return ""
}
