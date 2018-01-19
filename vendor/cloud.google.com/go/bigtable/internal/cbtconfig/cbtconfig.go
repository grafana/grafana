/*
Copyright 2015 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package cbtconfig encapsulates common code for reading configuration from .cbtrc and gcloud.
package cbtconfig

import (
	"bufio"
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"google.golang.org/grpc/credentials"
)

// Config represents a configuration.
type Config struct {
	Project, Instance string                           // required
	Creds             string                           // optional
	AdminEndpoint     string                           // optional
	DataEndpoint      string                           // optional
	CertFile          string                           // optional
	TokenSource       oauth2.TokenSource               // derived
	TLSCreds          credentials.TransportCredentials // derived
}

type RequiredFlags uint

const NoneRequired RequiredFlags = 0
const (
	ProjectRequired RequiredFlags = 1 << iota
	InstanceRequired
)
const ProjectAndInstanceRequired RequiredFlags = ProjectRequired | InstanceRequired

// RegisterFlags registers a set of standard flags for this config.
// It should be called before flag.Parse.
func (c *Config) RegisterFlags() {
	flag.StringVar(&c.Project, "project", c.Project, "project ID, if unset uses gcloud configured project")
	flag.StringVar(&c.Instance, "instance", c.Instance, "Cloud Bigtable instance")
	flag.StringVar(&c.Creds, "creds", c.Creds, "if set, use application credentials in this file")
	flag.StringVar(&c.AdminEndpoint, "admin-endpoint", c.AdminEndpoint, "Override the admin api endpoint")
	flag.StringVar(&c.DataEndpoint, "data-endpoint", c.DataEndpoint, "Override the data api endpoint")
	flag.StringVar(&c.CertFile, "cert-file", c.CertFile, "Override the TLS certificates file")
}

// CheckFlags checks that the required config values are set.
func (c *Config) CheckFlags(required RequiredFlags) error {
	var missing []string
	if c.CertFile != "" {
		b, err := ioutil.ReadFile(c.CertFile)
		if err != nil {
			return fmt.Errorf("Failed to load certificates from %s: %v", c.CertFile, err)
		}

		cp := x509.NewCertPool()
		if !cp.AppendCertsFromPEM(b) {
			return fmt.Errorf("Failed to append certificates from %s", c.CertFile)
		}

		c.TLSCreds = credentials.NewTLS(&tls.Config{RootCAs: cp})
	}
	if required != NoneRequired {
		c.SetFromGcloud()
	}
	if required&ProjectRequired != 0 && c.Project == "" {
		missing = append(missing, "-project")
	}
	if required&InstanceRequired != 0 && c.Instance == "" {
		missing = append(missing, "-instance")
	}
	if len(missing) > 0 {
		return fmt.Errorf("Missing %s", strings.Join(missing, " and "))
	}
	return nil
}

// Filename returns the filename consulted for standard configuration.
func Filename() string {
	// TODO(dsymonds): Might need tweaking for Windows.
	return filepath.Join(os.Getenv("HOME"), ".cbtrc")
}

// Load loads a .cbtrc file.
// If the file is not present, an empty config is returned.
func Load() (*Config, error) {
	filename := Filename()
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		// silent fail if the file isn't there
		if os.IsNotExist(err) {
			return &Config{}, nil
		}
		return nil, fmt.Errorf("Reading %s: %v", filename, err)
	}
	c := new(Config)
	s := bufio.NewScanner(bytes.NewReader(data))
	for s.Scan() {
		line := s.Text()
		i := strings.Index(line, "=")
		if i < 0 {
			return nil, fmt.Errorf("Bad line in %s: %q", filename, line)
		}
		key, val := strings.TrimSpace(line[:i]), strings.TrimSpace(line[i+1:])
		switch key {
		default:
			return nil, fmt.Errorf("Unknown key in %s: %q", filename, key)
		case "project":
			c.Project = val
		case "instance":
			c.Instance = val
		case "creds":
			c.Creds = val
		case "admin-endpoint":
			c.AdminEndpoint = val
		case "data-endpoint":
			c.DataEndpoint = val
		}

	}
	return c, s.Err()
}

type GcloudCredential struct {
	AccessToken string    `json:"access_token"`
	Expiry      time.Time `json:"token_expiry"`
}

func (cred *GcloudCredential) Token() *oauth2.Token {
	return &oauth2.Token{AccessToken: cred.AccessToken, TokenType: "Bearer", Expiry: cred.Expiry}
}

type GcloudConfig struct {
	Configuration struct {
		Properties struct {
			Core struct {
				Project string `json:"project"`
			} `json:"core"`
		} `json:"properties"`
	} `json:"configuration"`
	Credential GcloudCredential `json:"credential"`
}

type GcloudCmdTokenSource struct {
	Command string
	Args    []string
}

// Token implements the oauth2.TokenSource interface
func (g *GcloudCmdTokenSource) Token() (*oauth2.Token, error) {
	gcloudConfig, err := LoadGcloudConfig(g.Command, g.Args)
	if err != nil {
		return nil, err
	}
	return gcloudConfig.Credential.Token(), nil
}

// LoadGcloudConfig retrieves the gcloud configuration values we need use via the
// 'config-helper' command
func LoadGcloudConfig(gcloudCmd string, gcloudCmdArgs []string) (*GcloudConfig, error) {
	out, err := exec.Command(gcloudCmd, gcloudCmdArgs...).Output()
	if err != nil {
		return nil, fmt.Errorf("Could not retrieve gcloud configuration")
	}

	var gcloudConfig GcloudConfig
	if err := json.Unmarshal(out, &gcloudConfig); err != nil {
		return nil, fmt.Errorf("Could not parse gcloud configuration")
	}

	return &gcloudConfig, nil
}

// SetFromGcloud retrieves and sets any missing config values from the gcloud
// configuration if possible possible
func (c *Config) SetFromGcloud() error {

	if c.Creds == "" {
		c.Creds = os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
		if c.Creds == "" {
			log.Printf("-creds flag unset, will use gcloud credential")
		}
	} else {
		os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", c.Creds)
	}

	if c.Project == "" {
		log.Printf("-project flag unset, will use gcloud active project")
	}

	if c.Creds != "" && c.Project != "" {
		return nil
	}

	gcloudCmd := "gcloud"
	if runtime.GOOS == "windows" {
		gcloudCmd = gcloudCmd + ".cmd"
	}

	gcloudCmdArgs := []string{"config", "config-helper",
		"--format=json(configuration.properties.core.project,credential)"}

	gcloudConfig, err := LoadGcloudConfig(gcloudCmd, gcloudCmdArgs)
	if err != nil {
		return err
	}

	if c.Project == "" && gcloudConfig.Configuration.Properties.Core.Project != "" {
		log.Printf("gcloud active project is \"%s\"",
			gcloudConfig.Configuration.Properties.Core.Project)
		c.Project = gcloudConfig.Configuration.Properties.Core.Project
	}

	if c.Creds == "" {
		c.TokenSource = oauth2.ReuseTokenSource(
			gcloudConfig.Credential.Token(),
			&GcloudCmdTokenSource{Command: gcloudCmd, Args: gcloudCmdArgs})
	}

	return nil
}
