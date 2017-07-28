// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "errors"

// MoreLikeThis query (MLT Query) finds documents that are "like" a given
// set of documents. In order to do so, MLT selects a set of representative
// terms of these input documents, forms a query using these terms, executes
// the query and returns the results. The user controls the input documents,
// how the terms should be selected and how the query is formed.
//
// For more details, see
// https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-mlt-query.html
type MoreLikeThisQuery struct {
	fields                 []string
	docs                   []*MoreLikeThisQueryItem
	unlikeDocs             []*MoreLikeThisQueryItem
	include                *bool
	minimumShouldMatch     string
	minTermFreq            *int
	maxQueryTerms          *int
	stopWords              []string
	minDocFreq             *int
	maxDocFreq             *int
	minWordLen             *int
	maxWordLen             *int
	boostTerms             *float64
	boost                  *float64
	analyzer               string
	failOnUnsupportedField *bool
	queryName              string
}

// NewMoreLikeThisQuery creates and initializes a new MoreLikeThisQuery.
func NewMoreLikeThisQuery() *MoreLikeThisQuery {
	return &MoreLikeThisQuery{
		fields:     make([]string, 0),
		stopWords:  make([]string, 0),
		docs:       make([]*MoreLikeThisQueryItem, 0),
		unlikeDocs: make([]*MoreLikeThisQueryItem, 0),
	}
}

// Field adds one or more field names to the query.
func (q *MoreLikeThisQuery) Field(fields ...string) *MoreLikeThisQuery {
	q.fields = append(q.fields, fields...)
	return q
}

// StopWord sets the stopwords. Any word in this set is considered
// "uninteresting" and ignored. Even if your Analyzer allows stopwords,
// you might want to tell the MoreLikeThis code to ignore them, as for
// the purposes of document similarity it seems reasonable to assume that
// "a stop word is never interesting".
func (q *MoreLikeThisQuery) StopWord(stopWords ...string) *MoreLikeThisQuery {
	q.stopWords = append(q.stopWords, stopWords...)
	return q
}

// LikeText sets the text to use in order to find documents that are "like" this.
func (q *MoreLikeThisQuery) LikeText(likeTexts ...string) *MoreLikeThisQuery {
	for _, s := range likeTexts {
		item := NewMoreLikeThisQueryItem().LikeText(s)
		q.docs = append(q.docs, item)
	}
	return q
}

// LikeItems sets the documents to use in order to find documents that are "like" this.
func (q *MoreLikeThisQuery) LikeItems(docs ...*MoreLikeThisQueryItem) *MoreLikeThisQuery {
	q.docs = append(q.docs, docs...)
	return q
}

// IgnoreLikeText sets the text from which the terms should not be selected from.
func (q *MoreLikeThisQuery) IgnoreLikeText(ignoreLikeText ...string) *MoreLikeThisQuery {
	for _, s := range ignoreLikeText {
		item := NewMoreLikeThisQueryItem().LikeText(s)
		q.unlikeDocs = append(q.unlikeDocs, item)
	}
	return q
}

// IgnoreLikeItems sets the documents from which the terms should not be selected from.
func (q *MoreLikeThisQuery) IgnoreLikeItems(ignoreDocs ...*MoreLikeThisQueryItem) *MoreLikeThisQuery {
	q.unlikeDocs = append(q.unlikeDocs, ignoreDocs...)
	return q
}

// Ids sets the document ids to use in order to find documents that are "like" this.
func (q *MoreLikeThisQuery) Ids(ids ...string) *MoreLikeThisQuery {
	for _, id := range ids {
		item := NewMoreLikeThisQueryItem().Id(id)
		q.docs = append(q.docs, item)
	}
	return q
}

// Include specifies whether the input documents should also be included
// in the results returned. Defaults to false.
func (q *MoreLikeThisQuery) Include(include bool) *MoreLikeThisQuery {
	q.include = &include
	return q
}

// MinimumShouldMatch sets the number of terms that must match the generated
// query expressed in the common syntax for minimum should match.
// The default value is "30%".
//
// This used to be "PercentTermsToMatch" in Elasticsearch versions before 2.0.
func (q *MoreLikeThisQuery) MinimumShouldMatch(minimumShouldMatch string) *MoreLikeThisQuery {
	q.minimumShouldMatch = minimumShouldMatch
	return q
}

