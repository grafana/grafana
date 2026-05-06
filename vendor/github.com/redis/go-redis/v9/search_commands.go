package redis

import (
	"context"
	"fmt"
	"strconv"

	"github.com/redis/go-redis/v9/internal"
	"github.com/redis/go-redis/v9/internal/proto"
)

type SearchCmdable interface {
	FT_List(ctx context.Context) *StringSliceCmd
	FTAggregate(ctx context.Context, index string, query string) *MapStringInterfaceCmd
	FTAggregateWithArgs(ctx context.Context, index string, query string, options *FTAggregateOptions) *AggregateCmd
	FTAliasAdd(ctx context.Context, index string, alias string) *StatusCmd
	FTAliasDel(ctx context.Context, alias string) *StatusCmd
	FTAliasUpdate(ctx context.Context, index string, alias string) *StatusCmd
	FTAlter(ctx context.Context, index string, skipInitialScan bool, definition []interface{}) *StatusCmd
	FTConfigGet(ctx context.Context, option string) *MapMapStringInterfaceCmd
	FTConfigSet(ctx context.Context, option string, value interface{}) *StatusCmd
	FTCreate(ctx context.Context, index string, options *FTCreateOptions, schema ...*FieldSchema) *StatusCmd
	FTCursorDel(ctx context.Context, index string, cursorId int) *StatusCmd
	FTCursorRead(ctx context.Context, index string, cursorId int, count int) *MapStringInterfaceCmd
	FTDictAdd(ctx context.Context, dict string, term ...interface{}) *IntCmd
	FTDictDel(ctx context.Context, dict string, term ...interface{}) *IntCmd
	FTDictDump(ctx context.Context, dict string) *StringSliceCmd
	FTDropIndex(ctx context.Context, index string) *StatusCmd
	FTDropIndexWithArgs(ctx context.Context, index string, options *FTDropIndexOptions) *StatusCmd
	FTExplain(ctx context.Context, index string, query string) *StringCmd
	FTExplainWithArgs(ctx context.Context, index string, query string, options *FTExplainOptions) *StringCmd
	FTInfo(ctx context.Context, index string) *FTInfoCmd
	FTSpellCheck(ctx context.Context, index string, query string) *FTSpellCheckCmd
	FTSpellCheckWithArgs(ctx context.Context, index string, query string, options *FTSpellCheckOptions) *FTSpellCheckCmd
	FTSearch(ctx context.Context, index string, query string) *FTSearchCmd
	FTSearchWithArgs(ctx context.Context, index string, query string, options *FTSearchOptions) *FTSearchCmd
	FTSynDump(ctx context.Context, index string) *FTSynDumpCmd
	FTSynUpdate(ctx context.Context, index string, synGroupId interface{}, terms []interface{}) *StatusCmd
	FTSynUpdateWithArgs(ctx context.Context, index string, synGroupId interface{}, options *FTSynUpdateOptions, terms []interface{}) *StatusCmd
	FTTagVals(ctx context.Context, index string, field string) *StringSliceCmd
}

type FTCreateOptions struct {
	OnHash          bool
	OnJSON          bool
	Prefix          []interface{}
	Filter          string
	DefaultLanguage string
	LanguageField   string
	Score           float64
	ScoreField      string
	PayloadField    string
	MaxTextFields   int
	NoOffsets       bool
	Temporary       int
	NoHL            bool
	NoFields        bool
	NoFreqs         bool
	StopWords       []interface{}
	SkipInitialScan bool
}

type FieldSchema struct {
	FieldName         string
	As                string
	FieldType         SearchFieldType
	Sortable          bool
	UNF               bool
	NoStem            bool
	NoIndex           bool
	PhoneticMatcher   string
	Weight            float64
	Separator         string
	CaseSensitive     bool
	WithSuffixtrie    bool
	VectorArgs        *FTVectorArgs
	GeoShapeFieldType string
	IndexEmpty        bool
	IndexMissing      bool
}

type FTVectorArgs struct {
	FlatOptions *FTFlatOptions
	HNSWOptions *FTHNSWOptions
}

type FTFlatOptions struct {
	Type            string
	Dim             int
	DistanceMetric  string
	InitialCapacity int
	BlockSize       int
}

type FTHNSWOptions struct {
	Type                   string
	Dim                    int
	DistanceMetric         string
	InitialCapacity        int
	MaxEdgesPerNode        int
	MaxAllowedEdgesPerNode int
	EFRunTime              int
	Epsilon                float64
}

type FTDropIndexOptions struct {
	DeleteDocs bool
}

type SpellCheckTerms struct {
	Include    bool
	Exclude    bool
	Dictionary string
}

type FTExplainOptions struct {
	// Dialect 1,3 and 4 are deprecated since redis 8.0
	Dialect string
}

type FTSynUpdateOptions struct {
	SkipInitialScan bool
}

type SearchAggregator int

const (
	SearchInvalid = SearchAggregator(iota)
	SearchAvg
	SearchSum
	SearchMin
	SearchMax
	SearchCount
	SearchCountDistinct
	SearchCountDistinctish
	SearchStdDev
	SearchQuantile
	SearchToList
	SearchFirstValue
	SearchRandomSample
)

func (a SearchAggregator) String() string {
	switch a {
	case SearchInvalid:
		return ""
	case SearchAvg:
		return "AVG"
	case SearchSum:
		return "SUM"
	case SearchMin:
		return "MIN"
	case SearchMax:
		return "MAX"
	case SearchCount:
		return "COUNT"
	case SearchCountDistinct:
		return "COUNT_DISTINCT"
	case SearchCountDistinctish:
		return "COUNT_DISTINCTISH"
	case SearchStdDev:
		return "STDDEV"
	case SearchQuantile:
		return "QUANTILE"
	case SearchToList:
		return "TOLIST"
	case SearchFirstValue:
		return "FIRST_VALUE"
	case SearchRandomSample:
		return "RANDOM_SAMPLE"
	default:
		return ""
	}
}

type SearchFieldType int

const (
	SearchFieldTypeInvalid = SearchFieldType(iota)
	SearchFieldTypeNumeric
	SearchFieldTypeTag
	SearchFieldTypeText
	SearchFieldTypeGeo
	SearchFieldTypeVector
	SearchFieldTypeGeoShape
)

func (t SearchFieldType) String() string {
	switch t {
	case SearchFieldTypeInvalid:
		return ""
	case SearchFieldTypeNumeric:
		return "NUMERIC"
	case SearchFieldTypeTag:
		return "TAG"
	case SearchFieldTypeText:
		return "TEXT"
	case SearchFieldTypeGeo:
		return "GEO"
	case SearchFieldTypeVector:
		return "VECTOR"
	case SearchFieldTypeGeoShape:
		return "GEOSHAPE"
	default:
		return "TEXT"
	}
}

// Each AggregateReducer have different args.
// Please follow https://redis.io/docs/interact/search-and-query/search/aggregations/#supported-groupby-reducers for more information.
type FTAggregateReducer struct {
	Reducer SearchAggregator
	Args    []interface{}
	As      string
}

type FTAggregateGroupBy struct {
	Fields []interface{}
	Reduce []FTAggregateReducer
}

type FTAggregateSortBy struct {
	FieldName string
	Asc       bool
	Desc      bool
}

type FTAggregateApply struct {
	Field string
	As    string
}

type FTAggregateLoad struct {
	Field string
	As    string
}

type FTAggregateWithCursor struct {
	Count   int
	MaxIdle int
}

type FTAggregateOptions struct {
	Verbatim  bool
	LoadAll   bool
	Load      []FTAggregateLoad
	Timeout   int
	GroupBy   []FTAggregateGroupBy
	SortBy    []FTAggregateSortBy
	SortByMax int
	// Scorer is used to set scoring function, if not set passed, a default will be used.
	// The default scorer depends on the Redis version:
	// - `BM25` for Redis >= 8
	// - `TFIDF` for Redis < 8
	Scorer string
	// AddScores is available in Redis CE 8
	AddScores         bool
	Apply             []FTAggregateApply
	LimitOffset       int
	Limit             int
	Filter            string
	WithCursor        bool
	WithCursorOptions *FTAggregateWithCursor
	Params            map[string]interface{}
	// Dialect 1,3 and 4 are deprecated since redis 8.0
	DialectVersion int
}

type FTSearchFilter struct {
	FieldName interface{}
	Min       interface{}
	Max       interface{}
}

type FTSearchGeoFilter struct {
	FieldName string
	Longitude float64
	Latitude  float64
	Radius    float64
	Unit      string
}

type FTSearchReturn struct {
	FieldName string
	As        string
}

type FTSearchSortBy struct {
	FieldName string
	Asc       bool
	Desc      bool
}

