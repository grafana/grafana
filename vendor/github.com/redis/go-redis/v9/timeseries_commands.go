package redis

import (
	"context"
	"strconv"

	"github.com/redis/go-redis/v9/internal/proto"
)

type TimeseriesCmdable interface {
	TSAdd(ctx context.Context, key string, timestamp interface{}, value float64) *IntCmd
	TSAddWithArgs(ctx context.Context, key string, timestamp interface{}, value float64, options *TSOptions) *IntCmd
	TSCreate(ctx context.Context, key string) *StatusCmd
	TSCreateWithArgs(ctx context.Context, key string, options *TSOptions) *StatusCmd
	TSAlter(ctx context.Context, key string, options *TSAlterOptions) *StatusCmd
	TSCreateRule(ctx context.Context, sourceKey string, destKey string, aggregator Aggregator, bucketDuration int) *StatusCmd
	TSCreateRuleWithArgs(ctx context.Context, sourceKey string, destKey string, aggregator Aggregator, bucketDuration int, options *TSCreateRuleOptions) *StatusCmd
	TSIncrBy(ctx context.Context, Key string, timestamp float64) *IntCmd
	TSIncrByWithArgs(ctx context.Context, key string, timestamp float64, options *TSIncrDecrOptions) *IntCmd
	TSDecrBy(ctx context.Context, Key string, timestamp float64) *IntCmd
	TSDecrByWithArgs(ctx context.Context, key string, timestamp float64, options *TSIncrDecrOptions) *IntCmd
	TSDel(ctx context.Context, Key string, fromTimestamp int, toTimestamp int) *IntCmd
	TSDeleteRule(ctx context.Context, sourceKey string, destKey string) *StatusCmd
	TSGet(ctx context.Context, key string) *TSTimestampValueCmd
	TSGetWithArgs(ctx context.Context, key string, options *TSGetOptions) *TSTimestampValueCmd
	TSInfo(ctx context.Context, key string) *MapStringInterfaceCmd
	TSInfoWithArgs(ctx context.Context, key string, options *TSInfoOptions) *MapStringInterfaceCmd
	TSMAdd(ctx context.Context, ktvSlices [][]interface{}) *IntSliceCmd
	TSQueryIndex(ctx context.Context, filterExpr []string) *StringSliceCmd
	TSRevRange(ctx context.Context, key string, fromTimestamp int, toTimestamp int) *TSTimestampValueSliceCmd
	TSRevRangeWithArgs(ctx context.Context, key string, fromTimestamp int, toTimestamp int, options *TSRevRangeOptions) *TSTimestampValueSliceCmd
	TSRange(ctx context.Context, key string, fromTimestamp int, toTimestamp int) *TSTimestampValueSliceCmd
	TSRangeWithArgs(ctx context.Context, key string, fromTimestamp int, toTimestamp int, options *TSRangeOptions) *TSTimestampValueSliceCmd
	TSMRange(ctx context.Context, fromTimestamp int, toTimestamp int, filterExpr []string) *MapStringSliceInterfaceCmd
	TSMRangeWithArgs(ctx context.Context, fromTimestamp int, toTimestamp int, filterExpr []string, options *TSMRangeOptions) *MapStringSliceInterfaceCmd
	TSMRevRange(ctx context.Context, fromTimestamp int, toTimestamp int, filterExpr []string) *MapStringSliceInterfaceCmd
	TSMRevRangeWithArgs(ctx context.Context, fromTimestamp int, toTimestamp int, filterExpr []string, options *TSMRevRangeOptions) *MapStringSliceInterfaceCmd
	TSMGet(ctx context.Context, filters []string) *MapStringSliceInterfaceCmd
	TSMGetWithArgs(ctx context.Context, filters []string, options *TSMGetOptions) *MapStringSliceInterfaceCmd
}

type TSOptions struct {
	Retention         int
	ChunkSize         int
	Encoding          string
	DuplicatePolicy   string
	Labels            map[string]string
	IgnoreMaxTimeDiff int64
	IgnoreMaxValDiff  float64
}
type TSIncrDecrOptions struct {
	Timestamp         int64
	Retention         int
	ChunkSize         int
	Uncompressed      bool
	DuplicatePolicy   string
	Labels            map[string]string
	IgnoreMaxTimeDiff int64
	IgnoreMaxValDiff  float64
}

