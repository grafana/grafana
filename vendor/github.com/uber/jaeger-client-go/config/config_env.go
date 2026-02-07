// Copyright (c) 2018 The Jaeger Authors.
//
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
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/opentracing/opentracing-go"
	"github.com/pkg/errors"
	"github.com/uber/jaeger-client-go"
)

const (
	// environment variable names
	envServiceName                         = "JAEGER_SERVICE_NAME"
	envDisabled                            = "JAEGER_DISABLED"
	envRPCMetrics                          = "JAEGER_RPC_METRICS"
	envTags                                = "JAEGER_TAGS"
	envSamplerType                         = "JAEGER_SAMPLER_TYPE"
	envSamplerParam                        = "JAEGER_SAMPLER_PARAM"
	envSamplerManagerHostPort              = "JAEGER_SAMPLER_MANAGER_HOST_PORT" // Deprecated by envSamplingEndpoint
	envSamplingEndpoint                    = "JAEGER_SAMPLING_ENDPOINT"
	envSamplerMaxOperations                = "JAEGER_SAMPLER_MAX_OPERATIONS"
	envSamplerRefreshInterval              = "JAEGER_SAMPLER_REFRESH_INTERVAL"
	envReporterMaxQueueSize                = "JAEGER_REPORTER_MAX_QUEUE_SIZE"
	envReporterFlushInterval               = "JAEGER_REPORTER_FLUSH_INTERVAL"
	envReporterLogSpans                    = "JAEGER_REPORTER_LOG_SPANS"
	envReporterAttemptReconnectingDisabled = "JAEGER_REPORTER_ATTEMPT_RECONNECTING_DISABLED"
	envReporterAttemptReconnectInterval    = "JAEGER_REPORTER_ATTEMPT_RECONNECT_INTERVAL"
	envEndpoint                            = "JAEGER_ENDPOINT"
	envUser                                = "JAEGER_USER"
	envPassword                            = "JAEGER_PASSWORD"
	envAgentHost                           = "JAEGER_AGENT_HOST"
	envAgentPort                           = "JAEGER_AGENT_PORT"
	env128bit                              = "JAEGER_TRACEID_128BIT"
)

// FromEnv uses environment variables to set the tracer's Configuration
func FromEnv() (*Configuration, error) {
	c := &Configuration{}
	return c.FromEnv()
}

// FromEnv uses environment variables and overrides existing tracer's Configuration
func (c *Configuration) FromEnv() (*Configuration, error) {
	if e := os.Getenv(envServiceName); e != "" {
		c.ServiceName = e
	}

	if e := os.Getenv(envRPCMetrics); e != "" {
		if value, err := strconv.ParseBool(e); err == nil {
			c.RPCMetrics = value
		} else {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envRPCMetrics, e)
		}
	}

	if e := os.Getenv(envDisabled); e != "" {
		if value, err := strconv.ParseBool(e); err == nil {
			c.Disabled = value
		} else {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envDisabled, e)
		}
	}

	if e := os.Getenv(envTags); e != "" {
		c.Tags = parseTags(e)
	}

	if e := os.Getenv(env128bit); e != "" {
		if value, err := strconv.ParseBool(e); err == nil {
			c.Gen128Bit = value
		} else {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", env128bit, e)
		}
	}

	if c.Sampler == nil {
		c.Sampler = &SamplerConfig{}
	}

	if s, err := c.Sampler.samplerConfigFromEnv(); err == nil {
		c.Sampler = s
	} else {
		return nil, errors.Wrap(err, "cannot obtain sampler config from env")
	}

	if c.Reporter == nil {
		c.Reporter = &ReporterConfig{}
	}

	if r, err := c.Reporter.reporterConfigFromEnv(); err == nil {
		c.Reporter = r
	} else {
		return nil, errors.Wrap(err, "cannot obtain reporter config from env")
	}

	return c, nil
}

