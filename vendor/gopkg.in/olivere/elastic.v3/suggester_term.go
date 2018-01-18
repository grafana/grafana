// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

// For more details, see
// http://www.elasticsearch.org/guide/reference/api/search/term-suggest/
type TermSuggester struct {
	Suggester
	name           string
	text           string
	field          string
	analyzer       string
	size           *int
	shardSize      *int
	contextQueries []SuggesterContextQuery

	// fields specific to term suggester
	suggestMode    string
	accuracy       *float64
	sort           string
	stringDistance string
	maxEdits       *int
	maxInspections *int
	maxTermFreq    *float64
	prefixLength   *int
	minWordLength  *int
	minDocFreq     *float64
}

// Creates a new term suggester.
func NewTermSuggester(name string) *TermSuggester {
	return &TermSuggester{
		name:           name,
		contextQueries: make([]SuggesterContextQuery, 0),
	}
}

func (q *TermSuggester) Name() string {
	return q.name
}

func (q *TermSuggester) Text(text string) *TermSuggester {
	q.text = text
	return q
}

func (q *TermSuggester) Field(field string) *TermSuggester {
	q.field = field
	return q
}

func (q *TermSuggester) Analyzer(analyzer string) *TermSuggester {
	q.analyzer = analyzer
	return q
}

func (q *TermSuggester) Size(size int) *TermSuggester {
	q.size = &size
	return q
}

func (q *TermSuggester) ShardSize(shardSize int) *TermSuggester {
	q.shardSize = &shardSize
	return q
}

func (q *TermSuggester) ContextQuery(query SuggesterContextQuery) *TermSuggester {
	q.contextQueries = append(q.contextQueries, query)
	return q
}

func (q *TermSuggester) ContextQueries(queries ...SuggesterContextQuery) *TermSuggester {
	q.contextQueries = append(q.contextQueries, queries...)
	return q
}

func (q *TermSuggester) SuggestMode(suggestMode string) *TermSuggester {
	q.suggestMode = suggestMode
	return q
}

func (q *TermSuggester) Accuracy(accuracy float64) *TermSuggester {
	q.accuracy = &accuracy
	return q
}

func (q *TermSuggester) Sort(sort string) *TermSuggester {
	q.sort = sort
	return q
}

func (q *TermSuggester) StringDistance(stringDistance string) *TermSuggester {
	q.stringDistance = stringDistance
	return q
}

func (q *TermSuggester) MaxEdits(maxEdits int) *TermSuggester {
	q.maxEdits = &maxEdits
	return q
}

func (q *TermSuggester) MaxInspections(maxInspections int) *TermSuggester {
	q.maxInspections = &maxInspections
	return q
}

func (q *TermSuggester) MaxTermFreq(maxTermFreq float64) *TermSuggester {
	q.maxTermFreq = &maxTermFreq
	return q
}

func (q *TermSuggester) PrefixLength(prefixLength int) *TermSuggester {
	q.prefixLength = &prefixLength
	return q
}

func (q *TermSuggester) MinWordLength(minWordLength int) *TermSuggester {
	q.minWordLength = &minWordLength
	return q
}

func (q *TermSuggester) MinDocFreq(minDocFreq float64) *TermSuggester {
	q.minDocFreq = &minDocFreq
	return q
}

// termSuggesterRequest is necessary because the order in which
// the JSON elements are routed to Elasticsearch is relevant.
// We got into trouble when using plain maps because the text element
// needs to go before the term element.
type termSuggesterRequest struct {
	Text string      `json:"text"`
	Term interface{} `json:"term"`
}

// Creates the source for the term suggester.
func (q *TermSuggester) Source(includeName bool) (interface{}, error) {
	// "suggest" : {
	//   "my-suggest-1" : {
	//     "text" : "the amsterdma meetpu",
	//     "term" : {
	//       "field" : "body"
	//     }
	//   },
	//   "my-suggest-2" : {
	//     "text" : "the rottredam meetpu",
	//     "term" : {
	//       "field" : "title",
	//     }
	//   }
	// }
	ts := &termSuggesterRequest{}
	if q.text != "" {
		ts.Text = q.text
	}

	suggester := make(map[string]interface{})
	ts.Term = suggester

	if q.analyzer != "" {
		suggester["analyzer"] = q.analyzer
	}
	if q.field != "" {
		suggester["field"] = q.field
	}
	if q.size != nil {
		suggester["size"] = *q.size
	}
	if q.shardSize != nil {
		suggester["shard_size"] = *q.shardSize
	}
	switch len(q.contextQueries) {
	case 0:
	case 1:
		src, err := q.contextQueries[0].Source()
		if err != nil {
			return nil, err
		}
		suggester["context"] = src
	default:
		var ctxq []interface{}
		for _, query := range q.contextQueries {
			src, err := query.Source()
			if err != nil {
				return nil, err
			}
			ctxq = append(ctxq, src)
		}
		suggester["context"] = ctxq
	}

	// Specific to term suggester
	if q.suggestMode != "" {
		suggester["suggest_mode"] = q.suggestMode
	}
	if q.accuracy != nil {
		suggester["accuracy"] = *q.accuracy
	}
	if q.sort != "" {
		suggester["sort"] = q.sort
	}
	if q.stringDistance != "" {
		suggester["string_distance"] = q.stringDistance
	}
	if q.maxEdits != nil {
		suggester["max_edits"] = *q.maxEdits
	}
	if q.maxInspections != nil {
		suggester["max_inspections"] = *q.maxInspections
	}
	if q.maxTermFreq != nil {
		suggester["max_term_freq"] = *q.maxTermFreq
	}
	if q.prefixLength != nil {
		suggester["prefix_len"] = *q.prefixLength
	}
	if q.minWordLength != nil {
		suggester["min_word_len"] = *q.minWordLength
	}
	if q.minDocFreq != nil {
		suggester["min_doc_freq"] = *q.minDocFreq
	}

	if !includeName {
		return ts, nil
	}

	source := make(map[string]interface{})
	source[q.name] = ts
	return source, nil
}