type TSAlterOptions struct {
	Retention         int
	ChunkSize         int
	DuplicatePolicy   string
	Labels            map[string]string
	IgnoreMaxTimeDiff int64
	IgnoreMaxValDiff  float64
}

type TSCreateRuleOptions struct {
	alignTimestamp int64
}

type TSGetOptions struct {
	Latest bool
}

type TSInfoOptions struct {
	Debug bool
}
type Aggregator int

const (
	Invalid = Aggregator(iota)
	Avg
	Sum
	Min
	Max
	Range
	Count
	First
	Last
	StdP
	StdS
	VarP
	VarS
	Twa
)

func (a Aggregator) String() string {
	switch a {
	case Invalid:
		return ""
	case Avg:
		return "AVG"
	case Sum:
		return "SUM"
	case Min:
		return "MIN"
	case Max:
		return "MAX"
	case Range:
		return "RANGE"
	case Count:
		return "COUNT"
	case First:
		return "FIRST"
	case Last:
		return "LAST"
	case StdP:
		return "STD.P"
	case StdS:
		return "STD.S"
	case VarP:
		return "VAR.P"
	case VarS:
		return "VAR.S"
	case Twa:
		return "TWA"
	default:
		return ""
	}
}

type TSRangeOptions struct {
	Latest          bool
	FilterByTS      []int
	FilterByValue   []int
	Count           int
	Align           interface{}
	Aggregator      Aggregator
	BucketDuration  int
	BucketTimestamp interface{}
	Empty           bool
}

type TSRevRangeOptions struct {
	Latest          bool
	FilterByTS      []int
	FilterByValue   []int
	Count           int
	Align           interface{}
	Aggregator      Aggregator
	BucketDuration  int
	BucketTimestamp interface{}
	Empty           bool
}

type TSMRangeOptions struct {
	Latest          bool
	FilterByTS      []int
	FilterByValue   []int
	WithLabels      bool
	SelectedLabels  []interface{}
	Count           int
	Align           interface{}
	Aggregator      Aggregator
	BucketDuration  int
	BucketTimestamp interface{}
	Empty           bool
	GroupByLabel    interface{}
	Reducer         interface{}
}

type TSMRevRangeOptions struct {
	Latest          bool
	FilterByTS      []int
	FilterByValue   []int
	WithLabels      bool
	SelectedLabels  []interface{}
	Count           int
	Align           interface{}
	Aggregator      Aggregator
	BucketDuration  int
	BucketTimestamp interface{}
	Empty           bool
	GroupByLabel    interface{}
	Reducer         interface{}
}

type TSMGetOptions struct {
	Latest         bool
	WithLabels     bool
	SelectedLabels []interface{}
}