// samplerConfigFromEnv creates a new SamplerConfig based on the environment variables
func (sc *SamplerConfig) samplerConfigFromEnv() (*SamplerConfig, error) {
	if e := os.Getenv(envSamplerType); e != "" {
		sc.Type = e
	}

	if e := os.Getenv(envSamplerParam); e != "" {
		if value, err := strconv.ParseFloat(e, 64); err == nil {
			sc.Param = value
		} else {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envSamplerParam, e)
		}
	}

	if e := os.Getenv(envSamplingEndpoint); e != "" {
		sc.SamplingServerURL = e
	} else if e := os.Getenv(envSamplerManagerHostPort); e != "" {
		sc.SamplingServerURL = e
	} else if e := os.Getenv(envAgentHost); e != "" {
		// Fallback if we know the agent host - try the sampling endpoint there
		sc.SamplingServerURL = fmt.Sprintf("http://%s:%d/sampling", e, jaeger.DefaultSamplingServerPort)
	}

	if e := os.Getenv(envSamplerMaxOperations); e != "" {
		if value, err := strconv.ParseInt(e, 10, 0); err == nil {
			sc.MaxOperations = int(value)
		} else {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envSamplerMaxOperations, e)
		}
	}

	if e := os.Getenv(envSamplerRefreshInterval); e != "" {
		if value, err := time.ParseDuration(e); err == nil {
			sc.SamplingRefreshInterval = value
		} else {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envSamplerRefreshInterval, e)
		}
	}

	return sc, nil
}

// reporterConfigFromEnv creates a new ReporterConfig based on the environment variables
func (rc *ReporterConfig) reporterConfigFromEnv() (*ReporterConfig, error) {
	if e := os.Getenv(envReporterMaxQueueSize); e != "" {
		if value, err := strconv.ParseInt(e, 10, 0); err == nil {
			rc.QueueSize = int(value)
		} else {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envReporterMaxQueueSize, e)
		}
	}

	if e := os.Getenv(envReporterFlushInterval); e != "" {
		if value, err := time.ParseDuration(e); err == nil {
			rc.BufferFlushInterval = value
		} else {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envReporterFlushInterval, e)
		}
	}

	if e := os.Getenv(envReporterLogSpans); e != "" {
		if value, err := strconv.ParseBool(e); err == nil {
			rc.LogSpans = value
		} else {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envReporterLogSpans, e)
		}
	}

	if e := os.Getenv(envEndpoint); e != "" {
		u, err := url.ParseRequestURI(e)
		if err != nil {
			return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envEndpoint, e)
		}
		rc.CollectorEndpoint = u.String()
		user := os.Getenv(envUser)
		pswd := os.Getenv(envPassword)
		if user != "" && pswd == "" || user == "" && pswd != "" {
			return nil, errors.Errorf("you must set %s and %s env vars together", envUser, envPassword)
		}
		rc.User = user
		rc.Password = pswd
	} else {
		useEnv := false
		host := jaeger.DefaultUDPSpanServerHost
		if e := os.Getenv(envAgentHost); e != "" {
			host = e
			useEnv = true
		}

		port := jaeger.DefaultUDPSpanServerPort
		if e := os.Getenv(envAgentPort); e != "" {
			if value, err := strconv.ParseInt(e, 10, 0); err == nil {
				port = int(value)
				useEnv = true
			} else {
				return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envAgentPort, e)
			}
		}
		if useEnv || rc.LocalAgentHostPort == "" {
			rc.LocalAgentHostPort = fmt.Sprintf("%s:%d", host, port)
		}

		if e := os.Getenv(envReporterAttemptReconnectingDisabled); e != "" {
			if value, err := strconv.ParseBool(e); err == nil {
				rc.DisableAttemptReconnecting = value
			} else {
				return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envReporterAttemptReconnectingDisabled, e)
			}
		}

		if !rc.DisableAttemptReconnecting {
			if e := os.Getenv(envReporterAttemptReconnectInterval); e != "" {
				if value, err := time.ParseDuration(e); err == nil {
					rc.AttemptReconnectInterval = value
				} else {
					return nil, errors.Wrapf(err, "cannot parse env var %s=%s", envReporterAttemptReconnectInterval, e)
				}
			}
		}
	}

	return rc, nil
}

// parseTags parses the given string into a collection of Tags.
// Spec for this value:
// - comma separated list of key=value
// - value can be specified using the notation ${envVar:defaultValue}, where `envVar`
// is an environment variable and `defaultValue` is the value to use in case the env var is not set
func parseTags(sTags string) []opentracing.Tag {
	pairs := strings.Split(sTags, ",")
	tags := make([]opentracing.Tag, 0)
	for _, p := range pairs {
		kv := strings.SplitN(p, "=", 2)
		k, v := strings.TrimSpace(kv[0]), strings.TrimSpace(kv[1])

		if strings.HasPrefix(v, "${") && strings.HasSuffix(v, "}") {
			ed := strings.SplitN(v[2:len(v)-1], ":", 2)
			e, d := ed[0], ed[1]
			v = os.Getenv(e)
			if v == "" && d != "" {
				v = d
			}
		}

		tag := opentracing.Tag{Key: k, Value: v}
		tags = append(tags, tag)
	}

	return tags
}