// MinTermFreq is the frequency below which terms will be ignored in the
// source doc. The default frequency is 2.
func (q *MoreLikeThisQuery) MinTermFreq(minTermFreq int) *MoreLikeThisQuery {
	q.minTermFreq = &minTermFreq
	return q
}

// MaxQueryTerms sets the maximum number of query terms that will be included
// in any generated query. It defaults to 25.
func (q *MoreLikeThisQuery) MaxQueryTerms(maxQueryTerms int) *MoreLikeThisQuery {
	q.maxQueryTerms = &maxQueryTerms
	return q
}

// MinDocFreq sets the frequency at which words will be ignored which do
// not occur in at least this many docs. The default is 5.
func (q *MoreLikeThisQuery) MinDocFreq(minDocFreq int) *MoreLikeThisQuery {
	q.minDocFreq = &minDocFreq
	return q
}

// MaxDocFreq sets the maximum frequency for which words may still appear.
// Words that appear in more than this many docs will be ignored.
// It defaults to unbounded.
func (q *MoreLikeThisQuery) MaxDocFreq(maxDocFreq int) *MoreLikeThisQuery {
	q.maxDocFreq = &maxDocFreq
	return q
}

// MinWordLength sets the minimum word length below which words will be
// ignored. It defaults to 0.
func (q *MoreLikeThisQuery) MinWordLen(minWordLen int) *MoreLikeThisQuery {
	q.minWordLen = &minWordLen
	return q
}

// MaxWordLen sets the maximum word length above which words will be ignored.
// Defaults to unbounded (0).
func (q *MoreLikeThisQuery) MaxWordLen(maxWordLen int) *MoreLikeThisQuery {
	q.maxWordLen = &maxWordLen
	return q
}

// BoostTerms sets the boost factor to use when boosting terms.
// It defaults to 1.
func (q *MoreLikeThisQuery) BoostTerms(boostTerms float64) *MoreLikeThisQuery {
	q.boostTerms = &boostTerms
	return q
}

// Analyzer specifies the analyzer that will be use to analyze the text.
// Defaults to the analyzer associated with the field.
func (q *MoreLikeThisQuery) Analyzer(analyzer string) *MoreLikeThisQuery {
	q.analyzer = analyzer
	return q
}

// Boost sets the boost for this query.
func (q *MoreLikeThisQuery) Boost(boost float64) *MoreLikeThisQuery {
	q.boost = &boost
	return q
}

// FailOnUnsupportedField indicates whether to fail or return no result
// when this query is run against a field which is not supported such as
// a binary/numeric field.
func (q *MoreLikeThisQuery) FailOnUnsupportedField(fail bool) *MoreLikeThisQuery {
	q.failOnUnsupportedField = &fail
	return q
}

// QueryName sets the query name for the filter that can be used when
// searching for matched_filters per hit.
func (q *MoreLikeThisQuery) QueryName(queryName string) *MoreLikeThisQuery {
	q.queryName = queryName
	return q
}

// Source creates the source for the MLT query.
// It may return an error if the caller forgot to specify any documents to
// be "liked" in the MoreLikeThisQuery.
func (q *MoreLikeThisQuery) Source() (interface{}, error) {
	// {
	//   "match_all" : { ... }
	// }
	if len(q.docs) == 0 {
		return nil, errors.New(`more_like_this requires some documents to be "liked"`)
	}

	source := make(map[string]interface{})

	params := make(map[string]interface{})
	source["mlt"] = params

	if len(q.fields) > 0 {
		params["fields"] = q.fields
	}

	var likes []interface{}
	for _, doc := range q.docs {
		src, err := doc.Source()
		if err != nil {
			return nil, err
		}
		likes = append(likes, src)
	}
	params["like"] = likes

	if len(q.unlikeDocs) > 0 {
		var dontLikes []interface{}
		for _, doc := range q.unlikeDocs {
			src, err := doc.Source()
			if err != nil {
				return nil, err
			}
			dontLikes = append(dontLikes, src)
		}
		params["unlike"] = dontLikes
	}

	if q.minimumShouldMatch != "" {
		params["minimum_should_match"] = q.minimumShouldMatch
	}
	if q.minTermFreq != nil {
		params["min_term_freq"] = *q.minTermFreq
	}
	if q.maxQueryTerms != nil {
		params["max_query_terms"] = *q.maxQueryTerms
	}
	if len(q.stopWords) > 0 {
		params["stop_words"] = q.stopWords
	}
	if q.minDocFreq != nil {
		params["min_doc_freq"] = *q.minDocFreq
	}
	if q.maxDocFreq != nil {
		params["max_doc_freq"] = *q.maxDocFreq
	}
	if q.minWordLen != nil {
		params["min_word_len"] = *q.minWordLen
	}
	if q.maxWordLen != nil {
		params["max_word_len"] = *q.maxWordLen
	}
	if q.boostTerms != nil {
		params["boost_terms"] = *q.boostTerms
	}
	if q.boost != nil {
		params["boost"] = *q.boost
	}
	if q.analyzer != "" {
		params["analyzer"] = q.analyzer
	}
	if q.failOnUnsupportedField != nil {
		params["fail_on_unsupported_field"] = *q.failOnUnsupportedField
	}
	if q.queryName != "" {
		params["_name"] = q.queryName
	}
	if q.include != nil {
		params["include"] = *q.include
	}

	return source, nil
}

