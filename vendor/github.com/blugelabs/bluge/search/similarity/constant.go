//  Copyright (c) 2020 The Bluge Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package similarity

import "github.com/blugelabs/bluge/search"

type ConstantScorer float64

func (c ConstantScorer) Score(_ int, _ float64) float64 {
	return float64(c)
}

func (c ConstantScorer) Explain(_ int, _ float64) *search.Explanation {
	return search.NewExplanation(float64(c), "constant")
}

func (c ConstantScorer) ScoreComposite(_ []*search.DocumentMatch) float64 {
	return float64(c)
}
func (c ConstantScorer) ExplainComposite(_ []*search.DocumentMatch) *search.Explanation {
	return search.NewExplanation(float64(c), "constant")
}
