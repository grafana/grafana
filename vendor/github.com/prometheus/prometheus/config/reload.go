// Copyright 2024 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package config

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v2"
)

type ExternalFilesConfig struct {
	RuleFiles         []string `yaml:"rule_files"`
	ScrapeConfigFiles []string `yaml:"scrape_config_files"`
}

// GenerateChecksum generates a checksum of the YAML file and the files it references.
func GenerateChecksum(yamlFilePath string) (string, error) {
	hash := sha256.New()

	yamlContent, err := os.ReadFile(yamlFilePath)
	if err != nil {
		return "", fmt.Errorf("error reading YAML file: %w", err)
	}
	_, err = hash.Write(yamlContent)
	if err != nil {
		return "", fmt.Errorf("error writing YAML file to hash: %w", err)
	}

	var config ExternalFilesConfig
	if err := yaml.Unmarshal(yamlContent, &config); err != nil {
		return "", fmt.Errorf("error unmarshalling YAML: %w", err)
	}

	dir := filepath.Dir(yamlFilePath)

	for i, file := range config.RuleFiles {
		config.RuleFiles[i] = filepath.Join(dir, file)
	}
	for i, file := range config.ScrapeConfigFiles {
		config.ScrapeConfigFiles[i] = filepath.Join(dir, file)
	}

	files := map[string][]string{
		"r": config.RuleFiles,         // "r" for rule files
		"s": config.ScrapeConfigFiles, // "s" for scrape config files
	}

	for _, prefix := range []string{"r", "s"} {
		for _, pattern := range files[prefix] {
			matchingFiles, err := filepath.Glob(pattern)
			if err != nil {
				return "", fmt.Errorf("error finding files with pattern %q: %w", pattern, err)
			}

			for _, file := range matchingFiles {
				// Write prefix to the hash ("r" or "s") followed by \0, then
				// the file path.
				_, err = hash.Write([]byte(prefix + "\x00" + file + "\x00"))
				if err != nil {
					return "", fmt.Errorf("error writing %q path to hash: %w", file, err)
				}

				// Read and hash the content of the file.
				content, err := os.ReadFile(file)
				if err != nil {
					return "", fmt.Errorf("error reading file %s: %w", file, err)
				}
				_, err = hash.Write(append(content, []byte("\x00")...))
				if err != nil {
					return "", fmt.Errorf("error writing %q content to hash: %w", file, err)
				}
			}
		}
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}