// -- MoreLikeThisQueryItem --

// MoreLikeThisQueryItem represents a single item of a MoreLikeThisQuery
// to be "liked" or "unliked".
type MoreLikeThisQueryItem struct {
	likeText string

	index       string
	typ         string
	id          string
	doc         interface{}
	fields      []string
	routing     string
	fsc         *FetchSourceContext
	version     int64
	versionType string
}

// NewMoreLikeThisQueryItem creates and initializes a MoreLikeThisQueryItem.
func NewMoreLikeThisQueryItem() *MoreLikeThisQueryItem {
	return &MoreLikeThisQueryItem{
		version: -1,
	}
}

// LikeText represents a text to be "liked".
func (item *MoreLikeThisQueryItem) LikeText(likeText string) *MoreLikeThisQueryItem {
	item.likeText = likeText
	return item
}

// Index represents the index of the item.
func (item *MoreLikeThisQueryItem) Index(index string) *MoreLikeThisQueryItem {
	item.index = index
	return item
}

// Type represents the document type of the item.
func (item *MoreLikeThisQueryItem) Type(typ string) *MoreLikeThisQueryItem {
	item.typ = typ
	return item
}

// Id represents the document id of the item.
func (item *MoreLikeThisQueryItem) Id(id string) *MoreLikeThisQueryItem {
	item.id = id
	return item
}

// Doc represents a raw document template for the item.
func (item *MoreLikeThisQueryItem) Doc(doc interface{}) *MoreLikeThisQueryItem {
	item.doc = doc
	return item
}

// Fields represents the list of fields of the item.
func (item *MoreLikeThisQueryItem) Fields(fields ...string) *MoreLikeThisQueryItem {
	item.fields = append(item.fields, fields...)
	return item
}

// Routing sets the routing associated with the item.
func (item *MoreLikeThisQueryItem) Routing(routing string) *MoreLikeThisQueryItem {
	item.routing = routing
	return item
}

// FetchSourceContext represents the fetch source of the item which controls
// if and how _source should be returned.
func (item *MoreLikeThisQueryItem) FetchSourceContext(fsc *FetchSourceContext) *MoreLikeThisQueryItem {
	item.fsc = fsc
	return item
}

// Version specifies the version of the item.
func (item *MoreLikeThisQueryItem) Version(version int64) *MoreLikeThisQueryItem {
	item.version = version
	return item
}

// VersionType represents the version type of the item.
func (item *MoreLikeThisQueryItem) VersionType(versionType string) *MoreLikeThisQueryItem {
	item.versionType = versionType
	return item
}

// Source returns the JSON-serializable fragment of the entity.
func (item *MoreLikeThisQueryItem) Source() (interface{}, error) {
	if item.likeText != "" {
		return item.likeText, nil
	}

	source := make(map[string]interface{})

	if item.index != "" {
		source["_index"] = item.index
	}
	if item.typ != "" {
		source["_type"] = item.typ
	}
	if item.id != "" {
		source["_id"] = item.id
	}
	if item.doc != nil {
		source["doc"] = item.doc
	}
	if len(item.fields) > 0 {
		source["fields"] = item.fields
	}
	if item.routing != "" {
		source["_routing"] = item.routing
	}
	if item.fsc != nil {
		src, err := item.fsc.Source()
		if err != nil {
			return nil, err
		}
		source["_source"] = src
	}
	if item.version >= 0 {
		source["_version"] = item.version
	}
	if item.versionType != "" {
		source["_version_type"] = item.versionType
	}

	return source, nil
}