// TSAdd - Adds one or more observations to a t-digest sketch.
// For more information - https://redis.io/commands/ts.add/
func (c cmdable) TSAdd(ctx context.Context, key string, timestamp interface{}, value float64) *IntCmd {
	args := []interface{}{"TS.ADD", key, timestamp, value}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSAddWithArgs - Adds one or more observations to a t-digest sketch.
// This function also allows for specifying additional options such as:
// Retention, ChunkSize, Encoding, DuplicatePolicy and Labels.
// For more information - https://redis.io/commands/ts.add/
func (c cmdable) TSAddWithArgs(ctx context.Context, key string, timestamp interface{}, value float64, options *TSOptions) *IntCmd {
	args := []interface{}{"TS.ADD", key, timestamp, value}
	if options != nil {
		if options.Retention != 0 {
			args = append(args, "RETENTION", options.Retention)
		}
		if options.ChunkSize != 0 {
			args = append(args, "CHUNK_SIZE", options.ChunkSize)
		}
		if options.Encoding != "" {
			args = append(args, "ENCODING", options.Encoding)
		}

		if options.DuplicatePolicy != "" {
			args = append(args, "DUPLICATE_POLICY", options.DuplicatePolicy)
		}
		if options.Labels != nil {
			args = append(args, "LABELS")
			for label, value := range options.Labels {
				args = append(args, label, value)
			}
		}
		if options.IgnoreMaxTimeDiff != 0 || options.IgnoreMaxValDiff != 0 {
			args = append(args, "IGNORE", options.IgnoreMaxTimeDiff, options.IgnoreMaxValDiff)
		}
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSCreate - Creates a new time-series key.
// For more information - https://redis.io/commands/ts.create/
func (c cmdable) TSCreate(ctx context.Context, key string) *StatusCmd {
	args := []interface{}{"TS.CREATE", key}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSCreateWithArgs - Creates a new time-series key with additional options.
// This function allows for specifying additional options such as:
// Retention, ChunkSize, Encoding, DuplicatePolicy and Labels.
// For more information - https://redis.io/commands/ts.create/
func (c cmdable) TSCreateWithArgs(ctx context.Context, key string, options *TSOptions) *StatusCmd {
	args := []interface{}{"TS.CREATE", key}
	if options != nil {
		if options.Retention != 0 {
			args = append(args, "RETENTION", options.Retention)
		}
		if options.ChunkSize != 0 {
			args = append(args, "CHUNK_SIZE", options.ChunkSize)
		}
		if options.Encoding != "" {
			args = append(args, "ENCODING", options.Encoding)
		}

		if options.DuplicatePolicy != "" {
			args = append(args, "DUPLICATE_POLICY", options.DuplicatePolicy)
		}
		if options.Labels != nil {
			args = append(args, "LABELS")
			for label, value := range options.Labels {
				args = append(args, label, value)
			}
		}
		if options.IgnoreMaxTimeDiff != 0 || options.IgnoreMaxValDiff != 0 {
			args = append(args, "IGNORE", options.IgnoreMaxTimeDiff, options.IgnoreMaxValDiff)
		}
	}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSAlter - Alters an existing time-series key with additional options.
// This function allows for specifying additional options such as:
// Retention, ChunkSize and DuplicatePolicy.
// For more information - https://redis.io/commands/ts.alter/
func (c cmdable) TSAlter(ctx context.Context, key string, options *TSAlterOptions) *StatusCmd {
	args := []interface{}{"TS.ALTER", key}
	if options != nil {
		if options.Retention != 0 {
			args = append(args, "RETENTION", options.Retention)
		}
		if options.ChunkSize != 0 {
			args = append(args, "CHUNK_SIZE", options.ChunkSize)
		}
		if options.DuplicatePolicy != "" {
			args = append(args, "DUPLICATE_POLICY", options.DuplicatePolicy)
		}
		if options.Labels != nil {
			args = append(args, "LABELS")
			for label, value := range options.Labels {
				args = append(args, label, value)
			}
		}
		if options.IgnoreMaxTimeDiff != 0 || options.IgnoreMaxValDiff != 0 {
			args = append(args, "IGNORE", options.IgnoreMaxTimeDiff, options.IgnoreMaxValDiff)
		}
	}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSCreateRule - Creates a compaction rule from sourceKey to destKey.
// For more information - https://redis.io/commands/ts.createrule/
func (c cmdable) TSCreateRule(ctx context.Context, sourceKey string, destKey string, aggregator Aggregator, bucketDuration int) *StatusCmd {
	args := []interface{}{"TS.CREATERULE", sourceKey, destKey, "AGGREGATION", aggregator.String(), bucketDuration}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSCreateRuleWithArgs - Creates a compaction rule from sourceKey to destKey with additional option.
// This function allows for specifying additional option such as:
// alignTimestamp.
// For more information - https://redis.io/commands/ts.createrule/
func (c cmdable) TSCreateRuleWithArgs(ctx context.Context, sourceKey string, destKey string, aggregator Aggregator, bucketDuration int, options *TSCreateRuleOptions) *StatusCmd {
	args := []interface{}{"TS.CREATERULE", sourceKey, destKey, "AGGREGATION", aggregator.String(), bucketDuration}
	if options != nil {
		if options.alignTimestamp != 0 {
			args = append(args, options.alignTimestamp)
		}
	}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSIncrBy - Increments the value of a time-series key by the specified timestamp.
// For more information - https://redis.io/commands/ts.incrby/
func (c cmdable) TSIncrBy(ctx context.Context, Key string, timestamp float64) *IntCmd {
	args := []interface{}{"TS.INCRBY", Key, timestamp}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSIncrByWithArgs - Increments the value of a time-series key by the specified timestamp with additional options.
// This function allows for specifying additional options such as:
// Timestamp, Retention, ChunkSize, Uncompressed and Labels.
// For more information - https://redis.io/commands/ts.incrby/
func (c cmdable) TSIncrByWithArgs(ctx context.Context, key string, timestamp float64, options *TSIncrDecrOptions) *IntCmd {
	args := []interface{}{"TS.INCRBY", key, timestamp}
	if options != nil {
		if options.Timestamp != 0 {
			args = append(args, "TIMESTAMP", options.Timestamp)
		}
		if options.Retention != 0 {
			args = append(args, "RETENTION", options.Retention)
		}
		if options.ChunkSize != 0 {
			args = append(args, "CHUNK_SIZE", options.ChunkSize)
		}
		if options.Uncompressed {
			args = append(args, "UNCOMPRESSED")
		}
		if options.DuplicatePolicy != "" {
			args = append(args, "DUPLICATE_POLICY", options.DuplicatePolicy)
		}
		if options.Labels != nil {
			args = append(args, "LABELS")
			for label, value := range options.Labels {
				args = append(args, label, value)
			}
		}
		if options.IgnoreMaxTimeDiff != 0 || options.IgnoreMaxValDiff != 0 {
			args = append(args, "IGNORE", options.IgnoreMaxTimeDiff, options.IgnoreMaxValDiff)
		}
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSDecrBy - Decrements the value of a time-series key by the specified timestamp.
// For more information - https://redis.io/commands/ts.decrby/
func (c cmdable) TSDecrBy(ctx context.Context, Key string, timestamp float64) *IntCmd {
	args := []interface{}{"TS.DECRBY", Key, timestamp}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSDecrByWithArgs - Decrements the value of a time-series key by the specified timestamp with additional options.
// This function allows for specifying additional options such as:
// Timestamp, Retention, ChunkSize, Uncompressed and Labels.
// For more information - https://redis.io/commands/ts.decrby/
func (c cmdable) TSDecrByWithArgs(ctx context.Context, key string, timestamp float64, options *TSIncrDecrOptions) *IntCmd {
	args := []interface{}{"TS.DECRBY", key, timestamp}
	if options != nil {
		if options.Timestamp != 0 {
			args = append(args, "TIMESTAMP", options.Timestamp)
		}
		if options.Retention != 0 {
			args = append(args, "RETENTION", options.Retention)
		}
		if options.ChunkSize != 0 {
			args = append(args, "CHUNK_SIZE", options.ChunkSize)
		}
		if options.Uncompressed {
			args = append(args, "UNCOMPRESSED")
		}
		if options.DuplicatePolicy != "" {
			args = append(args, "DUPLICATE_POLICY", options.DuplicatePolicy)
		}
		if options.Labels != nil {
			args = append(args, "LABELS")
			for label, value := range options.Labels {
				args = append(args, label, value)
			}
		}
		if options.IgnoreMaxTimeDiff != 0 || options.IgnoreMaxValDiff != 0 {
			args = append(args, "IGNORE", options.IgnoreMaxTimeDiff, options.IgnoreMaxValDiff)
		}
	}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSDel - Deletes a range of samples from a time-series key.
// For more information - https://redis.io/commands/ts.del/
func (c cmdable) TSDel(ctx context.Context, Key string, fromTimestamp int, toTimestamp int) *IntCmd {
	args := []interface{}{"TS.DEL", Key, fromTimestamp, toTimestamp}
	cmd := NewIntCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSDeleteRule - Deletes a compaction rule from sourceKey to destKey.
// For more information - https://redis.io/commands/ts.deleterule/
func (c cmdable) TSDeleteRule(ctx context.Context, sourceKey string, destKey string) *StatusCmd {
	args := []interface{}{"TS.DELETERULE", sourceKey, destKey}
	cmd := NewStatusCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSGetWithArgs - Gets the last sample of a time-series key with additional option.
// This function allows for specifying additional option such as:
// Latest.
// For more information - https://redis.io/commands/ts.get/
func (c cmdable) TSGetWithArgs(ctx context.Context, key string, options *TSGetOptions) *TSTimestampValueCmd {
	args := []interface{}{"TS.GET", key}
	if options != nil {
		if options.Latest {
			args = append(args, "LATEST")
		}
	}
	cmd := newTSTimestampValueCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSGet - Gets the last sample of a time-series key.
// For more information - https://redis.io/commands/ts.get/
func (c cmdable) TSGet(ctx context.Context, key string) *TSTimestampValueCmd {
	args := []interface{}{"TS.GET", key}
	cmd := newTSTimestampValueCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

type TSTimestampValue struct {
	Timestamp int64
	Value     float64
}
type TSTimestampValueCmd struct {
	baseCmd
	val TSTimestampValue
}

func newTSTimestampValueCmd(ctx context.Context, args ...interface{}) *TSTimestampValueCmd {
	return &TSTimestampValueCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *TSTimestampValueCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *TSTimestampValueCmd) SetVal(val TSTimestampValue) {
	cmd.val = val
}

func (cmd *TSTimestampValueCmd) Result() (TSTimestampValue, error) {
	return cmd.val, cmd.err
}

func (cmd *TSTimestampValueCmd) Val() TSTimestampValue {
	return cmd.val
}

func (cmd *TSTimestampValueCmd) readReply(rd *proto.Reader) (err error) {
	n, err := rd.ReadMapLen()
	if err != nil {
		return err
	}
	cmd.val = TSTimestampValue{}
	for i := 0; i < n; i++ {
		timestamp, err := rd.ReadInt()
		if err != nil {
			return err
		}
		value, err := rd.ReadString()
		if err != nil {
			return err
		}
		cmd.val.Timestamp = timestamp
		cmd.val.Value, err = strconv.ParseFloat(value, 64)
		if err != nil {
			return err
		}
	}

	return nil
}

// TSInfo - Returns information about a time-series key.
// For more information - https://redis.io/commands/ts.info/
func (c cmdable) TSInfo(ctx context.Context, key string) *MapStringInterfaceCmd {
	args := []interface{}{"TS.INFO", key}
	cmd := NewMapStringInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSInfoWithArgs - Returns information about a time-series key with additional option.
// This function allows for specifying additional option such as:
// Debug.
// For more information - https://redis.io/commands/ts.info/
func (c cmdable) TSInfoWithArgs(ctx context.Context, key string, options *TSInfoOptions) *MapStringInterfaceCmd {
	args := []interface{}{"TS.INFO", key}
	if options != nil {
		if options.Debug {
			args = append(args, "DEBUG")
		}
	}
	cmd := NewMapStringInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSMAdd - Adds multiple samples to multiple time-series keys.
// It accepts a slice of 'ktv' slices, each containing exactly three elements: key, timestamp, and value.
// This struct must be provided for this command to work.
// For more information - https://redis.io/commands/ts.madd/
func (c cmdable) TSMAdd(ctx context.Context, ktvSlices [][]interface{}) *IntSliceCmd {
	args := []interface{}{"TS.MADD"}
	for _, ktv := range ktvSlices {
		args = append(args, ktv...)
	}
	cmd := NewIntSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSQueryIndex - Returns all the keys matching the filter expression.
// For more information - https://redis.io/commands/ts.queryindex/
func (c cmdable) TSQueryIndex(ctx context.Context, filterExpr []string) *StringSliceCmd {
	args := []interface{}{"TS.QUERYINDEX"}
	for _, f := range filterExpr {
		args = append(args, f)
	}
	cmd := NewStringSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSRevRange - Returns a range of samples from a time-series key in reverse order.
// For more information - https://redis.io/commands/ts.revrange/
func (c cmdable) TSRevRange(ctx context.Context, key string, fromTimestamp int, toTimestamp int) *TSTimestampValueSliceCmd {
	args := []interface{}{"TS.REVRANGE", key, fromTimestamp, toTimestamp}
	cmd := newTSTimestampValueSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSRevRangeWithArgs - Returns a range of samples from a time-series key in reverse order with additional options.
// This function allows for specifying additional options such as:
// Latest, FilterByTS, FilterByValue, Count, Align, Aggregator,
// BucketDuration, BucketTimestamp and Empty.
// For more information - https://redis.io/commands/ts.revrange/
func (c cmdable) TSRevRangeWithArgs(ctx context.Context, key string, fromTimestamp int, toTimestamp int, options *TSRevRangeOptions) *TSTimestampValueSliceCmd {
	args := []interface{}{"TS.REVRANGE", key, fromTimestamp, toTimestamp}
	if options != nil {
		if options.Latest {
			args = append(args, "LATEST")
		}
		if options.FilterByTS != nil {
			args = append(args, "FILTER_BY_TS")
			for _, f := range options.FilterByTS {
				args = append(args, f)
			}
		}
		if options.FilterByValue != nil {
			args = append(args, "FILTER_BY_VALUE")
			for _, f := range options.FilterByValue {
				args = append(args, f)
			}
		}
		if options.Count != 0 {
			args = append(args, "COUNT", options.Count)
		}
		if options.Align != nil {
			args = append(args, "ALIGN", options.Align)
		}
		if options.Aggregator != 0 {
			args = append(args, "AGGREGATION", options.Aggregator.String())
		}
		if options.BucketDuration != 0 {
			args = append(args, options.BucketDuration)
		}
		if options.BucketTimestamp != nil {
			args = append(args, "BUCKETTIMESTAMP", options.BucketTimestamp)
		}
		if options.Empty {
			args = append(args, "EMPTY")
		}
	}
	cmd := newTSTimestampValueSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSRange - Returns a range of samples from a time-series key.
// For more information - https://redis.io/commands/ts.range/
func (c cmdable) TSRange(ctx context.Context, key string, fromTimestamp int, toTimestamp int) *TSTimestampValueSliceCmd {
	args := []interface{}{"TS.RANGE", key, fromTimestamp, toTimestamp}
	cmd := newTSTimestampValueSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSRangeWithArgs - Returns a range of samples from a time-series key with additional options.
// This function allows for specifying additional options such as:
// Latest, FilterByTS, FilterByValue, Count, Align, Aggregator,
// BucketDuration, BucketTimestamp and Empty.
// For more information - https://redis.io/commands/ts.range/
func (c cmdable) TSRangeWithArgs(ctx context.Context, key string, fromTimestamp int, toTimestamp int, options *TSRangeOptions) *TSTimestampValueSliceCmd {
	args := []interface{}{"TS.RANGE", key, fromTimestamp, toTimestamp}
	if options != nil {
		if options.Latest {
			args = append(args, "LATEST")
		}
		if options.FilterByTS != nil {
			args = append(args, "FILTER_BY_TS")
			for _, f := range options.FilterByTS {
				args = append(args, f)
			}
		}
		if options.FilterByValue != nil {
			args = append(args, "FILTER_BY_VALUE")
			for _, f := range options.FilterByValue {
				args = append(args, f)
			}
		}
		if options.Count != 0 {
			args = append(args, "COUNT", options.Count)
		}
		if options.Align != nil {
			args = append(args, "ALIGN", options.Align)
		}
		if options.Aggregator != 0 {
			args = append(args, "AGGREGATION", options.Aggregator.String())
		}
		if options.BucketDuration != 0 {
			args = append(args, options.BucketDuration)
		}
		if options.BucketTimestamp != nil {
			args = append(args, "BUCKETTIMESTAMP", options.BucketTimestamp)
		}
		if options.Empty {
			args = append(args, "EMPTY")
		}
	}
	cmd := newTSTimestampValueSliceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

type TSTimestampValueSliceCmd struct {
	baseCmd
	val []TSTimestampValue
}

func newTSTimestampValueSliceCmd(ctx context.Context, args ...interface{}) *TSTimestampValueSliceCmd {
	return &TSTimestampValueSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *TSTimestampValueSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *TSTimestampValueSliceCmd) SetVal(val []TSTimestampValue) {
	cmd.val = val
}

func (cmd *TSTimestampValueSliceCmd) Result() ([]TSTimestampValue, error) {
	return cmd.val, cmd.err
}

func (cmd *TSTimestampValueSliceCmd) Val() []TSTimestampValue {
	return cmd.val
}

func (cmd *TSTimestampValueSliceCmd) readReply(rd *proto.Reader) (err error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]TSTimestampValue, n)
	for i := 0; i < n; i++ {
		_, _ = rd.ReadArrayLen()
		timestamp, err := rd.ReadInt()
		if err != nil {
			return err
		}
		value, err := rd.ReadString()
		if err != nil {
			return err
		}
		cmd.val[i].Timestamp = timestamp
		cmd.val[i].Value, err = strconv.ParseFloat(value, 64)
		if err != nil {
			return err
		}
	}

	return nil
}

// TSMRange - Returns a range of samples from multiple time-series keys.
// For more information - https://redis.io/commands/ts.mrange/
func (c cmdable) TSMRange(ctx context.Context, fromTimestamp int, toTimestamp int, filterExpr []string) *MapStringSliceInterfaceCmd {
	args := []interface{}{"TS.MRANGE", fromTimestamp, toTimestamp, "FILTER"}
	for _, f := range filterExpr {
		args = append(args, f)
	}
	cmd := NewMapStringSliceInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSMRangeWithArgs - Returns a range of samples from multiple time-series keys with additional options.
// This function allows for specifying additional options such as:
// Latest, FilterByTS, FilterByValue, WithLabels, SelectedLabels,
// Count, Align, Aggregator, BucketDuration, BucketTimestamp,
// Empty, GroupByLabel and Reducer.
// For more information - https://redis.io/commands/ts.mrange/
func (c cmdable) TSMRangeWithArgs(ctx context.Context, fromTimestamp int, toTimestamp int, filterExpr []string, options *TSMRangeOptions) *MapStringSliceInterfaceCmd {
	args := []interface{}{"TS.MRANGE", fromTimestamp, toTimestamp}
	if options != nil {
		if options.Latest {
			args = append(args, "LATEST")
		}
		if options.FilterByTS != nil {
			args = append(args, "FILTER_BY_TS")
			for _, f := range options.FilterByTS {
				args = append(args, f)
			}
		}
		if options.FilterByValue != nil {
			args = append(args, "FILTER_BY_VALUE")
			for _, f := range options.FilterByValue {
				args = append(args, f)
			}
		}
		if options.WithLabels {
			args = append(args, "WITHLABELS")
		}
		if options.SelectedLabels != nil {
			args = append(args, "SELECTED_LABELS")
			args = append(args, options.SelectedLabels...)
		}
		if options.Count != 0 {
			args = append(args, "COUNT", options.Count)
		}
		if options.Align != nil {
			args = append(args, "ALIGN", options.Align)
		}
		if options.Aggregator != 0 {
			args = append(args, "AGGREGATION", options.Aggregator.String())
		}
		if options.BucketDuration != 0 {
			args = append(args, options.BucketDuration)
		}
		if options.BucketTimestamp != nil {
			args = append(args, "BUCKETTIMESTAMP", options.BucketTimestamp)
		}
		if options.Empty {
			args = append(args, "EMPTY")
		}
	}
	args = append(args, "FILTER")
	for _, f := range filterExpr {
		args = append(args, f)
	}
	if options != nil {
		if options.GroupByLabel != nil {
			args = append(args, "GROUPBY", options.GroupByLabel)
		}
		if options.Reducer != nil {
			args = append(args, "REDUCE", options.Reducer)
		}
	}
	cmd := NewMapStringSliceInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSMRevRange - Returns a range of samples from multiple time-series keys in reverse order.
// For more information - https://redis.io/commands/ts.mrevrange/
func (c cmdable) TSMRevRange(ctx context.Context, fromTimestamp int, toTimestamp int, filterExpr []string) *MapStringSliceInterfaceCmd {
	args := []interface{}{"TS.MREVRANGE", fromTimestamp, toTimestamp, "FILTER"}
	for _, f := range filterExpr {
		args = append(args, f)
	}
	cmd := NewMapStringSliceInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSMRevRangeWithArgs - Returns a range of samples from multiple time-series keys in reverse order with additional options.
// This function allows for specifying additional options such as:
// Latest, FilterByTS, FilterByValue, WithLabels, SelectedLabels,
// Count, Align, Aggregator, BucketDuration, BucketTimestamp,
// Empty, GroupByLabel and Reducer.
// For more information - https://redis.io/commands/ts.mrevrange/
func (c cmdable) TSMRevRangeWithArgs(ctx context.Context, fromTimestamp int, toTimestamp int, filterExpr []string, options *TSMRevRangeOptions) *MapStringSliceInterfaceCmd {
	args := []interface{}{"TS.MREVRANGE", fromTimestamp, toTimestamp}
	if options != nil {
		if options.Latest {
			args = append(args, "LATEST")
		}
		if options.FilterByTS != nil {
			args = append(args, "FILTER_BY_TS")
			for _, f := range options.FilterByTS {
				args = append(args, f)
			}
		}
		if options.FilterByValue != nil {
			args = append(args, "FILTER_BY_VALUE")
			for _, f := range options.FilterByValue {
				args = append(args, f)
			}
		}
		if options.WithLabels {
			args = append(args, "WITHLABELS")
		}
		if options.SelectedLabels != nil {
			args = append(args, "SELECTED_LABELS")
			args = append(args, options.SelectedLabels...)
		}
		if options.Count != 0 {
			args = append(args, "COUNT", options.Count)
		}
		if options.Align != nil {
			args = append(args, "ALIGN", options.Align)
		}
		if options.Aggregator != 0 {
			args = append(args, "AGGREGATION", options.Aggregator.String())
		}
		if options.BucketDuration != 0 {
			args = append(args, options.BucketDuration)
		}
		if options.BucketTimestamp != nil {
			args = append(args, "BUCKETTIMESTAMP", options.BucketTimestamp)
		}
		if options.Empty {
			args = append(args, "EMPTY")
		}
	}
	args = append(args, "FILTER")
	for _, f := range filterExpr {
		args = append(args, f)
	}
	if options != nil {
		if options.GroupByLabel != nil {
			args = append(args, "GROUPBY", options.GroupByLabel)
		}
		if options.Reducer != nil {
			args = append(args, "REDUCE", options.Reducer)
		}
	}
	cmd := NewMapStringSliceInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSMGet - Returns the last sample of multiple time-series keys.
// For more information - https://redis.io/commands/ts.mget/
func (c cmdable) TSMGet(ctx context.Context, filters []string) *MapStringSliceInterfaceCmd {
	args := []interface{}{"TS.MGET", "FILTER"}
	for _, f := range filters {
		args = append(args, f)
	}
	cmd := NewMapStringSliceInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}

// TSMGetWithArgs - Returns the last sample of multiple time-series keys with additional options.
// This function allows for specifying additional options such as:
// Latest, WithLabels and SelectedLabels.
// For more information - https://redis.io/commands/ts.mget/
func (c cmdable) TSMGetWithArgs(ctx context.Context, filters []string, options *TSMGetOptions) *MapStringSliceInterfaceCmd {
	args := []interface{}{"TS.MGET"}
	if options != nil {
		if options.Latest {
			args = append(args, "LATEST")
		}
		if options.WithLabels {
			args = append(args, "WITHLABELS")
		}
		if options.SelectedLabels != nil {
			args = append(args, "SELECTED_LABELS")
			args = append(args, options.SelectedLabels...)
		}
	}
	args = append(args, "FILTER")
	for _, f := range filters {
		args = append(args, f)
	}
	cmd := NewMapStringSliceInterfaceCmd(ctx, args...)
	_ = c(ctx, cmd)
	return cmd
}
