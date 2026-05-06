// Copyright 2023 Prometheus Team
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

package featurecontrol

import (
	"errors"
	"fmt"
	"strings"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

const (
	FeatureReceiverNameInMetrics = "receiver-name-in-metrics"
	FeatureClassicMode           = "classic-mode"
	FeatureUTF8StrictMode        = "utf8-strict-mode"
)

var AllowedFlags = []string{
	FeatureReceiverNameInMetrics,
	FeatureClassicMode,
	FeatureUTF8StrictMode,
}

type Flagger interface {
	EnableReceiverNamesInMetrics() bool
	ClassicMode() bool
	UTF8StrictMode() bool
}

type Flags struct {
	logger                       log.Logger
	enableReceiverNamesInMetrics bool
	classicMode                  bool
	utf8StrictMode               bool
}

func (f *Flags) EnableReceiverNamesInMetrics() bool {
	return f.enableReceiverNamesInMetrics
}

func (f *Flags) ClassicMode() bool {
	return f.classicMode
}

func (f *Flags) UTF8StrictMode() bool {
	return f.utf8StrictMode
}

type flagOption func(flags *Flags)

func enableReceiverNameInMetrics() flagOption {
	return func(configs *Flags) {
		configs.enableReceiverNamesInMetrics = true
	}
}

func enableClassicMode() flagOption {
	return func(configs *Flags) {
		configs.classicMode = true
	}
}

func enableUTF8StrictMode() flagOption {
	return func(configs *Flags) {
		configs.utf8StrictMode = true
	}
}

func NewFlags(logger log.Logger, features string) (Flagger, error) {
	fc := &Flags{logger: logger}
	opts := []flagOption{}

	if len(features) == 0 {
		return NoopFlags{}, nil
	}

	for _, feature := range strings.Split(features, ",") {
		switch feature {
		case FeatureReceiverNameInMetrics:
			opts = append(opts, enableReceiverNameInMetrics())
			level.Warn(logger).Log("msg", "Experimental receiver name in metrics enabled")
		case FeatureClassicMode:
			opts = append(opts, enableClassicMode())
			level.Warn(logger).Log("msg", "Classic mode enabled")
		case FeatureUTF8StrictMode:
			opts = append(opts, enableUTF8StrictMode())
			level.Warn(logger).Log("msg", "UTF-8 strict mode enabled")
		default:
			return nil, fmt.Errorf("Unknown option '%s' for --enable-feature", feature)
		}
	}

	for _, opt := range opts {
		opt(fc)
	}

	if fc.classicMode && fc.utf8StrictMode {
		return nil, errors.New("cannot have both classic and UTF-8 modes enabled")
	}

	return fc, nil
}

type NoopFlags struct{}

func (n NoopFlags) EnableReceiverNamesInMetrics() bool { return false }

func (n NoopFlags) ClassicMode() bool { return false }

func (n NoopFlags) UTF8StrictMode() bool { return false }