// FTSearchOptions hold options that can be passed to the FT.SEARCH command.
// More information about the options can be found
// in the documentation for FT.SEARCH https://redis.io/docs/latest/commands/ft.search/
type FTSearchOptions struct {
	NoContent    bool
	Verbatim     bool
	NoStopWords  bool
	WithScores   bool
	WithPayloads bool
	WithSortKeys bool
	Filters      []FTSearchFilter
	GeoFilter    []FTSearchGeoFilter
	InKeys       []interface{}
	InFields     []interface{}
	Return       []FTSearchReturn
	Slop         int
	Timeout      int
	InOrder      bool
	Language     string
	Expander     string
	// Scorer is used to set scoring function, if not set passed, a default will be used.
	// The default scorer depends on the Redis version:
	// - `BM25` for Redis >= 8
	// - `TFIDF` for Redis < 8
	Scorer          string
	ExplainScore    bool
	Payload         string
	SortBy          []FTSearchSortBy
	SortByWithCount bool
	LimitOffset     int
	Limit           int
	// CountOnly sets LIMIT 0 0 to get the count - number of documents in the result set without actually returning the result set.
	// When using this option, the Limit and LimitOffset options are ignored.
	CountOnly bool
	Params    map[string]interface{}
	// Dialect 1,3 and 4 are deprecated since redis 8.0
	DialectVersion int
}

type FTSynDumpResult struct {
	Term     string
	Synonyms []string
}

type FTSynDumpCmd struct {
	baseCmd
	val []FTSynDumpResult
}

type FTAggregateResult struct {
	Total int
	Rows  []AggregateRow
}

type AggregateRow struct {
	Fields map[string]interface{}
}

type AggregateCmd struct {
	baseCmd
	val *FTAggregateResult
}

type FTInfoResult struct {
	IndexErrors              IndexErrors
	Attributes               []FTAttribute
	BytesPerRecordAvg        string
	Cleaning                 int
	CursorStats              CursorStats
	DialectStats             map[string]int
	DocTableSizeMB           float64
	FieldStatistics          []FieldStatistic
	GCStats                  GCStats
	GeoshapesSzMB            float64
	HashIndexingFailures     int
	IndexDefinition          IndexDefinition
	IndexName                string
	IndexOptions             []string
	Indexing                 int
	InvertedSzMB             float64
	KeyTableSizeMB           float64
	MaxDocID                 int
	NumDocs                  int
	NumRecords               int
	NumTerms                 int
	NumberOfUses             int
	OffsetBitsPerRecordAvg   string
	OffsetVectorsSzMB        float64
	OffsetsPerTermAvg        string
	PercentIndexed           float64
	RecordsPerDocAvg         string
	SortableValuesSizeMB     float64
	TagOverheadSzMB          float64
	TextOverheadSzMB         float64
	TotalIndexMemorySzMB     float64
	TotalIndexingTime        int
	TotalInvertedIndexBlocks int
	VectorIndexSzMB          float64
}

type IndexErrors struct {
	IndexingFailures     int
	LastIndexingError    string
	LastIndexingErrorKey string
}

type FTAttribute struct {
	Identifier      string
	Attribute       string
	Type            string
	Weight          float64
	Sortable        bool
	NoStem          bool
	NoIndex         bool
	UNF             bool
	PhoneticMatcher string
	CaseSensitive   bool
	WithSuffixtrie  bool
}

type CursorStats struct {
	GlobalIdle    int
	GlobalTotal   int
	IndexCapacity int
	IndexTotal    int
}

type FieldStatistic struct {
	Identifier  string
	Attribute   string
	IndexErrors IndexErrors
}

type GCStats struct {
	BytesCollected       int
	TotalMsRun           int
	TotalCycles          int
	AverageCycleTimeMs   string
	LastRunTimeMs        int
	GCNumericTreesMissed int
	GCBlocksDenied       int
}

type IndexDefinition struct {
	KeyType      string
	Prefixes     []string
	DefaultScore float64
}

type FTSpellCheckOptions struct {
	Distance int
	Terms    *FTSpellCheckTerms
	// Dialect 1,3 and 4 are deprecated since redis 8.0
	Dialect int
}

type FTSpellCheckTerms struct {
	Inclusion  string // Either "INCLUDE" or "EXCLUDE"
	Dictionary string
	Terms      []interface{}
}

type SpellCheckResult struct {
	Term        string
	Suggestions []SpellCheckSuggestion
}

type SpellCheckSuggestion struct {
	Score      float64
	Suggestion string
}

type FTSearchResult struct {
	Total int
	Docs  []Document
}

type Document struct {
	ID      string
	Score   *float64
	Payload *string
	SortKey *string
	Fields  map[string]string
}

type AggregateQuery []interface{}

// FT_List - Lists all the existing indexes in the database.
// For more information, please refer to the Redis documentation:
// [FT._LIST]: (https://redis.io/commands/ft._list/)
func (c cmdable) FT_List(ctx context.Context) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "FT._LIST")
	_ = c(ctx, cmd)
	return cmd
}

// FTAggregate - Performs a search query on an index and applies a series of aggregate transformations to the result.
// The 'index' parameter specifies the index to search, and the 'query' parameter specifies the search query.
// For more information, please refer to the Redis documentation:
// [FT.AGGREGATE]: (https://redis.io/commands/ft.aggregate/)
func (c cmdable) FTAggregate(ctx context.Context, index string, query string) *MapStringInterfaceCmd {
	args := []interface{}{"FT.AGGREGATE", index, query}
	cmd := NewMapStringInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

func FTAggregateQuery(query string, options *FTAggregateOptions) AggregateQuery {
	queryArgs := []interface{}{query}
	if options != nil {
		if options.Verbatim {
			queryArgs = append(queryArgs, "VERBATIM")
		}

		if options.Scorer != "" {
			queryArgs = append(queryArgs, "SCORER", options.Scorer)
		}

		if options.AddScores {
			queryArgs = append(queryArgs, "ADDSCORES")
		}

		if options.LoadAll && options.Load != nil {
			panic("FT.AGGREGATE: LOADALL and LOAD are mutually exclusive")
		}
		if options.LoadAll {
			queryArgs = append(queryArgs, "LOAD", "*")
		}
		if options.Load != nil {
			queryArgs = append(queryArgs, "LOAD", len(options.Load))
			index, count := len(queryArgs)-1, 0
			for _, load := range options.Load {
				queryArgs = append(queryArgs, load.Field)
				count++
				if load.As != "" {
					queryArgs = append(queryArgs, "AS", load.As)
					count += 2
				}
			}
			queryArgs[index] = count
		}

		if options.Timeout > 0 {
			queryArgs = append(queryArgs, "TIMEOUT", options.Timeout)
		}

		for _, apply := range options.Apply {
			queryArgs = append(queryArgs, "APPLY", apply.Field)
			if apply.As != "" {
				queryArgs = append(queryArgs, "AS", apply.As)
			}
		}

		if options.GroupBy != nil {
			for _, groupBy := range options.GroupBy {
				queryArgs = append(queryArgs, "GROUPBY", len(groupBy.Fields))
				queryArgs = append(queryArgs, groupBy.Fields...)

				for _, reducer := range groupBy.Reduce {
					queryArgs = append(queryArgs, "REDUCE")
					queryArgs = append(queryArgs, reducer.Reducer.String())
					if reducer.Args != nil {
						queryArgs = append(queryArgs, len(reducer.Args))
						queryArgs = append(queryArgs, reducer.Args...)
					} else {
						queryArgs = append(queryArgs, 0)
					}
					if reducer.As != "" {
						queryArgs = append(queryArgs, "AS", reducer.As)
					}
				}
			}
		}
		if options.SortBy != nil {
			queryArgs = append(queryArgs, "SORTBY")
			sortByOptions := []interface{}{}
			for _, sortBy := range options.SortBy {
				sortByOptions = append(sortByOptions, sortBy.FieldName)
				if sortBy.Asc && sortBy.Desc {
					panic("FT.AGGREGATE: ASC and DESC are mutually exclusive")
				}
				if sortBy.Asc {
					sortByOptions = append(sortByOptions, "ASC")
				}
				if sortBy.Desc {
					sortByOptions = append(sortByOptions, "DESC")
				}
			}
			queryArgs = append(queryArgs, len(sortByOptions))
			queryArgs = append(queryArgs, sortByOptions...)
		}
		if options.SortByMax > 0 {
			queryArgs = append(queryArgs, "MAX", options.SortByMax)
		}
		if options.LimitOffset >= 0 && options.Limit > 0 {
			queryArgs = append(queryArgs, "LIMIT", options.LimitOffset, options.Limit)
		}
		if options.Filter != "" {
			queryArgs = append(queryArgs, "FILTER", options.Filter)
		}
		if options.WithCursor {
			queryArgs = append(queryArgs, "WITHCURSOR")
			if options.WithCursorOptions != nil {
				if options.WithCursorOptions.Count > 0 {
					queryArgs = append(queryArgs, "COUNT", options.WithCursorOptions.Count)
				}
				if options.WithCursorOptions.MaxIdle > 0 {
					queryArgs = append(queryArgs, "MAXIDLE", options.WithCursorOptions.MaxIdle)
				}
			}
		}
		if options.Params != nil {
			queryArgs = append(queryArgs, "PARAMS", len(options.Params)*2)
			for key, value := range options.Params {
				queryArgs = append(queryArgs, key, value)
			}
		}

		if options.DialectVersion > 0 {
			queryArgs = append(queryArgs, "DIALECT", options.DialectVersion)
		} else {
			queryArgs = append(queryArgs, "DIALECT", 2)
		}
	}
	return queryArgs
}

func ProcessAggregateResult(data []interface{}) (*FTAggregateResult, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("no data returned")
	}

	total, ok := data[0].(int64)
	if !ok {
		return nil, fmt.Errorf("invalid total format")
	}

	rows := make([]AggregateRow, 0, len(data)-1)
	for _, row := range data[1:] {
		fields, ok := row.([]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid row format")
		}

		rowMap := make(map[string]interface{})
		for i := 0; i < len(fields); i += 2 {
			key, ok := fields[i].(string)
			if !ok {
				return nil, fmt.Errorf("invalid field key format")
			}
			value := fields[i+1]
			rowMap[key] = value
		}
		rows = append(rows, AggregateRow{Fields: rowMap})
	}

	result := &FTAggregateResult{
		Total: int(total),
		Rows:  rows,
	}
	return result, nil
}

