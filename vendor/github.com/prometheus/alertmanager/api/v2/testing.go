// Copyright 2022 Prometheus Team
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

package v2

import (
	"testing"
	"time"

	"github.com/go-openapi/strfmt"

	open_api_models "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/alertmanager/silence/silencepb"
)

func createSilence(t *testing.T, ID, creator string, start, ends time.Time) open_api_models.PostableSilence {
	t.Helper()

	comment := "test"
	matcherName := "a"
	matcherValue := "b"
	isRegex := false
	startsAt := strfmt.DateTime(start)
	endsAt := strfmt.DateTime(ends)

	sil := open_api_models.PostableSilence{
		ID: ID,
		Silence: open_api_models.Silence{
			Matchers:  open_api_models.Matchers{&open_api_models.Matcher{Name: &matcherName, Value: &matcherValue, IsRegex: &isRegex}},
			StartsAt:  &startsAt,
			EndsAt:    &endsAt,
			CreatedBy: &creator,
			Comment:   &comment,
		},
	}
	return sil
}

func createSilenceMatcher(t *testing.T, name, pattern string, matcherType silencepb.Matcher_Type) *silencepb.Matcher {
	t.Helper()

	return &silencepb.Matcher{
		Name:    name,
		Pattern: pattern,
		Type:    matcherType,
	}
}

func createLabelMatcher(t *testing.T, name, value string, matchType labels.MatchType) *labels.Matcher {
	t.Helper()

	matcher, _ := labels.NewMatcher(matchType, name, value)
	return matcher
}
