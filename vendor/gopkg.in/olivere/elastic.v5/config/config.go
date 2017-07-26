// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package config

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// Config represents an Elasticsearch configuration.
type Config struct {
	URL      string
	Index    string
	Username string
	Password string
	Shards   int
	Replicas int
	Sniff    *bool
	Infolog  string
	Errorlog string
	Tracelog string
}

// Parse returns the Elasticsearch configuration by extracting it
// from the URL, its path, and its query string.
//
// Example:
//   http://127.0.0.1:9200/store-blobs?shards=1&replicas=0&sniff=false&tracelog=elastic.trace.log
//
// The code above will return a URL of http://127.0.0.1:9200, an index name
// of store-blobs, and the related settings from the query string.
func Parse(elasticURL string) (*Config, error) {
	cfg := &Config{
		Shards:   1,
		Replicas: 0,
		Sniff:    nil,
	}

	uri, err := url.Parse(elasticURL)
	if err != nil {
		return nil, fmt.Errorf("error parsing elastic parameter %q: %v", elasticURL, err)
	}
	index := uri.Path
	if strings.HasPrefix(index, "/") {
		index = index[1:]
	}
	if strings.HasSuffix(index, "/") {
		index = index[:len(index)-1]
	}
	if index == "" {
		return nil, fmt.Errorf("missing index in elastic parameter %q", elasticURL)
	}
	if uri.User != nil {
		cfg.Username = uri.User.Username()
		cfg.Password, _ = uri.User.Password()
	}
	uri.User = nil

	if i, err := strconv.Atoi(uri.Query().Get("shards")); err == nil {
		cfg.Shards = i
	}
	if i, err := strconv.Atoi(uri.Query().Get("replicas")); err == nil {
		cfg.Replicas = i
	}
	if s := uri.Query().Get("sniff"); s != "" {
		if b, err := strconv.ParseBool(s); err == nil {
			cfg.Sniff = &b
		}
	}
	if s := uri.Query().Get("infolog"); s != "" {
		cfg.Infolog = s
	}
	if s := uri.Query().Get("errorlog"); s != "" {
		cfg.Errorlog = s
	}
	if s := uri.Query().Get("tracelog"); s != "" {
		cfg.Tracelog = s
	}

	uri.Path = ""
	uri.RawQuery = ""
	cfg.URL = uri.String()
	cfg.Index = index

	return cfg, nil
}