func NewAggregateCmd(ctx context.Context, args ...interface{}) *AggregateCmd {
	return &AggregateCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *AggregateCmd) SetVal(val *FTAggregateResult) {
	cmd.val = val
}

func (cmd *AggregateCmd) Val() *FTAggregateResult {
	return cmd.val
}

func (cmd *AggregateCmd) Result() (*FTAggregateResult, error) {
	return cmd.val, cmd.err
}

func (cmd *AggregateCmd) RawVal() interface{} {
	return cmd.rawVal
}

func (cmd *AggregateCmd) RawResult() (interface{}, error) {
	return cmd.rawVal, cmd.err
}

func (cmd *AggregateCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *AggregateCmd) readReply(rd *proto.Reader) (err error) {
	data, err := rd.ReadSlice()
	if err != nil {
		return err
	}
	cmd.val, err = ProcessAggregateResult(data)
	if err != nil {
		return err
	}
	return nil
}

// FTAggregateWithArgs - Performs a search query on an index and applies a series of aggregate transformations to the result.
// The 'index' parameter specifies the index to search, and the 'query' parameter specifies the search query.
// This function also allows for specifying additional options such as: Verbatim, LoadAll, Load, Timeout, GroupBy, SortBy, SortByMax, Apply, LimitOffset, Limit, Filter, WithCursor, Params, and DialectVersion.
// For more information, please refer to the Redis documentation:
// [FT.AGGREGATE]: (https://redis.io/commands/ft.aggregate/)
func (c cmdable) FTAggregateWithArgs(ctx context.Context, index string, query string, options *FTAggregateOptions) *AggregateCmd {
	args := []interface{}{"FT.AGGREGATE", index, query}
	if options != nil {
		if options.Verbatim {
			args = append(args, "VERBATIM")
		}
		if options.Scorer != "" {
			args = append(args, "SCORER", options.Scorer)
		}
		if options.AddScores {
			args = append(args, "ADDSCORES")
		}
		if options.LoadAll && options.Load != nil {
			panic("FT.AGGREGATE: LOADALL and LOAD are mutually exclusive")
		}
		if options.LoadAll {
			args = append(args, "LOAD", "*")
		}
		if options.Load != nil {
			args = append(args, "LOAD", len(options.Load))
			index, count := len(args)-1, 0
			for _, load := range options.Load {
				args = append(args, load.Field)
				count++
				if load.As != "" {
					args = append(args, "AS", load.As)
					count += 2
				}
			}
			args[index] = count
		}
		if options.Timeout > 0 {
			args = append(args, "TIMEOUT", options.Timeout)
		}
		for _, apply := range options.Apply {
			args = append(args, "APPLY", apply.Field)
			if apply.As != "" {
				args = append(args, "AS", apply.As)
			}
		}
		if options.GroupBy != nil {
			for _, groupBy := range options.GroupBy {
				args = append(args, "GROUPBY", len(groupBy.Fields))
				args = append(args, groupBy.Fields...)

				for _, reducer := range groupBy.Reduce {
					args = append(args, "REDUCE")
					args = append(args, reducer.Reducer.String())
					if reducer.Args != nil {
						args = append(args, len(reducer.Args))
						args = append(args, reducer.Args...)
					} else {
						args = append(args, 0)
					}
					if reducer.As != "" {
						args = append(args, "AS", reducer.As)
					}
				}
			}
		}
		if options.SortBy != nil {
			args = append(args, "SORTBY")
			sortByOptions := []interface{}{}
			for _, sortBy := range options.SortBy {
				sortByOptions = append(sortByOptions, sortBy.FieldName)
				if sortBy.Asc && sortBy.Desc {
					panic("FT.AGGREGATE: ASC and DESC are mutually exclusive")
				}
				if sortBy.Asc {
					sortByOptions = append(sortByOptions, "ASC")
				}
				if sortBy.Desc {
					sortByOptions = append(sortByOptions, "DESC")
				}
			}
			args = append(args, len(sortByOptions))
			args = append(args, sortByOptions...)
		}
		if options.SortByMax > 0 {
			args = append(args, "MAX", options.SortByMax)
		}
		if options.LimitOffset >= 0 && options.Limit > 0 {
			args = append(args, "LIMIT", options.LimitOffset, options.Limit)
		}
		if options.Filter != "" {
			args = append(args, "FILTER", options.Filter)
		}
		if options.WithCursor {
			args = append(args, "WITHCURSOR")
			if options.WithCursorOptions != nil {
				if options.WithCursorOptions.Count > 0 {
					args = append(args, "COUNT", options.WithCursorOptions.Count)
				}
				if options.WithCursorOptions.MaxIdle > 0 {
					args = append(args, "MAXIDLE", options.WithCursorOptions.MaxIdle)
				}
			}
		}
		if options.Params != nil {
			args = append(args, "PARAMS", len(options.Params)*2)
			for key, value := range options.Params {
				args = append(args, key, value)
			}
		}
		if options.DialectVersion > 0 {
			args = append(args, "DIALECT", options.DialectVersion)
		} else {
			args = append(args, "DIALECT", 2)
		}
	}

	cmd := NewAggregateCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTAliasAdd - Adds an alias to an index.
// The 'index' parameter specifies the index to which the alias is added, and the 'alias' parameter specifies the alias.
// For more information, please refer to the Redis documentation:
// [FT.ALIASADD]: (https://redis.io/commands/ft.aliasadd/)
func (c cmdable) FTAliasAdd(ctx context.Context, index string, alias string) *StatusCmd {
	args := []interface{}{"FT.ALIASADD", alias, index}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTAliasDel - Removes an alias from an index.
// The 'alias' parameter specifies the alias to be removed.
// For more information, please refer to the Redis documentation:
// [FT.ALIASDEL]: (https://redis.io/commands/ft.aliasdel/)
func (c cmdable) FTAliasDel(ctx context.Context, alias string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "FT.ALIASDEL", alias)
	_ = c(ctx, cmd)
	return cmd
}

// FTAliasUpdate - Updates an alias to an index.
// The 'index' parameter specifies the index to which the alias is updated, and the 'alias' parameter specifies the alias.
// If the alias already exists for a different index, it updates the alias to point to the specified index instead.
// For more information, please refer to the Redis documentation:
// [FT.ALIASUPDATE]: (https://redis.io/commands/ft.aliasupdate/)
func (c cmdable) FTAliasUpdate(ctx context.Context, index string, alias string) *StatusCmd {
	cmd := NewStatusCmd(ctx, "FT.ALIASUPDATE", alias, index)
	_ = c(ctx, cmd)
	return cmd
}

// FTAlter - Alters the definition of an existing index.
// The 'index' parameter specifies the index to alter, and the 'skipInitialScan' parameter specifies whether to skip the initial scan.
// The 'definition' parameter specifies the new definition for the index.
// For more information, please refer to the Redis documentation:
// [FT.ALTER]: (https://redis.io/commands/ft.alter/)
func (c cmdable) FTAlter(ctx context.Context, index string, skipInitialScan bool, definition []interface{}) *StatusCmd {
	args := []interface{}{"FT.ALTER", index}
	if skipInitialScan {
		args = append(args, "SKIPINITIALSCAN")
	}
	args = append(args, "SCHEMA", "ADD")
	args = append(args, definition...)
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// Retrieves the value of a RediSearch configuration parameter.
// The 'option' parameter specifies the configuration parameter to retrieve.
// For more information, please refer to the Redis [FT.CONFIG GET] documentation.
//
// Deprecated: FTConfigGet is deprecated in Redis 8.
// All configuration will be done with the CONFIG GET command.
// For more information check [Client.ConfigGet] and [CONFIG GET Documentation]
//
// [CONFIG GET Documentation]: https://redis.io/commands/config-get/
// [FT.CONFIG GET]: https://redis.io/commands/ft.config-get/
func (c cmdable) FTConfigGet(ctx context.Context, option string) *MapMapStringInterfaceCmd {
	cmd := NewMapMapStringInterfaceCmd(ctx, "FT.CONFIG", "GET", option)
	_ = c(ctx, cmd)
	return cmd
}

// Sets the value of a RediSearch configuration parameter.
// The 'option' parameter specifies the configuration parameter to set, and the 'value' parameter specifies the new value.
// For more information, please refer to the Redis [FT.CONFIG SET] documentation.
//
// Deprecated: FTConfigSet is deprecated in Redis 8.
// All configuration will be done with the CONFIG SET command.
// For more information check [Client.ConfigSet] and [CONFIG SET Documentation]
//
// [CONFIG SET Documentation]: https://redis.io/commands/config-set/
// [FT.CONFIG SET]: https://redis.io/commands/ft.config-set/
func (c cmdable) FTConfigSet(ctx context.Context, option string, value interface{}) *StatusCmd {
	cmd := NewStatusCmd(ctx, "FT.CONFIG", "SET", option, value)
	_ = c(ctx, cmd)
	return cmd
}

// FTCreate - Creates a new index with the given options and schema.
// The 'index' parameter specifies the name of the index to create.
// The 'options' parameter specifies various options for the index, such as:
// whether to index hashes or JSONs, prefixes, filters, default language, score, score field, payload field, etc.
// The 'schema' parameter specifies the schema for the index, which includes the field name, field type, etc.
// For more information, please refer to the Redis documentation:
// [FT.CREATE]: (https://redis.io/commands/ft.create/)
func (c cmdable) FTCreate(ctx context.Context, index string, options *FTCreateOptions, schema ...*FieldSchema) *StatusCmd {
	args := []interface{}{"FT.CREATE", index}
	if options != nil {
		if options.OnHash && !options.OnJSON {
			args = append(args, "ON", "HASH")
		}
		if options.OnJSON && !options.OnHash {
			args = append(args, "ON", "JSON")
		}
		if options.OnHash && options.OnJSON {
			panic("FT.CREATE: ON HASH and ON JSON are mutually exclusive")
		}
		if options.Prefix != nil {
			args = append(args, "PREFIX", len(options.Prefix))
			args = append(args, options.Prefix...)
		}
		if options.Filter != "" {
			args = append(args, "FILTER", options.Filter)
		}
		if options.DefaultLanguage != "" {
			args = append(args, "LANGUAGE", options.DefaultLanguage)
		}
		if options.LanguageField != "" {
			args = append(args, "LANGUAGE_FIELD", options.LanguageField)
		}
		if options.Score > 0 {
			args = append(args, "SCORE", options.Score)
		}
		if options.ScoreField != "" {
			args = append(args, "SCORE_FIELD", options.ScoreField)
		}
		if options.PayloadField != "" {
			args = append(args, "PAYLOAD_FIELD", options.PayloadField)
		}
		if options.MaxTextFields > 0 {
			args = append(args, "MAXTEXTFIELDS", options.MaxTextFields)
		}
		if options.NoOffsets {
			args = append(args, "NOOFFSETS")
		}
		if options.Temporary > 0 {
			args = append(args, "TEMPORARY", options.Temporary)
		}
		if options.NoHL {
			args = append(args, "NOHL")
		}
		if options.NoFields {
			args = append(args, "NOFIELDS")
		}
		if options.NoFreqs {
			args = append(args, "NOFREQS")
		}
		if options.StopWords != nil {
			args = append(args, "STOPWORDS", len(options.StopWords))
			args = append(args, options.StopWords...)
		}
		if options.SkipInitialScan {
			args = append(args, "SKIPINITIALSCAN")
		}
	}
	if schema == nil {
		panic("FT.CREATE: SCHEMA is required")
	}
	args = append(args, "SCHEMA")
	for _, schema := range schema {
		if schema.FieldName == "" || schema.FieldType == SearchFieldTypeInvalid {
			panic("FT.CREATE: SCHEMA FieldName and FieldType are required")
		}
		args = append(args, schema.FieldName)
		if schema.As != "" {
			args = append(args, "AS", schema.As)
		}
		args = append(args, schema.FieldType.String())
		if schema.VectorArgs != nil {
			if schema.FieldType != SearchFieldTypeVector {
				panic("FT.CREATE: SCHEMA FieldType VECTOR is required for VectorArgs")
			}
			if schema.VectorArgs.FlatOptions != nil && schema.VectorArgs.HNSWOptions != nil {
				panic("FT.CREATE: SCHEMA VectorArgs FlatOptions and HNSWOptions are mutually exclusive")
			}
			if schema.VectorArgs.FlatOptions != nil {
				args = append(args, "FLAT")
				if schema.VectorArgs.FlatOptions.Type == "" || schema.VectorArgs.FlatOptions.Dim == 0 || schema.VectorArgs.FlatOptions.DistanceMetric == "" {
					panic("FT.CREATE: Type, Dim and DistanceMetric are required for VECTOR FLAT")
				}
				flatArgs := []interface{}{
					"TYPE", schema.VectorArgs.FlatOptions.Type,
					"DIM", schema.VectorArgs.FlatOptions.Dim,
					"DISTANCE_METRIC", schema.VectorArgs.FlatOptions.DistanceMetric,
				}
				if schema.VectorArgs.FlatOptions.InitialCapacity > 0 {
					flatArgs = append(flatArgs, "INITIAL_CAP", schema.VectorArgs.FlatOptions.InitialCapacity)
				}
				if schema.VectorArgs.FlatOptions.BlockSize > 0 {
					flatArgs = append(flatArgs, "BLOCK_SIZE", schema.VectorArgs.FlatOptions.BlockSize)
				}
				args = append(args, len(flatArgs))
				args = append(args, flatArgs...)
			}
			if schema.VectorArgs.HNSWOptions != nil {
				args = append(args, "HNSW")
				if schema.VectorArgs.HNSWOptions.Type == "" || schema.VectorArgs.HNSWOptions.Dim == 0 || schema.VectorArgs.HNSWOptions.DistanceMetric == "" {
					panic("FT.CREATE: Type, Dim and DistanceMetric are required for VECTOR HNSW")
				}
				hnswArgs := []interface{}{
					"TYPE", schema.VectorArgs.HNSWOptions.Type,
					"DIM", schema.VectorArgs.HNSWOptions.Dim,
					"DISTANCE_METRIC", schema.VectorArgs.HNSWOptions.DistanceMetric,
				}
				if schema.VectorArgs.HNSWOptions.InitialCapacity > 0 {
					hnswArgs = append(hnswArgs, "INITIAL_CAP", schema.VectorArgs.HNSWOptions.InitialCapacity)
				}
				if schema.VectorArgs.HNSWOptions.MaxEdgesPerNode > 0 {
					hnswArgs = append(hnswArgs, "M", schema.VectorArgs.HNSWOptions.MaxEdgesPerNode)
				}
				if schema.VectorArgs.HNSWOptions.MaxAllowedEdgesPerNode > 0 {
					hnswArgs = append(hnswArgs, "EF_CONSTRUCTION", schema.VectorArgs.HNSWOptions.MaxAllowedEdgesPerNode)
				}
				if schema.VectorArgs.HNSWOptions.EFRunTime > 0 {
					hnswArgs = append(hnswArgs, "EF_RUNTIME", schema.VectorArgs.HNSWOptions.EFRunTime)
				}
				if schema.VectorArgs.HNSWOptions.Epsilon > 0 {
					hnswArgs = append(hnswArgs, "EPSILON", schema.VectorArgs.HNSWOptions.Epsilon)
				}
				args = append(args, len(hnswArgs))
				args = append(args, hnswArgs...)
			}
		}
		if schema.GeoShapeFieldType != "" {
			if schema.FieldType != SearchFieldTypeGeoShape {
				panic("FT.CREATE: SCHEMA FieldType GEOSHAPE is required for GeoShapeFieldType")
			}
			args = append(args, schema.GeoShapeFieldType)
		}
		if schema.NoStem {
			args = append(args, "NOSTEM")
		}
		if schema.Sortable {
			args = append(args, "SORTABLE")
		}
		if schema.UNF {
			args = append(args, "UNF")
		}
		if schema.NoIndex {
			args = append(args, "NOINDEX")
		}
		if schema.PhoneticMatcher != "" {
			args = append(args, "PHONETIC", schema.PhoneticMatcher)
		}
		if schema.Weight > 0 {
			args = append(args, "WEIGHT", schema.Weight)
		}
		if schema.Separator != "" {
			args = append(args, "SEPARATOR", schema.Separator)
		}
		if schema.CaseSensitive {
			args = append(args, "CASESENSITIVE")
		}
		if schema.WithSuffixtrie {
			args = append(args, "WITHSUFFIXTRIE")
		}
		if schema.IndexEmpty {
			args = append(args, "INDEXEMPTY")
		}
		if schema.IndexMissing {
			args = append(args, "INDEXMISSING")

		}
	}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTCursorDel - Deletes a cursor from an existing index.
// The 'index' parameter specifies the index from which to delete the cursor, and the 'cursorId' parameter specifies the ID of the cursor to delete.
// For more information, please refer to the Redis documentation:
// [FT.CURSOR DEL]: (https://redis.io/commands/ft.cursor-del/)
func (c cmdable) FTCursorDel(ctx context.Context, index string, cursorId int) *StatusCmd {
	cmd := NewStatusCmd(ctx, "FT.CURSOR", "DEL", index, cursorId)
	_ = c(ctx, cmd)
	return cmd
}

// FTCursorRead - Reads the next results from an existing cursor.
// The 'index' parameter specifies the index from which to read the cursor, the 'cursorId' parameter specifies the ID of the cursor to read, and the 'count' parameter specifies the number of results to read.
// For more information, please refer to the Redis documentation:
// [FT.CURSOR READ]: (https://redis.io/commands/ft.cursor-read/)
func (c cmdable) FTCursorRead(ctx context.Context, index string, cursorId int, count int) *MapStringInterfaceCmd {
	args := []interface{}{"FT.CURSOR", "READ", index, cursorId}
	if count > 0 {
		args = append(args, "COUNT", count)
	}
	cmd := NewMapStringInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTDictAdd - Adds terms to a dictionary.
// The 'dict' parameter specifies the dictionary to which to add the terms, and the 'term' parameter specifies the terms to add.
// For more information, please refer to the Redis documentation:
// [FT.DICTADD]: (https://redis.io/commands/ft.dictadd/)
func (c cmdable) FTDictAdd(ctx context.Context, dict string, term ...interface{}) *IntCmd {
	args := []interface{}{"FT.DICTADD", dict}
	args = append(args, term...)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTDictDel - Deletes terms from a dictionary.
// The 'dict' parameter specifies the dictionary from which to delete the terms, and the 'term' parameter specifies the terms to delete.
// For more information, please refer to the Redis documentation:
// [FT.DICTDEL]: (https://redis.io/commands/ft.dictdel/)
func (c cmdable) FTDictDel(ctx context.Context, dict string, term ...interface{}) *IntCmd {
	args := []interface{}{"FT.DICTDEL", dict}
	args = append(args, term...)
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTDictDump - Returns all terms in the specified dictionary.
// The 'dict' parameter specifies the dictionary from which to return the terms.
// For more information, please refer to the Redis documentation:
// [FT.DICTDUMP]: (https://redis.io/commands/ft.dictdump/)
func (c cmdable) FTDictDump(ctx context.Context, dict string) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "FT.DICTDUMP", dict)
	_ = c(ctx, cmd)
	return cmd
}

// FTDropIndex - Deletes an index.
// The 'index' parameter specifies the index to delete.
// For more information, please refer to the Redis documentation:
// [FT.DROPINDEX]: (https://redis.io/commands/ft.dropindex/)
func (c cmdable) FTDropIndex(ctx context.Context, index string) *StatusCmd {
	args := []interface{}{"FT.DROPINDEX", index}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTDropIndexWithArgs - Deletes an index with options.
// The 'index' parameter specifies the index to delete, and the 'options' parameter specifies the DeleteDocs option for docs deletion.
// For more information, please refer to the Redis documentation:
// [FT.DROPINDEX]: (https://redis.io/commands/ft.dropindex/)
func (c cmdable) FTDropIndexWithArgs(ctx context.Context, index string, options *FTDropIndexOptions) *StatusCmd {
	args := []interface{}{"FT.DROPINDEX", index}
	if options != nil {
		if options.DeleteDocs {
			args = append(args, "DD")
		}
	}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTExplain - Returns the execution plan for a complex query.
// The 'index' parameter specifies the index to query, and the 'query' parameter specifies the query string.
// For more information, please refer to the Redis documentation:
// [FT.EXPLAIN]: (https://redis.io/commands/ft.explain/)
func (c cmdable) FTExplain(ctx context.Context, index string, query string) *StringCmd {
	cmd := NewStringCmd(ctx, "FT.EXPLAIN", index, query)
	_ = c(ctx, cmd)
	return cmd
}

// FTExplainWithArgs - Returns the execution plan for a complex query with options.
// The 'index' parameter specifies the index to query, the 'query' parameter specifies the query string, and the 'options' parameter specifies the Dialect for the query.
// For more information, please refer to the Redis documentation:
// [FT.EXPLAIN]: (https://redis.io/commands/ft.explain/)
func (c cmdable) FTExplainWithArgs(ctx context.Context, index string, query string, options *FTExplainOptions) *StringCmd {
	args := []interface{}{"FT.EXPLAIN", index, query}
	if options.Dialect != "" {
		args = append(args, "DIALECT", options.Dialect)
	} else {
		args = append(args, "DIALECT", 2)
	}
	cmd := NewStringCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTExplainCli - Returns the execution plan for a complex query. [Not Implemented]
// For more information, see https://redis.io/commands/ft.explaincli/
func (c cmdable) FTExplainCli(ctx context.Context, key, path string) error {
	panic("not implemented")
}

func parseFTInfo(data map[string]interface{}) (FTInfoResult, error) {
	var ftInfo FTInfoResult
	// Manually parse each field from the map
	if indexErrors, ok := data["Index Errors"].([]interface{}); ok {
		ftInfo.IndexErrors = IndexErrors{
			IndexingFailures:     internal.ToInteger(indexErrors[1]),
			LastIndexingError:    internal.ToString(indexErrors[3]),
			LastIndexingErrorKey: internal.ToString(indexErrors[5]),
		}
	}

	if attributes, ok := data["attributes"].([]interface{}); ok {
		for _, attr := range attributes {
			if attrMap, ok := attr.([]interface{}); ok {
				att := FTAttribute{}
				for i := 0; i < len(attrMap); i++ {
					if internal.ToLower(internal.ToString(attrMap[i])) == "attribute" {
						att.Attribute = internal.ToString(attrMap[i+1])
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "identifier" {
						att.Identifier = internal.ToString(attrMap[i+1])
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "type" {
						att.Type = internal.ToString(attrMap[i+1])
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "weight" {
						att.Weight = internal.ToFloat(attrMap[i+1])
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "nostem" {
						att.NoStem = true
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "sortable" {
						att.Sortable = true
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "noindex" {
						att.NoIndex = true
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "unf" {
						att.UNF = true
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "phonetic" {
						att.PhoneticMatcher = internal.ToString(attrMap[i+1])
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "case_sensitive" {
						att.CaseSensitive = true
						continue
					}
					if internal.ToLower(internal.ToString(attrMap[i])) == "withsuffixtrie" {
						att.WithSuffixtrie = true
						continue
					}

				}
				ftInfo.Attributes = append(ftInfo.Attributes, att)
			}
		}
	}

	ftInfo.BytesPerRecordAvg = internal.ToString(data["bytes_per_record_avg"])
	ftInfo.Cleaning = internal.ToInteger(data["cleaning"])

	if cursorStats, ok := data["cursor_stats"].([]interface{}); ok {
		ftInfo.CursorStats = CursorStats{
			GlobalIdle:    internal.ToInteger(cursorStats[1]),
			GlobalTotal:   internal.ToInteger(cursorStats[3]),
			IndexCapacity: internal.ToInteger(cursorStats[5]),
			IndexTotal:    internal.ToInteger(cursorStats[7]),
		}
	}

	if dialectStats, ok := data["dialect_stats"].([]interface{}); ok {
		ftInfo.DialectStats = make(map[string]int)
		for i := 0; i < len(dialectStats); i += 2 {
			ftInfo.DialectStats[internal.ToString(dialectStats[i])] = internal.ToInteger(dialectStats[i+1])
		}
	}

	ftInfo.DocTableSizeMB = internal.ToFloat(data["doc_table_size_mb"])

	if fieldStats, ok := data["field statistics"].([]interface{}); ok {
		for _, stat := range fieldStats {
			if statMap, ok := stat.([]interface{}); ok {
				ftInfo.FieldStatistics = append(ftInfo.FieldStatistics, FieldStatistic{
					Identifier: internal.ToString(statMap[1]),
					Attribute:  internal.ToString(statMap[3]),
					IndexErrors: IndexErrors{
						IndexingFailures:     internal.ToInteger(statMap[5].([]interface{})[1]),
						LastIndexingError:    internal.ToString(statMap[5].([]interface{})[3]),
						LastIndexingErrorKey: internal.ToString(statMap[5].([]interface{})[5]),
					},
				})
			}
		}
	}

	if gcStats, ok := data["gc_stats"].([]interface{}); ok {
		ftInfo.GCStats = GCStats{}
		for i := 0; i < len(gcStats); i += 2 {
			if internal.ToLower(internal.ToString(gcStats[i])) == "bytes_collected" {
				ftInfo.GCStats.BytesCollected = internal.ToInteger(gcStats[i+1])
				continue
			}
			if internal.ToLower(internal.ToString(gcStats[i])) == "total_ms_run" {
				ftInfo.GCStats.TotalMsRun = internal.ToInteger(gcStats[i+1])
				continue
			}
			if internal.ToLower(internal.ToString(gcStats[i])) == "total_cycles" {
				ftInfo.GCStats.TotalCycles = internal.ToInteger(gcStats[i+1])
				continue
			}
			if internal.ToLower(internal.ToString(gcStats[i])) == "average_cycle_time_ms" {
				ftInfo.GCStats.AverageCycleTimeMs = internal.ToString(gcStats[i+1])
				continue
			}
			if internal.ToLower(internal.ToString(gcStats[i])) == "last_run_time_ms" {
				ftInfo.GCStats.LastRunTimeMs = internal.ToInteger(gcStats[i+1])
				continue
			}
			if internal.ToLower(internal.ToString(gcStats[i])) == "gc_numeric_trees_missed" {
				ftInfo.GCStats.GCNumericTreesMissed = internal.ToInteger(gcStats[i+1])
				continue
			}
			if internal.ToLower(internal.ToString(gcStats[i])) == "gc_blocks_denied" {
				ftInfo.GCStats.GCBlocksDenied = internal.ToInteger(gcStats[i+1])
				continue
			}
		}
	}

	ftInfo.GeoshapesSzMB = internal.ToFloat(data["geoshapes_sz_mb"])
	ftInfo.HashIndexingFailures = internal.ToInteger(data["hash_indexing_failures"])

	if indexDef, ok := data["index_definition"].([]interface{}); ok {
		ftInfo.IndexDefinition = IndexDefinition{
			KeyType:      internal.ToString(indexDef[1]),
			Prefixes:     internal.ToStringSlice(indexDef[3]),
			DefaultScore: internal.ToFloat(indexDef[5]),
		}
	}

	ftInfo.IndexName = internal.ToString(data["index_name"])
	ftInfo.IndexOptions = internal.ToStringSlice(data["index_options"].([]interface{}))
	ftInfo.Indexing = internal.ToInteger(data["indexing"])
	ftInfo.InvertedSzMB = internal.ToFloat(data["inverted_sz_mb"])
	ftInfo.KeyTableSizeMB = internal.ToFloat(data["key_table_size_mb"])
	ftInfo.MaxDocID = internal.ToInteger(data["max_doc_id"])
	ftInfo.NumDocs = internal.ToInteger(data["num_docs"])
	ftInfo.NumRecords = internal.ToInteger(data["num_records"])
	ftInfo.NumTerms = internal.ToInteger(data["num_terms"])
	ftInfo.NumberOfUses = internal.ToInteger(data["number_of_uses"])
	ftInfo.OffsetBitsPerRecordAvg = internal.ToString(data["offset_bits_per_record_avg"])
	ftInfo.OffsetVectorsSzMB = internal.ToFloat(data["offset_vectors_sz_mb"])
	ftInfo.OffsetsPerTermAvg = internal.ToString(data["offsets_per_term_avg"])
	ftInfo.PercentIndexed = internal.ToFloat(data["percent_indexed"])
	ftInfo.RecordsPerDocAvg = internal.ToString(data["records_per_doc_avg"])
	ftInfo.SortableValuesSizeMB = internal.ToFloat(data["sortable_values_size_mb"])
	ftInfo.TagOverheadSzMB = internal.ToFloat(data["tag_overhead_sz_mb"])
	ftInfo.TextOverheadSzMB = internal.ToFloat(data["text_overhead_sz_mb"])
	ftInfo.TotalIndexMemorySzMB = internal.ToFloat(data["total_index_memory_sz_mb"])
	ftInfo.TotalIndexingTime = internal.ToInteger(data["total_indexing_time"])
	ftInfo.TotalInvertedIndexBlocks = internal.ToInteger(data["total_inverted_index_blocks"])
	ftInfo.VectorIndexSzMB = internal.ToFloat(data["vector_index_sz_mb"])

	return ftInfo, nil
}

type FTInfoCmd struct {
	baseCmd
	val FTInfoResult
}

func newFTInfoCmd(ctx context.Context, args ...interface{}) *FTInfoCmd {
	return &FTInfoCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *FTInfoCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *FTInfoCmd) SetVal(val FTInfoResult) {
	cmd.val = val
}

func (cmd *FTInfoCmd) Result() (FTInfoResult, error) {
	return cmd.val, cmd.err
}

func (cmd *FTInfoCmd) Val() FTInfoResult {
	return cmd.val
}

func (cmd *FTInfoCmd) RawVal() interface{} {
	return cmd.rawVal
}

func (cmd *FTInfoCmd) RawResult() (interface{}, error) {
	return cmd.rawVal, cmd.err
}
func (cmd *FTInfoCmd) readReply(rd *proto.Reader) (err error) {
	n, err := rd.ReadMapLen()
	if err != nil {
		return err
	}

	data := make(map[string]interface{}, n)
	for i := 0; i < n; i++ {
		k, err := rd.ReadString()
		if err != nil {
			return err
		}
		v, err := rd.ReadReply()
		if err != nil {
			if err == Nil {
				data[k] = Nil
				continue
			}
			if err, ok := err.(proto.RedisError); ok {
				data[k] = err
				continue
			}
			return err
		}
		data[k] = v
	}
	cmd.val, err = parseFTInfo(data)
	if err != nil {
		return err
	}

	return nil
}

// FTInfo - Retrieves information about an index.
// The 'index' parameter specifies the index to retrieve information about.
// For more information, please refer to the Redis documentation:
// [FT.INFO]: (https://redis.io/commands/ft.info/)
func (c cmdable) FTInfo(ctx context.Context, index string) *FTInfoCmd {
	cmd := newFTInfoCmd(ctx, "FT.INFO", index)
	_ = c(ctx, cmd)
	return cmd
}

// FTSpellCheck - Checks a query string for spelling errors.
// For more details about spellcheck query please follow:
// https://redis.io/docs/interact/search-and-query/advanced-concepts/spellcheck/
// For more information, please refer to the Redis documentation:
// [FT.SPELLCHECK]: (https://redis.io/commands/ft.spellcheck/)
func (c cmdable) FTSpellCheck(ctx context.Context, index string, query string) *FTSpellCheckCmd {
	args := []interface{}{"FT.SPELLCHECK", index, query}
	cmd := newFTSpellCheckCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTSpellCheckWithArgs - Checks a query string for spelling errors with additional options.
// For more details about spellcheck query please follow:
// https://redis.io/docs/interact/search-and-query/advanced-concepts/spellcheck/
// For more information, please refer to the Redis documentation:
// [FT.SPELLCHECK]: (https://redis.io/commands/ft.spellcheck/)
func (c cmdable) FTSpellCheckWithArgs(ctx context.Context, index string, query string, options *FTSpellCheckOptions) *FTSpellCheckCmd {
	args := []interface{}{"FT.SPELLCHECK", index, query}
	if options != nil {
		if options.Distance > 0 {
			args = append(args, "DISTANCE", options.Distance)
		}
		if options.Terms != nil {
			args = append(args, "TERMS", options.Terms.Inclusion, options.Terms.Dictionary)
			args = append(args, options.Terms.Terms...)
		}
		if options.Dialect > 0 {
			args = append(args, "DIALECT", options.Dialect)
		} else {
			args = append(args, "DIALECT", 2)
		}
	}
	cmd := newFTSpellCheckCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

type FTSpellCheckCmd struct {
	baseCmd
	val []SpellCheckResult
}

func newFTSpellCheckCmd(ctx context.Context, args ...interface{}) *FTSpellCheckCmd {
	return &FTSpellCheckCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *FTSpellCheckCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *FTSpellCheckCmd) SetVal(val []SpellCheckResult) {
	cmd.val = val
}

func (cmd *FTSpellCheckCmd) Result() ([]SpellCheckResult, error) {
	return cmd.val, cmd.err
}

func (cmd *FTSpellCheckCmd) Val() []SpellCheckResult {
	return cmd.val
}

func (cmd *FTSpellCheckCmd) RawVal() interface{} {
	return cmd.rawVal
}

func (cmd *FTSpellCheckCmd) RawResult() (interface{}, error) {
	return cmd.rawVal, cmd.err
}

func (cmd *FTSpellCheckCmd) readReply(rd *proto.Reader) (err error) {
	data, err := rd.ReadSlice()
	if err != nil {
		return err
	}
	cmd.val, err = parseFTSpellCheck(data)
	if err != nil {
		return err
	}
	return nil
}

func parseFTSpellCheck(data []interface{}) ([]SpellCheckResult, error) {
	results := make([]SpellCheckResult, 0, len(data))

	for _, termData := range data {
		termInfo, ok := termData.([]interface{})
		if !ok || len(termInfo) != 3 {
			return nil, fmt.Errorf("invalid term format")
		}

		term, ok := termInfo[1].(string)
		if !ok {
			return nil, fmt.Errorf("invalid term format")
		}

		suggestionsData, ok := termInfo[2].([]interface{})
		if !ok {
			return nil, fmt.Errorf("invalid suggestions format")
		}

		suggestions := make([]SpellCheckSuggestion, 0, len(suggestionsData))
		for _, suggestionData := range suggestionsData {
			suggestionInfo, ok := suggestionData.([]interface{})
			if !ok || len(suggestionInfo) != 2 {
				return nil, fmt.Errorf("invalid suggestion format")
			}

			scoreStr, ok := suggestionInfo[0].(string)
			if !ok {
				return nil, fmt.Errorf("invalid suggestion score format")
			}
			score, err := strconv.ParseFloat(scoreStr, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid suggestion score value")
			}

			suggestion, ok := suggestionInfo[1].(string)
			if !ok {
				return nil, fmt.Errorf("invalid suggestion format")
			}

			suggestions = append(suggestions, SpellCheckSuggestion{
				Score:      score,
				Suggestion: suggestion,
			})
		}

		results = append(results, SpellCheckResult{
			Term:        term,
			Suggestions: suggestions,
		})
	}

	return results, nil
}

func parseFTSearch(data []interface{}, noContent, withScores, withPayloads, withSortKeys bool) (FTSearchResult, error) {
	if len(data) < 1 {
		return FTSearchResult{}, fmt.Errorf("unexpected search result format")
	}

	total, ok := data[0].(int64)
	if !ok {
		return FTSearchResult{}, fmt.Errorf("invalid total results format")
	}

	var results []Document
	for i := 1; i < len(data); {
		docID, ok := data[i].(string)
		if !ok {
			return FTSearchResult{}, fmt.Errorf("invalid document ID format")
		}

		doc := Document{
			ID:     docID,
			Fields: make(map[string]string),
		}
		i++

		if noContent {
			results = append(results, doc)
			continue
		}

		if withScores && i < len(data) {
			if scoreStr, ok := data[i].(string); ok {
				score, err := strconv.ParseFloat(scoreStr, 64)
				if err != nil {
					return FTSearchResult{}, fmt.Errorf("invalid score format")
				}
				doc.Score = &score
				i++
			}
		}

		if withPayloads && i < len(data) {
			if payload, ok := data[i].(string); ok {
				doc.Payload = &payload
				i++
			}
		}

		if withSortKeys && i < len(data) {
			if sortKey, ok := data[i].(string); ok {
				doc.SortKey = &sortKey
				i++
			}
		}

		if i < len(data) {
			fields, ok := data[i].([]interface{})
			if !ok {
				return FTSearchResult{}, fmt.Errorf("invalid document fields format")
			}

			for j := 0; j < len(fields); j += 2 {
				key, ok := fields[j].(string)
				if !ok {
					return FTSearchResult{}, fmt.Errorf("invalid field key format")
				}
				value, ok := fields[j+1].(string)
				if !ok {
					return FTSearchResult{}, fmt.Errorf("invalid field value format")
				}
				doc.Fields[key] = value
			}
			i++
		}

		results = append(results, doc)
	}
	return FTSearchResult{
		Total: int(total),
		Docs:  results,
	}, nil
}

type FTSearchCmd struct {
	baseCmd
	val     FTSearchResult
	options *FTSearchOptions
}

func newFTSearchCmd(ctx context.Context, options *FTSearchOptions, args ...interface{}) *FTSearchCmd {
	return &FTSearchCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
		options: options,
	}
}

func (cmd *FTSearchCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *FTSearchCmd) SetVal(val FTSearchResult) {
	cmd.val = val
}

func (cmd *FTSearchCmd) Result() (FTSearchResult, error) {
	return cmd.val, cmd.err
}

func (cmd *FTSearchCmd) Val() FTSearchResult {
	return cmd.val
}

func (cmd *FTSearchCmd) RawVal() interface{} {
	return cmd.rawVal
}

func (cmd *FTSearchCmd) RawResult() (interface{}, error) {
	return cmd.rawVal, cmd.err
}

func (cmd *FTSearchCmd) readReply(rd *proto.Reader) (err error) {
	data, err := rd.ReadSlice()
	if err != nil {
		return err
	}
	cmd.val, err = parseFTSearch(data, cmd.options.NoContent, cmd.options.WithScores, cmd.options.WithPayloads, cmd.options.WithSortKeys)
	if err != nil {
		return err
	}
	return nil
}

// FTSearch - Executes a search query on an index.
// The 'index' parameter specifies the index to search, and the 'query' parameter specifies the search query.
// For more information, please refer to the Redis documentation about [FT.SEARCH].
//
// [FT.SEARCH]: (https://redis.io/commands/ft.search/)
func (c cmdable) FTSearch(ctx context.Context, index string, query string) *FTSearchCmd {
	args := []interface{}{"FT.SEARCH", index, query}
	cmd := newFTSearchCmd(ctx, &FTSearchOptions{}, args...)
	_ = c(ctx, cmd)
	return cmd
}

type SearchQuery []interface{}

// FTSearchQuery - Executes a search query on an index with additional options.
// The 'index' parameter specifies the index to search, the 'query' parameter specifies the search query,
// and the 'options' parameter specifies additional options for the search.
// For more information, please refer to the Redis documentation about [FT.SEARCH].
//
// [FT.SEARCH]: (https://redis.io/commands/ft.search/)
func FTSearchQuery(query string, options *FTSearchOptions) SearchQuery {
	queryArgs := []interface{}{query}
	if options != nil {
		if options.NoContent {
			queryArgs = append(queryArgs, "NOCONTENT")
		}
		if options.Verbatim {
			queryArgs = append(queryArgs, "VERBATIM")
		}
		if options.NoStopWords {
			queryArgs = append(queryArgs, "NOSTOPWORDS")
		}
		if options.WithScores {
			queryArgs = append(queryArgs, "WITHSCORES")
		}
		if options.WithPayloads {
			queryArgs = append(queryArgs, "WITHPAYLOADS")
		}
		if options.WithSortKeys {
			queryArgs = append(queryArgs, "WITHSORTKEYS")
		}
		if options.Filters != nil {
			for _, filter := range options.Filters {
				queryArgs = append(queryArgs, "FILTER", filter.FieldName, filter.Min, filter.Max)
			}
		}
		if options.GeoFilter != nil {
			for _, geoFilter := range options.GeoFilter {
				queryArgs = append(queryArgs, "GEOFILTER", geoFilter.FieldName, geoFilter.Longitude, geoFilter.Latitude, geoFilter.Radius, geoFilter.Unit)
			}
		}
		if options.InKeys != nil {
			queryArgs = append(queryArgs, "INKEYS", len(options.InKeys))
			queryArgs = append(queryArgs, options.InKeys...)
		}
		if options.InFields != nil {
			queryArgs = append(queryArgs, "INFIELDS", len(options.InFields))
			queryArgs = append(queryArgs, options.InFields...)
		}
		if options.Return != nil {
			queryArgs = append(queryArgs, "RETURN")
			queryArgsReturn := []interface{}{}
			for _, ret := range options.Return {
				queryArgsReturn = append(queryArgsReturn, ret.FieldName)
				if ret.As != "" {
					queryArgsReturn = append(queryArgsReturn, "AS", ret.As)
				}
			}
			queryArgs = append(queryArgs, len(queryArgsReturn))
			queryArgs = append(queryArgs, queryArgsReturn...)
		}
		if options.Slop > 0 {
			queryArgs = append(queryArgs, "SLOP", options.Slop)
		}
		if options.Timeout > 0 {
			queryArgs = append(queryArgs, "TIMEOUT", options.Timeout)
		}
		if options.InOrder {
			queryArgs = append(queryArgs, "INORDER")
		}
		if options.Language != "" {
			queryArgs = append(queryArgs, "LANGUAGE", options.Language)
		}
		if options.Expander != "" {
			queryArgs = append(queryArgs, "EXPANDER", options.Expander)
		}
		if options.Scorer != "" {
			queryArgs = append(queryArgs, "SCORER", options.Scorer)
		}
		if options.ExplainScore {
			queryArgs = append(queryArgs, "EXPLAINSCORE")
		}
		if options.Payload != "" {
			queryArgs = append(queryArgs, "PAYLOAD", options.Payload)
		}
		if options.SortBy != nil {
			queryArgs = append(queryArgs, "SORTBY")
			for _, sortBy := range options.SortBy {
				queryArgs = append(queryArgs, sortBy.FieldName)
				if sortBy.Asc && sortBy.Desc {
					panic("FT.SEARCH: ASC and DESC are mutually exclusive")
				}
				if sortBy.Asc {
					queryArgs = append(queryArgs, "ASC")
				}
				if sortBy.Desc {
					queryArgs = append(queryArgs, "DESC")
				}
			}
			if options.SortByWithCount {
				queryArgs = append(queryArgs, "WITHCOUNT")
			}
		}
		if options.LimitOffset >= 0 && options.Limit > 0 {
			queryArgs = append(queryArgs, "LIMIT", options.LimitOffset, options.Limit)
		}
		if options.Params != nil {
			queryArgs = append(queryArgs, "PARAMS", len(options.Params)*2)
			for key, value := range options.Params {
				queryArgs = append(queryArgs, key, value)
			}
		}
		if options.DialectVersion > 0 {
			queryArgs = append(queryArgs, "DIALECT", options.DialectVersion)
		} else {
			queryArgs = append(queryArgs, "DIALECT", 2)
		}
	}
	return queryArgs
}

// FTSearchWithArgs - Executes a search query on an index with additional options.
// The 'index' parameter specifies the index to search, the 'query' parameter specifies the search query,
// and the 'options' parameter specifies additional options for the search.
// For more information, please refer to the Redis documentation about [FT.SEARCH].
//
// [FT.SEARCH]: (https://redis.io/commands/ft.search/)
func (c cmdable) FTSearchWithArgs(ctx context.Context, index string, query string, options *FTSearchOptions) *FTSearchCmd {
	args := []interface{}{"FT.SEARCH", index, query}
	if options != nil {
		if options.NoContent {
			args = append(args, "NOCONTENT")
		}
		if options.Verbatim {
			args = append(args, "VERBATIM")
		}
		if options.NoStopWords {
			args = append(args, "NOSTOPWORDS")
		}
		if options.WithScores {
			args = append(args, "WITHSCORES")
		}
		if options.WithPayloads {
			args = append(args, "WITHPAYLOADS")
		}
		if options.WithSortKeys {
			args = append(args, "WITHSORTKEYS")
		}
		if options.Filters != nil {
			for _, filter := range options.Filters {
				args = append(args, "FILTER", filter.FieldName, filter.Min, filter.Max)
			}
		}
		if options.GeoFilter != nil {
			for _, geoFilter := range options.GeoFilter {
				args = append(args, "GEOFILTER", geoFilter.FieldName, geoFilter.Longitude, geoFilter.Latitude, geoFilter.Radius, geoFilter.Unit)
			}
		}
		if options.InKeys != nil {
			args = append(args, "INKEYS", len(options.InKeys))
			args = append(args, options.InKeys...)
		}
		if options.InFields != nil {
			args = append(args, "INFIELDS", len(options.InFields))
			args = append(args, options.InFields...)
		}
		if options.Return != nil {
			args = append(args, "RETURN")
			argsReturn := []interface{}{}
			for _, ret := range options.Return {
				argsReturn = append(argsReturn, ret.FieldName)
				if ret.As != "" {
					argsReturn = append(argsReturn, "AS", ret.As)
				}
			}
			args = append(args, len(argsReturn))
			args = append(args, argsReturn...)
		}
		if options.Slop > 0 {
			args = append(args, "SLOP", options.Slop)
		}
		if options.Timeout > 0 {
			args = append(args, "TIMEOUT", options.Timeout)
		}
		if options.InOrder {
			args = append(args, "INORDER")
		}
		if options.Language != "" {
			args = append(args, "LANGUAGE", options.Language)
		}
		if options.Expander != "" {
			args = append(args, "EXPANDER", options.Expander)
		}
		if options.Scorer != "" {
			args = append(args, "SCORER", options.Scorer)
		}
		if options.ExplainScore {
			args = append(args, "EXPLAINSCORE")
		}
		if options.Payload != "" {
			args = append(args, "PAYLOAD", options.Payload)
		}
		if options.SortBy != nil {
			args = append(args, "SORTBY")
			for _, sortBy := range options.SortBy {
				args = append(args, sortBy.FieldName)
				if sortBy.Asc && sortBy.Desc {
					panic("FT.SEARCH: ASC and DESC are mutually exclusive")
				}
				if sortBy.Asc {
					args = append(args, "ASC")
				}
				if sortBy.Desc {
					args = append(args, "DESC")
				}
			}
			if options.SortByWithCount {
				args = append(args, "WITHCOUNT")
			}
		}
		if options.CountOnly {
			args = append(args, "LIMIT", 0, 0)
		} else {
			if options.LimitOffset >= 0 && options.Limit > 0 || options.LimitOffset > 0 && options.Limit == 0 {
				args = append(args, "LIMIT", options.LimitOffset, options.Limit)
			}
		}
		if options.Params != nil {
			args = append(args, "PARAMS", len(options.Params)*2)
			for key, value := range options.Params {
				args = append(args, key, value)
			}
		}
		if options.DialectVersion > 0 {
			args = append(args, "DIALECT", options.DialectVersion)
		} else {
			args = append(args, "DIALECT", 2)
		}
	}
	cmd := newFTSearchCmd(ctx, options, args...)
	_ = c(ctx, cmd)
	return cmd
}

func NewFTSynDumpCmd(ctx context.Context, args ...interface{}) *FTSynDumpCmd {
	return &FTSynDumpCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *FTSynDumpCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *FTSynDumpCmd) SetVal(val []FTSynDumpResult) {
	cmd.val = val
}

func (cmd *FTSynDumpCmd) Val() []FTSynDumpResult {
	return cmd.val
}

func (cmd *FTSynDumpCmd) Result() ([]FTSynDumpResult, error) {
	return cmd.val, cmd.err
}

func (cmd *FTSynDumpCmd) RawVal() interface{} {
	return cmd.rawVal
}

func (cmd *FTSynDumpCmd) RawResult() (interface{}, error) {
	return cmd.rawVal, cmd.err
}

func (cmd *FTSynDumpCmd) readReply(rd *proto.Reader) error {
	termSynonymPairs, err := rd.ReadSlice()
	if err != nil {
		return err
	}

	var results []FTSynDumpResult
	for i := 0; i < len(termSynonymPairs); i += 2 {
		term, ok := termSynonymPairs[i].(string)
		if !ok {
			return fmt.Errorf("invalid term format")
		}

		synonyms, ok := termSynonymPairs[i+1].([]interface{})
		if !ok {
			return fmt.Errorf("invalid synonyms format")
		}

		synonymList := make([]string, len(synonyms))
		for j, syn := range synonyms {
			synonym, ok := syn.(string)
			if !ok {
				return fmt.Errorf("invalid synonym format")
			}
			synonymList[j] = synonym
		}

		results = append(results, FTSynDumpResult{
			Term:     term,
			Synonyms: synonymList,
		})
	}

	cmd.val = results
	return nil
}

// FTSynDump - Dumps the contents of a synonym group.
// The 'index' parameter specifies the index to dump.
// For more information, please refer to the Redis documentation:
// [FT.SYNDUMP]: (https://redis.io/commands/ft.syndump/)
func (c cmdable) FTSynDump(ctx context.Context, index string) *FTSynDumpCmd {
	cmd := NewFTSynDumpCmd(ctx, "FT.SYNDUMP", index)
	_ = c(ctx, cmd)
	return cmd
}

// FTSynUpdate - Creates or updates a synonym group with additional terms.
// The 'index' parameter specifies the index to update, the 'synGroupId' parameter specifies the synonym group id, and the 'terms' parameter specifies the additional terms.
// For more information, please refer to the Redis documentation:
// [FT.SYNUPDATE]: (https://redis.io/commands/ft.synupdate/)
func (c cmdable) FTSynUpdate(ctx context.Context, index string, synGroupId interface{}, terms []interface{}) *StatusCmd {
	args := []interface{}{"FT.SYNUPDATE", index, synGroupId}
	args = append(args, terms...)
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTSynUpdateWithArgs - Creates or updates a synonym group with additional terms and options.
// The 'index' parameter specifies the index to update, the 'synGroupId' parameter specifies the synonym group id, the 'options' parameter specifies additional options for the update, and the 'terms' parameter specifies the additional terms.
// For more information, please refer to the Redis documentation:
// [FT.SYNUPDATE]: (https://redis.io/commands/ft.synupdate/)
func (c cmdable) FTSynUpdateWithArgs(ctx context.Context, index string, synGroupId interface{}, options *FTSynUpdateOptions, terms []interface{}) *StatusCmd {
	args := []interface{}{"FT.SYNUPDATE", index, synGroupId}
	if options.SkipInitialScan {
		args = append(args, "SKIPINITIALSCAN")
	}
	args = append(args, terms...)
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// FTTagVals - Returns all distinct values indexed in a tag field.
// The 'index' parameter specifies the index to check, and the 'field' parameter specifies the tag field to retrieve values from.
// For more information, please refer to the Redis documentation:
// [FT.TAGVALS]: (https://redis.io/commands/ft.tagvals/)
func (c cmdable) FTTagVals(ctx context.Context, index string, field string) *StringSliceCmd {
	cmd := NewStringSliceCmd(ctx, "FT.TAGVALS", index, field)
	_ = c(ctx, cmd)
	return cmd
}
