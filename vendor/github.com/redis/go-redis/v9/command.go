package redis

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9/internal"
	"github.com/redis/go-redis/v9/internal/hscan"
	"github.com/redis/go-redis/v9/internal/proto"
	"github.com/redis/go-redis/v9/internal/util"
)

type Cmder interface {
	// command name.
	// e.g. "set k v ex 10" -> "set", "cluster info" -> "cluster".
	Name() string

	// full command name.
	// e.g. "set k v ex 10" -> "set", "cluster info" -> "cluster info".
	FullName() string

	// all args of the command.
	// e.g. "set k v ex 10" -> "[set k v ex 10]".
	Args() []interface{}

	// format request and response string.
	// e.g. "set k v ex 10" -> "set k v ex 10: OK", "get k" -> "get k: v".
	String() string

	stringArg(int) string
	firstKeyPos() int8
	SetFirstKeyPos(int8)

	readTimeout() *time.Duration
	readReply(rd *proto.Reader) error
	readRawReply(rd *proto.Reader) error
	SetErr(error)
	Err() error
}

func setCmdsErr(cmds []Cmder, e error) {
	for _, cmd := range cmds {
		if cmd.Err() == nil {
			cmd.SetErr(e)
		}
	}
}

func cmdsFirstErr(cmds []Cmder) error {
	for _, cmd := range cmds {
		if err := cmd.Err(); err != nil {
			return err
		}
	}
	return nil
}

func writeCmds(wr *proto.Writer, cmds []Cmder) error {
	for _, cmd := range cmds {
		if err := writeCmd(wr, cmd); err != nil {
			return err
		}
	}
	return nil
}

func writeCmd(wr *proto.Writer, cmd Cmder) error {
	return wr.WriteArgs(cmd.Args())
}

func cmdFirstKeyPos(cmd Cmder) int {
	if pos := cmd.firstKeyPos(); pos != 0 {
		return int(pos)
	}

	switch cmd.Name() {
	case "eval", "evalsha", "eval_ro", "evalsha_ro":
		if cmd.stringArg(2) != "0" {
			return 3
		}

		return 0
	case "publish":
		return 1
	case "memory":
		// https://github.com/redis/redis/issues/7493
		if cmd.stringArg(1) == "usage" {
			return 2
		}
	}
	return 1
}

func cmdString(cmd Cmder, val interface{}) string {
	b := make([]byte, 0, 64)

	for i, arg := range cmd.Args() {
		if i > 0 {
			b = append(b, ' ')
		}
		b = internal.AppendArg(b, arg)
	}

	if err := cmd.Err(); err != nil {
		b = append(b, ": "...)
		b = append(b, err.Error()...)
	} else if val != nil {
		b = append(b, ": "...)
		b = internal.AppendArg(b, val)
	}

	return util.BytesToString(b)
}

//------------------------------------------------------------------------------

type baseCmd struct {
	ctx          context.Context
	args         []interface{}
	err          error
	keyPos       int8
	rawVal       interface{}
	_readTimeout *time.Duration
}

var _ Cmder = (*Cmd)(nil)

func (cmd *baseCmd) Name() string {
	if len(cmd.args) == 0 {
		return ""
	}
	// Cmd name must be lower cased.
	return internal.ToLower(cmd.stringArg(0))
}

func (cmd *baseCmd) FullName() string {
	switch name := cmd.Name(); name {
	case "cluster", "command":
		if len(cmd.args) == 1 {
			return name
		}
		if s2, ok := cmd.args[1].(string); ok {
			return name + " " + s2
		}
		return name
	default:
		return name
	}
}

func (cmd *baseCmd) Args() []interface{} {
	return cmd.args
}

func (cmd *baseCmd) stringArg(pos int) string {
	if pos < 0 || pos >= len(cmd.args) {
		return ""
	}
	arg := cmd.args[pos]
	switch v := arg.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		// TODO: consider using appendArg
		return fmt.Sprint(v)
	}
}

func (cmd *baseCmd) firstKeyPos() int8 {
	return cmd.keyPos
}

func (cmd *baseCmd) SetFirstKeyPos(keyPos int8) {
	cmd.keyPos = keyPos
}

func (cmd *baseCmd) SetErr(e error) {
	cmd.err = e
}

func (cmd *baseCmd) Err() error {
	return cmd.err
}

func (cmd *baseCmd) readTimeout() *time.Duration {
	return cmd._readTimeout
}

func (cmd *baseCmd) setReadTimeout(d time.Duration) {
	cmd._readTimeout = &d
}

func (cmd *baseCmd) readRawReply(rd *proto.Reader) (err error) {
	cmd.rawVal, err = rd.ReadReply()
	return err
}

//------------------------------------------------------------------------------

type Cmd struct {
	baseCmd

	val interface{}
}

func NewCmd(ctx context.Context, args ...interface{}) *Cmd {
	return &Cmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *Cmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *Cmd) SetVal(val interface{}) {
	cmd.val = val
}

func (cmd *Cmd) Val() interface{} {
	return cmd.val
}

func (cmd *Cmd) Result() (interface{}, error) {
	return cmd.val, cmd.err
}

func (cmd *Cmd) Text() (string, error) {
	if cmd.err != nil {
		return "", cmd.err
	}
	return toString(cmd.val)
}

func toString(val interface{}) (string, error) {
	switch val := val.(type) {
	case string:
		return val, nil
	default:
		err := fmt.Errorf("redis: unexpected type=%T for String", val)
		return "", err
	}
}

func (cmd *Cmd) Int() (int, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	switch val := cmd.val.(type) {
	case int64:
		return int(val), nil
	case string:
		return strconv.Atoi(val)
	default:
		err := fmt.Errorf("redis: unexpected type=%T for Int", val)
		return 0, err
	}
}

func (cmd *Cmd) Int64() (int64, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return toInt64(cmd.val)
}

func toInt64(val interface{}) (int64, error) {
	switch val := val.(type) {
	case int64:
		return val, nil
	case string:
		return strconv.ParseInt(val, 10, 64)
	default:
		err := fmt.Errorf("redis: unexpected type=%T for Int64", val)
		return 0, err
	}
}

func (cmd *Cmd) Uint64() (uint64, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return toUint64(cmd.val)
}

func toUint64(val interface{}) (uint64, error) {
	switch val := val.(type) {
	case int64:
		return uint64(val), nil
	case string:
		return strconv.ParseUint(val, 10, 64)
	default:
		err := fmt.Errorf("redis: unexpected type=%T for Uint64", val)
		return 0, err
	}
}

func (cmd *Cmd) Float32() (float32, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return toFloat32(cmd.val)
}

func toFloat32(val interface{}) (float32, error) {
	switch val := val.(type) {
	case int64:
		return float32(val), nil
	case string:
		f, err := strconv.ParseFloat(val, 32)
		if err != nil {
			return 0, err
		}
		return float32(f), nil
	default:
		err := fmt.Errorf("redis: unexpected type=%T for Float32", val)
		return 0, err
	}
}

func (cmd *Cmd) Float64() (float64, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return toFloat64(cmd.val)
}

func toFloat64(val interface{}) (float64, error) {
	switch val := val.(type) {
	case int64:
		return float64(val), nil
	case string:
		return strconv.ParseFloat(val, 64)
	default:
		err := fmt.Errorf("redis: unexpected type=%T for Float64", val)
		return 0, err
	}
}

func (cmd *Cmd) Bool() (bool, error) {
	if cmd.err != nil {
		return false, cmd.err
	}
	return toBool(cmd.val)
}

func toBool(val interface{}) (bool, error) {
	switch val := val.(type) {
	case bool:
		return val, nil
	case int64:
		return val != 0, nil
	case string:
		return strconv.ParseBool(val)
	default:
		err := fmt.Errorf("redis: unexpected type=%T for Bool", val)
		return false, err
	}
}

func (cmd *Cmd) Slice() ([]interface{}, error) {
	if cmd.err != nil {
		return nil, cmd.err
	}
	switch val := cmd.val.(type) {
	case []interface{}:
		return val, nil
	default:
		return nil, fmt.Errorf("redis: unexpected type=%T for Slice", val)
	}
}

func (cmd *Cmd) StringSlice() ([]string, error) {
	slice, err := cmd.Slice()
	if err != nil {
		return nil, err
	}

	ss := make([]string, len(slice))
	for i, iface := range slice {
		val, err := toString(iface)
		if err != nil {
			return nil, err
		}
		ss[i] = val
	}
	return ss, nil
}

func (cmd *Cmd) Int64Slice() ([]int64, error) {
	slice, err := cmd.Slice()
	if err != nil {
		return nil, err
	}

	nums := make([]int64, len(slice))
	for i, iface := range slice {
		val, err := toInt64(iface)
		if err != nil {
			return nil, err
		}
		nums[i] = val
	}
	return nums, nil
}

func (cmd *Cmd) Uint64Slice() ([]uint64, error) {
	slice, err := cmd.Slice()
	if err != nil {
		return nil, err
	}

	nums := make([]uint64, len(slice))
	for i, iface := range slice {
		val, err := toUint64(iface)
		if err != nil {
			return nil, err
		}
		nums[i] = val
	}
	return nums, nil
}

func (cmd *Cmd) Float32Slice() ([]float32, error) {
	slice, err := cmd.Slice()
	if err != nil {
		return nil, err
	}

	floats := make([]float32, len(slice))
	for i, iface := range slice {
		val, err := toFloat32(iface)
		if err != nil {
			return nil, err
		}
		floats[i] = val
	}
	return floats, nil
}

func (cmd *Cmd) Float64Slice() ([]float64, error) {
	slice, err := cmd.Slice()
	if err != nil {
		return nil, err
	}

	floats := make([]float64, len(slice))
	for i, iface := range slice {
		val, err := toFloat64(iface)
		if err != nil {
			return nil, err
		}
		floats[i] = val
	}
	return floats, nil
}

func (cmd *Cmd) BoolSlice() ([]bool, error) {
	slice, err := cmd.Slice()
	if err != nil {
		return nil, err
	}

	bools := make([]bool, len(slice))
	for i, iface := range slice {
		val, err := toBool(iface)
		if err != nil {
			return nil, err
		}
		bools[i] = val
	}
	return bools, nil
}

func (cmd *Cmd) readReply(rd *proto.Reader) (err error) {
	cmd.val, err = rd.ReadReply()
	return err
}

//------------------------------------------------------------------------------

type SliceCmd struct {
	baseCmd

	val []interface{}
}

var _ Cmder = (*SliceCmd)(nil)

func NewSliceCmd(ctx context.Context, args ...interface{}) *SliceCmd {
	return &SliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *SliceCmd) SetVal(val []interface{}) {
	cmd.val = val
}

func (cmd *SliceCmd) Val() []interface{} {
	return cmd.val
}

func (cmd *SliceCmd) Result() ([]interface{}, error) {
	return cmd.val, cmd.err
}

func (cmd *SliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

// Scan scans the results from the map into a destination struct. The map keys
// are matched in the Redis struct fields by the `redis:"field"` tag.
func (cmd *SliceCmd) Scan(dst interface{}) error {
	if cmd.err != nil {
		return cmd.err
	}

	// Pass the list of keys and values.
	// Skip the first two args for: HMGET key
	var args []interface{}
	if cmd.args[0] == "hmget" {
		args = cmd.args[2:]
	} else {
		// Otherwise, it's: MGET field field ...
		args = cmd.args[1:]
	}

	return hscan.Scan(dst, args, cmd.val)
}

func (cmd *SliceCmd) readReply(rd *proto.Reader) (err error) {
	cmd.val, err = rd.ReadSlice()
	return err
}

//------------------------------------------------------------------------------

type StatusCmd struct {
	baseCmd

	val string
}

var _ Cmder = (*StatusCmd)(nil)

func NewStatusCmd(ctx context.Context, args ...interface{}) *StatusCmd {
	return &StatusCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *StatusCmd) SetVal(val string) {
	cmd.val = val
}

func (cmd *StatusCmd) Val() string {
	return cmd.val
}

func (cmd *StatusCmd) Result() (string, error) {
	return cmd.val, cmd.err
}

func (cmd *StatusCmd) Bytes() ([]byte, error) {
	return util.StringToBytes(cmd.val), cmd.err
}

func (cmd *StatusCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *StatusCmd) readReply(rd *proto.Reader) (err error) {
	cmd.val, err = rd.ReadString()
	return err
}

//------------------------------------------------------------------------------

type IntCmd struct {
	baseCmd

	val int64
}

var _ Cmder = (*IntCmd)(nil)

func NewIntCmd(ctx context.Context, args ...interface{}) *IntCmd {
	return &IntCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *IntCmd) SetVal(val int64) {
	cmd.val = val
}

func (cmd *IntCmd) Val() int64 {
	return cmd.val
}

func (cmd *IntCmd) Result() (int64, error) {
	return cmd.val, cmd.err
}

func (cmd *IntCmd) Uint64() (uint64, error) {
	return uint64(cmd.val), cmd.err
}

func (cmd *IntCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *IntCmd) readReply(rd *proto.Reader) (err error) {
	cmd.val, err = rd.ReadInt()
	return err
}

//------------------------------------------------------------------------------

type IntSliceCmd struct {
	baseCmd

	val []int64
}

var _ Cmder = (*IntSliceCmd)(nil)

func NewIntSliceCmd(ctx context.Context, args ...interface{}) *IntSliceCmd {
	return &IntSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *IntSliceCmd) SetVal(val []int64) {
	cmd.val = val
}

func (cmd *IntSliceCmd) Val() []int64 {
	return cmd.val
}

func (cmd *IntSliceCmd) Result() ([]int64, error) {
	return cmd.val, cmd.err
}

func (cmd *IntSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *IntSliceCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]int64, n)
	for i := 0; i < len(cmd.val); i++ {
		if cmd.val[i], err = rd.ReadInt(); err != nil {
			return err
		}
	}
	return nil
}

//------------------------------------------------------------------------------

type DurationCmd struct {
	baseCmd

	val       time.Duration
	precision time.Duration
}

var _ Cmder = (*DurationCmd)(nil)

func NewDurationCmd(ctx context.Context, precision time.Duration, args ...interface{}) *DurationCmd {
	return &DurationCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
		precision: precision,
	}
}

func (cmd *DurationCmd) SetVal(val time.Duration) {
	cmd.val = val
}

func (cmd *DurationCmd) Val() time.Duration {
	return cmd.val
}

func (cmd *DurationCmd) Result() (time.Duration, error) {
	return cmd.val, cmd.err
}

func (cmd *DurationCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *DurationCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadInt()
	if err != nil {
		return err
	}
	switch n {
	// -2 if the key does not exist
	// -1 if the key exists but has no associated expire
	case -2, -1:
		cmd.val = time.Duration(n)
	default:
		cmd.val = time.Duration(n) * cmd.precision
	}
	return nil
}

//------------------------------------------------------------------------------

type TimeCmd struct {
	baseCmd

	val time.Time
}

var _ Cmder = (*TimeCmd)(nil)

func NewTimeCmd(ctx context.Context, args ...interface{}) *TimeCmd {
	return &TimeCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *TimeCmd) SetVal(val time.Time) {
	cmd.val = val
}

func (cmd *TimeCmd) Val() time.Time {
	return cmd.val
}

func (cmd *TimeCmd) Result() (time.Time, error) {
	return cmd.val, cmd.err
}

func (cmd *TimeCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *TimeCmd) readReply(rd *proto.Reader) error {
	if err := rd.ReadFixedArrayLen(2); err != nil {
		return err
	}
	second, err := rd.ReadInt()
	if err != nil {
		return err
	}
	microsecond, err := rd.ReadInt()
	if err != nil {
		return err
	}
	cmd.val = time.Unix(second, microsecond*1000)
	return nil
}

//------------------------------------------------------------------------------

type BoolCmd struct {
	baseCmd

	val bool
}

var _ Cmder = (*BoolCmd)(nil)

func NewBoolCmd(ctx context.Context, args ...interface{}) *BoolCmd {
	return &BoolCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *BoolCmd) SetVal(val bool) {
	cmd.val = val
}

func (cmd *BoolCmd) Val() bool {
	return cmd.val
}

func (cmd *BoolCmd) Result() (bool, error) {
	return cmd.val, cmd.err
}

func (cmd *BoolCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *BoolCmd) readReply(rd *proto.Reader) (err error) {
	cmd.val, err = rd.ReadBool()

	// `SET key value NX` returns nil when key already exists. But
	// `SETNX key value` returns bool (0/1). So convert nil to bool.
	if err == Nil {
		cmd.val = false
		err = nil
	}
	return err
}

//------------------------------------------------------------------------------

type StringCmd struct {
	baseCmd

	val string
}

var _ Cmder = (*StringCmd)(nil)

func NewStringCmd(ctx context.Context, args ...interface{}) *StringCmd {
	return &StringCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *StringCmd) SetVal(val string) {
	cmd.val = val
}

func (cmd *StringCmd) Val() string {
	return cmd.val
}

func (cmd *StringCmd) Result() (string, error) {
	return cmd.val, cmd.err
}

func (cmd *StringCmd) Bytes() ([]byte, error) {
	return util.StringToBytes(cmd.val), cmd.err
}

func (cmd *StringCmd) Bool() (bool, error) {
	if cmd.err != nil {
		return false, cmd.err
	}
	return strconv.ParseBool(cmd.val)
}

func (cmd *StringCmd) Int() (int, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return strconv.Atoi(cmd.Val())
}

func (cmd *StringCmd) Int64() (int64, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return strconv.ParseInt(cmd.Val(), 10, 64)
}

func (cmd *StringCmd) Uint64() (uint64, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return strconv.ParseUint(cmd.Val(), 10, 64)
}

func (cmd *StringCmd) Float32() (float32, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	f, err := strconv.ParseFloat(cmd.Val(), 32)
	if err != nil {
		return 0, err
	}
	return float32(f), nil
}

func (cmd *StringCmd) Float64() (float64, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return strconv.ParseFloat(cmd.Val(), 64)
}

func (cmd *StringCmd) Time() (time.Time, error) {
	if cmd.err != nil {
		return time.Time{}, cmd.err
	}
	return time.Parse(time.RFC3339Nano, cmd.Val())
}

func (cmd *StringCmd) Scan(val interface{}) error {
	if cmd.err != nil {
		return cmd.err
	}
	return proto.Scan([]byte(cmd.val), val)
}

func (cmd *StringCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *StringCmd) readReply(rd *proto.Reader) (err error) {
	cmd.val, err = rd.ReadString()
	return err
}

//------------------------------------------------------------------------------

type FloatCmd struct {
	baseCmd

	val float64
}

var _ Cmder = (*FloatCmd)(nil)

func NewFloatCmd(ctx context.Context, args ...interface{}) *FloatCmd {
	return &FloatCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *FloatCmd) SetVal(val float64) {
	cmd.val = val
}

func (cmd *FloatCmd) Val() float64 {
	return cmd.val
}

func (cmd *FloatCmd) Result() (float64, error) {
	return cmd.val, cmd.err
}

func (cmd *FloatCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *FloatCmd) readReply(rd *proto.Reader) (err error) {
	cmd.val, err = rd.ReadFloat()
	return err
}

//------------------------------------------------------------------------------

type FloatSliceCmd struct {
	baseCmd

	val []float64
}

var _ Cmder = (*FloatSliceCmd)(nil)

func NewFloatSliceCmd(ctx context.Context, args ...interface{}) *FloatSliceCmd {
	return &FloatSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *FloatSliceCmd) SetVal(val []float64) {
	cmd.val = val
}

func (cmd *FloatSliceCmd) Val() []float64 {
	return cmd.val
}

func (cmd *FloatSliceCmd) Result() ([]float64, error) {
	return cmd.val, cmd.err
}

func (cmd *FloatSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *FloatSliceCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	cmd.val = make([]float64, n)
	for i := 0; i < len(cmd.val); i++ {
		switch num, err := rd.ReadFloat(); {
		case err == Nil:
			cmd.val[i] = 0
		case err != nil:
			return err
		default:
			cmd.val[i] = num
		}
	}
	return nil
}

//------------------------------------------------------------------------------

type StringSliceCmd struct {
	baseCmd

	val []string
}

var _ Cmder = (*StringSliceCmd)(nil)

func NewStringSliceCmd(ctx context.Context, args ...interface{}) *StringSliceCmd {
	return &StringSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *StringSliceCmd) SetVal(val []string) {
	cmd.val = val
}

func (cmd *StringSliceCmd) Val() []string {
	return cmd.val
}

func (cmd *StringSliceCmd) Result() ([]string, error) {
	return cmd.val, cmd.err
}

func (cmd *StringSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *StringSliceCmd) ScanSlice(container interface{}) error {
	return proto.ScanSlice(cmd.Val(), container)
}

func (cmd *StringSliceCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]string, n)
	for i := 0; i < len(cmd.val); i++ {
		switch s, err := rd.ReadString(); {
		case err == Nil:
			cmd.val[i] = ""
		case err != nil:
			return err
		default:
			cmd.val[i] = s
		}
	}
	return nil
}

//------------------------------------------------------------------------------

type KeyValue struct {
	Key   string
	Value string
}

type KeyValueSliceCmd struct {
	baseCmd

	val []KeyValue
}

var _ Cmder = (*KeyValueSliceCmd)(nil)

func NewKeyValueSliceCmd(ctx context.Context, args ...interface{}) *KeyValueSliceCmd {
	return &KeyValueSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *KeyValueSliceCmd) SetVal(val []KeyValue) {
	cmd.val = val
}

func (cmd *KeyValueSliceCmd) Val() []KeyValue {
	return cmd.val
}

func (cmd *KeyValueSliceCmd) Result() ([]KeyValue, error) {
	return cmd.val, cmd.err
}

func (cmd *KeyValueSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

// Many commands will respond to two formats:
//  1. 1) "one"
//  2. (double) 1
//  2. 1) "two"
//  2. (double) 2
//
// OR:
//  1. "two"
//  2. (double) 2
//  3. "one"
//  4. (double) 1
func (cmd *KeyValueSliceCmd) readReply(rd *proto.Reader) error { // nolint:dupl
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	// If the n is 0, can't continue reading.
	if n == 0 {
		cmd.val = make([]KeyValue, 0)
		return nil
	}

	typ, err := rd.PeekReplyType()
	if err != nil {
		return err
	}
	array := typ == proto.RespArray

	if array {
		cmd.val = make([]KeyValue, n)
	} else {
		cmd.val = make([]KeyValue, n/2)
	}

	for i := 0; i < len(cmd.val); i++ {
		if array {
			if err = rd.ReadFixedArrayLen(2); err != nil {
				return err
			}
		}

		if cmd.val[i].Key, err = rd.ReadString(); err != nil {
			return err
		}

		if cmd.val[i].Value, err = rd.ReadString(); err != nil {
			return err
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type BoolSliceCmd struct {
	baseCmd

	val []bool
}

var _ Cmder = (*BoolSliceCmd)(nil)

func NewBoolSliceCmd(ctx context.Context, args ...interface{}) *BoolSliceCmd {
	return &BoolSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *BoolSliceCmd) SetVal(val []bool) {
	cmd.val = val
}

func (cmd *BoolSliceCmd) Val() []bool {
	return cmd.val
}

func (cmd *BoolSliceCmd) Result() ([]bool, error) {
	return cmd.val, cmd.err
}

func (cmd *BoolSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *BoolSliceCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]bool, n)
	for i := 0; i < len(cmd.val); i++ {
		if cmd.val[i], err = rd.ReadBool(); err != nil {
			return err
		}
	}
	return nil
}

//------------------------------------------------------------------------------

type MapStringStringCmd struct {
	baseCmd

	val map[string]string
}

var _ Cmder = (*MapStringStringCmd)(nil)

func NewMapStringStringCmd(ctx context.Context, args ...interface{}) *MapStringStringCmd {
	return &MapStringStringCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *MapStringStringCmd) Val() map[string]string {
	return cmd.val
}

func (cmd *MapStringStringCmd) SetVal(val map[string]string) {
	cmd.val = val
}

func (cmd *MapStringStringCmd) Result() (map[string]string, error) {
	return cmd.val, cmd.err
}

func (cmd *MapStringStringCmd) String() string {
	return cmdString(cmd, cmd.val)
}

// Scan scans the results from the map into a destination struct. The map keys
// are matched in the Redis struct fields by the `redis:"field"` tag.
func (cmd *MapStringStringCmd) Scan(dest interface{}) error {
	if cmd.err != nil {
		return cmd.err
	}

	strct, err := hscan.Struct(dest)
	if err != nil {
		return err
	}

	for k, v := range cmd.val {
		if err := strct.Scan(k, v); err != nil {
			return err
		}
	}

	return nil
}

func (cmd *MapStringStringCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadMapLen()
	if err != nil {
		return err
	}

	cmd.val = make(map[string]string, n)
	for i := 0; i < n; i++ {
		key, err := rd.ReadString()
		if err != nil {
			return err
		}

		value, err := rd.ReadString()
		if err != nil {
			return err
		}

		cmd.val[key] = value
	}
	return nil
}

//------------------------------------------------------------------------------

type MapStringIntCmd struct {
	baseCmd

	val map[string]int64
}

var _ Cmder = (*MapStringIntCmd)(nil)

func NewMapStringIntCmd(ctx context.Context, args ...interface{}) *MapStringIntCmd {
	return &MapStringIntCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *MapStringIntCmd) SetVal(val map[string]int64) {
	cmd.val = val
}

func (cmd *MapStringIntCmd) Val() map[string]int64 {
	return cmd.val
}

func (cmd *MapStringIntCmd) Result() (map[string]int64, error) {
	return cmd.val, cmd.err
}

func (cmd *MapStringIntCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *MapStringIntCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadMapLen()
	if err != nil {
		return err
	}

	cmd.val = make(map[string]int64, n)
	for i := 0; i < n; i++ {
		key, err := rd.ReadString()
		if err != nil {
			return err
		}

		nn, err := rd.ReadInt()
		if err != nil {
			return err
		}
		cmd.val[key] = nn
	}
	return nil
}

// ------------------------------------------------------------------------------
type MapStringSliceInterfaceCmd struct {
	baseCmd
	val map[string][]interface{}
}

func NewMapStringSliceInterfaceCmd(ctx context.Context, args ...interface{}) *MapStringSliceInterfaceCmd {
	return &MapStringSliceInterfaceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *MapStringSliceInterfaceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *MapStringSliceInterfaceCmd) SetVal(val map[string][]interface{}) {
	cmd.val = val
}

func (cmd *MapStringSliceInterfaceCmd) Result() (map[string][]interface{}, error) {
	return cmd.val, cmd.err
}

func (cmd *MapStringSliceInterfaceCmd) Val() map[string][]interface{} {
	return cmd.val
}

func (cmd *MapStringSliceInterfaceCmd) readReply(rd *proto.Reader) (err error) {
	readType, err := rd.PeekReplyType()
	if err != nil {
		return err
	}

	cmd.val = make(map[string][]interface{})

	switch readType {
	case proto.RespMap:
		n, err := rd.ReadMapLen()
		if err != nil {
			return err
		}
		for i := 0; i < n; i++ {
			k, err := rd.ReadString()
			if err != nil {
				return err
			}
			nn, err := rd.ReadArrayLen()
			if err != nil {
				return err
			}
			cmd.val[k] = make([]interface{}, nn)
			for j := 0; j < nn; j++ {
				value, err := rd.ReadReply()
				if err != nil {
					return err
				}
				cmd.val[k][j] = value
			}
		}
	case proto.RespArray:
		// RESP2 response
		n, err := rd.ReadArrayLen()
		if err != nil {
			return err
		}

		for i := 0; i < n; i++ {
			// Each entry in this array is itself an array with key details
			itemLen, err := rd.ReadArrayLen()
			if err != nil {
				return err
			}

			key, err := rd.ReadString()
			if err != nil {
				return err
			}
			cmd.val[key] = make([]interface{}, 0, itemLen-1)
			for j := 1; j < itemLen; j++ {
				// Read the inner array for timestamp-value pairs
				data, err := rd.ReadReply()
				if err != nil {
					return err
				}
				cmd.val[key] = append(cmd.val[key], data)
			}
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type StringStructMapCmd struct {
	baseCmd

	val map[string]struct{}
}

var _ Cmder = (*StringStructMapCmd)(nil)

func NewStringStructMapCmd(ctx context.Context, args ...interface{}) *StringStructMapCmd {
	return &StringStructMapCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *StringStructMapCmd) SetVal(val map[string]struct{}) {
	cmd.val = val
}

func (cmd *StringStructMapCmd) Val() map[string]struct{} {
	return cmd.val
}

func (cmd *StringStructMapCmd) Result() (map[string]struct{}, error) {
	return cmd.val, cmd.err
}

func (cmd *StringStructMapCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *StringStructMapCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	cmd.val = make(map[string]struct{}, n)
	for i := 0; i < n; i++ {
		key, err := rd.ReadString()
		if err != nil {
			return err
		}
		cmd.val[key] = struct{}{}
	}
	return nil
}

//------------------------------------------------------------------------------

type XMessage struct {
	ID     string
	Values map[string]interface{}
}

type XMessageSliceCmd struct {
	baseCmd

	val []XMessage
}

var _ Cmder = (*XMessageSliceCmd)(nil)

func NewXMessageSliceCmd(ctx context.Context, args ...interface{}) *XMessageSliceCmd {
	return &XMessageSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *XMessageSliceCmd) SetVal(val []XMessage) {
	cmd.val = val
}

func (cmd *XMessageSliceCmd) Val() []XMessage {
	return cmd.val
}

func (cmd *XMessageSliceCmd) Result() ([]XMessage, error) {
	return cmd.val, cmd.err
}

func (cmd *XMessageSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XMessageSliceCmd) readReply(rd *proto.Reader) (err error) {
	cmd.val, err = readXMessageSlice(rd)
	return err
}

func readXMessageSlice(rd *proto.Reader) ([]XMessage, error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return nil, err
	}

	msgs := make([]XMessage, n)
	for i := 0; i < len(msgs); i++ {
		if msgs[i], err = readXMessage(rd); err != nil {
			return nil, err
		}
	}
	return msgs, nil
}

func readXMessage(rd *proto.Reader) (XMessage, error) {
	if err := rd.ReadFixedArrayLen(2); err != nil {
		return XMessage{}, err
	}

	id, err := rd.ReadString()
	if err != nil {
		return XMessage{}, err
	}

	v, err := stringInterfaceMapParser(rd)
	if err != nil {
		if err != proto.Nil {
			return XMessage{}, err
		}
	}

	return XMessage{
		ID:     id,
		Values: v,
	}, nil
}

func stringInterfaceMapParser(rd *proto.Reader) (map[string]interface{}, error) {
	n, err := rd.ReadMapLen()
	if err != nil {
		return nil, err
	}

	m := make(map[string]interface{}, n)
	for i := 0; i < n; i++ {
		key, err := rd.ReadString()
		if err != nil {
			return nil, err
		}

		value, err := rd.ReadString()
		if err != nil {
			return nil, err
		}

		m[key] = value
	}
	return m, nil
}

//------------------------------------------------------------------------------

type XStream struct {
	Stream   string
	Messages []XMessage
}

type XStreamSliceCmd struct {
	baseCmd

	val []XStream
}

var _ Cmder = (*XStreamSliceCmd)(nil)

func NewXStreamSliceCmd(ctx context.Context, args ...interface{}) *XStreamSliceCmd {
	return &XStreamSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *XStreamSliceCmd) SetVal(val []XStream) {
	cmd.val = val
}

func (cmd *XStreamSliceCmd) Val() []XStream {
	return cmd.val
}

func (cmd *XStreamSliceCmd) Result() ([]XStream, error) {
	return cmd.val, cmd.err
}

func (cmd *XStreamSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XStreamSliceCmd) readReply(rd *proto.Reader) error {
	typ, err := rd.PeekReplyType()
	if err != nil {
		return err
	}

	var n int
	if typ == proto.RespMap {
		n, err = rd.ReadMapLen()
	} else {
		n, err = rd.ReadArrayLen()
	}
	if err != nil {
		return err
	}
	cmd.val = make([]XStream, n)
	for i := 0; i < len(cmd.val); i++ {
		if typ != proto.RespMap {
			if err = rd.ReadFixedArrayLen(2); err != nil {
				return err
			}
		}
		if cmd.val[i].Stream, err = rd.ReadString(); err != nil {
			return err
		}
		if cmd.val[i].Messages, err = readXMessageSlice(rd); err != nil {
			return err
		}
	}
	return nil
}

//------------------------------------------------------------------------------

type XPending struct {
	Count     int64
	Lower     string
	Higher    string
	Consumers map[string]int64
}

type XPendingCmd struct {
	baseCmd
	val *XPending
}

var _ Cmder = (*XPendingCmd)(nil)

func NewXPendingCmd(ctx context.Context, args ...interface{}) *XPendingCmd {
	return &XPendingCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *XPendingCmd) SetVal(val *XPending) {
	cmd.val = val
}

func (cmd *XPendingCmd) Val() *XPending {
	return cmd.val
}

func (cmd *XPendingCmd) Result() (*XPending, error) {
	return cmd.val, cmd.err
}

func (cmd *XPendingCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XPendingCmd) readReply(rd *proto.Reader) error {
	var err error
	if err = rd.ReadFixedArrayLen(4); err != nil {
		return err
	}
	cmd.val = &XPending{}

	if cmd.val.Count, err = rd.ReadInt(); err != nil {
		return err
	}

	if cmd.val.Lower, err = rd.ReadString(); err != nil && err != Nil {
		return err
	}

	if cmd.val.Higher, err = rd.ReadString(); err != nil && err != Nil {
		return err
	}

	n, err := rd.ReadArrayLen()
	if err != nil && err != Nil {
		return err
	}
	cmd.val.Consumers = make(map[string]int64, n)
	for i := 0; i < n; i++ {
		if err = rd.ReadFixedArrayLen(2); err != nil {
			return err
		}

		consumerName, err := rd.ReadString()
		if err != nil {
			return err
		}
		consumerPending, err := rd.ReadInt()
		if err != nil {
			return err
		}
		cmd.val.Consumers[consumerName] = consumerPending
	}
	return nil
}

//------------------------------------------------------------------------------

type XPendingExt struct {
	ID         string
	Consumer   string
	Idle       time.Duration
	RetryCount int64
}

type XPendingExtCmd struct {
	baseCmd
	val []XPendingExt
}

var _ Cmder = (*XPendingExtCmd)(nil)

func NewXPendingExtCmd(ctx context.Context, args ...interface{}) *XPendingExtCmd {
	return &XPendingExtCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *XPendingExtCmd) SetVal(val []XPendingExt) {
	cmd.val = val
}

func (cmd *XPendingExtCmd) Val() []XPendingExt {
	return cmd.val
}

func (cmd *XPendingExtCmd) Result() ([]XPendingExt, error) {
	return cmd.val, cmd.err
}

func (cmd *XPendingExtCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XPendingExtCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]XPendingExt, n)

	for i := 0; i < len(cmd.val); i++ {
		if err = rd.ReadFixedArrayLen(4); err != nil {
			return err
		}

		if cmd.val[i].ID, err = rd.ReadString(); err != nil {
			return err
		}

		if cmd.val[i].Consumer, err = rd.ReadString(); err != nil && err != Nil {
			return err
		}

		idle, err := rd.ReadInt()
		if err != nil && err != Nil {
			return err
		}
		cmd.val[i].Idle = time.Duration(idle) * time.Millisecond

		if cmd.val[i].RetryCount, err = rd.ReadInt(); err != nil && err != Nil {
			return err
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type XAutoClaimCmd struct {
	baseCmd

	start string
	val   []XMessage
}

var _ Cmder = (*XAutoClaimCmd)(nil)

func NewXAutoClaimCmd(ctx context.Context, args ...interface{}) *XAutoClaimCmd {
	return &XAutoClaimCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *XAutoClaimCmd) SetVal(val []XMessage, start string) {
	cmd.val = val
	cmd.start = start
}

func (cmd *XAutoClaimCmd) Val() (messages []XMessage, start string) {
	return cmd.val, cmd.start
}

func (cmd *XAutoClaimCmd) Result() (messages []XMessage, start string, err error) {
	return cmd.val, cmd.start, cmd.err
}

func (cmd *XAutoClaimCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XAutoClaimCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	switch n {
	case 2, // Redis 6
		3: // Redis 7:
		// ok
	default:
		return fmt.Errorf("redis: got %d elements in XAutoClaim reply, wanted 2/3", n)
	}

	cmd.start, err = rd.ReadString()
	if err != nil {
		return err
	}

	cmd.val, err = readXMessageSlice(rd)
	if err != nil {
		return err
	}

	if n >= 3 {
		if err := rd.DiscardNext(); err != nil {
			return err
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type XAutoClaimJustIDCmd struct {
	baseCmd

	start string
	val   []string
}

var _ Cmder = (*XAutoClaimJustIDCmd)(nil)

func NewXAutoClaimJustIDCmd(ctx context.Context, args ...interface{}) *XAutoClaimJustIDCmd {
	return &XAutoClaimJustIDCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *XAutoClaimJustIDCmd) SetVal(val []string, start string) {
	cmd.val = val
	cmd.start = start
}

func (cmd *XAutoClaimJustIDCmd) Val() (ids []string, start string) {
	return cmd.val, cmd.start
}

func (cmd *XAutoClaimJustIDCmd) Result() (ids []string, start string, err error) {
	return cmd.val, cmd.start, cmd.err
}

func (cmd *XAutoClaimJustIDCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XAutoClaimJustIDCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	switch n {
	case 2, // Redis 6
		3: // Redis 7:
		// ok
	default:
		return fmt.Errorf("redis: got %d elements in XAutoClaimJustID reply, wanted 2/3", n)
	}

	cmd.start, err = rd.ReadString()
	if err != nil {
		return err
	}

	nn, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	cmd.val = make([]string, nn)
	for i := 0; i < nn; i++ {
		cmd.val[i], err = rd.ReadString()
		if err != nil {
			return err
		}
	}

	if n >= 3 {
		if err := rd.DiscardNext(); err != nil {
			return err
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type XInfoConsumersCmd struct {
	baseCmd
	val []XInfoConsumer
}

type XInfoConsumer struct {
	Name     string
	Pending  int64
	Idle     time.Duration
	Inactive time.Duration
}

var _ Cmder = (*XInfoConsumersCmd)(nil)

func NewXInfoConsumersCmd(ctx context.Context, stream string, group string) *XInfoConsumersCmd {
	return &XInfoConsumersCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: []interface{}{"xinfo", "consumers", stream, group},
		},
	}
}

func (cmd *XInfoConsumersCmd) SetVal(val []XInfoConsumer) {
	cmd.val = val
}

func (cmd *XInfoConsumersCmd) Val() []XInfoConsumer {
	return cmd.val
}

func (cmd *XInfoConsumersCmd) Result() ([]XInfoConsumer, error) {
	return cmd.val, cmd.err
}

func (cmd *XInfoConsumersCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XInfoConsumersCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]XInfoConsumer, n)

	for i := 0; i < len(cmd.val); i++ {
		nn, err := rd.ReadMapLen()
		if err != nil {
			return err
		}

		var key string
		for f := 0; f < nn; f++ {
			key, err = rd.ReadString()
			if err != nil {
				return err
			}

			switch key {
			case "name":
				cmd.val[i].Name, err = rd.ReadString()
			case "pending":
				cmd.val[i].Pending, err = rd.ReadInt()
			case "idle":
				var idle int64
				idle, err = rd.ReadInt()
				cmd.val[i].Idle = time.Duration(idle) * time.Millisecond
			case "inactive":
				var inactive int64
				inactive, err = rd.ReadInt()
				cmd.val[i].Inactive = time.Duration(inactive) * time.Millisecond
			default:
				return fmt.Errorf("redis: unexpected content %s in XINFO CONSUMERS reply", key)
			}
			if err != nil {
				return err
			}
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type XInfoGroupsCmd struct {
	baseCmd
	val []XInfoGroup
}

type XInfoGroup struct {
	Name            string
	Consumers       int64
	Pending         int64
	LastDeliveredID string
	EntriesRead     int64
	Lag             int64
}

var _ Cmder = (*XInfoGroupsCmd)(nil)

func NewXInfoGroupsCmd(ctx context.Context, stream string) *XInfoGroupsCmd {
	return &XInfoGroupsCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: []interface{}{"xinfo", "groups", stream},
		},
	}
}

func (cmd *XInfoGroupsCmd) SetVal(val []XInfoGroup) {
	cmd.val = val
}

func (cmd *XInfoGroupsCmd) Val() []XInfoGroup {
	return cmd.val
}

func (cmd *XInfoGroupsCmd) Result() ([]XInfoGroup, error) {
	return cmd.val, cmd.err
}

func (cmd *XInfoGroupsCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XInfoGroupsCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]XInfoGroup, n)

	for i := 0; i < len(cmd.val); i++ {
		group := &cmd.val[i]

		nn, err := rd.ReadMapLen()
		if err != nil {
			return err
		}

		var key string
		for j := 0; j < nn; j++ {
			key, err = rd.ReadString()
			if err != nil {
				return err
			}

			switch key {
			case "name":
				group.Name, err = rd.ReadString()
				if err != nil {
					return err
				}
			case "consumers":
				group.Consumers, err = rd.ReadInt()
				if err != nil {
					return err
				}
			case "pending":
				group.Pending, err = rd.ReadInt()
				if err != nil {
					return err
				}
			case "last-delivered-id":
				group.LastDeliveredID, err = rd.ReadString()
				if err != nil {
					return err
				}
			case "entries-read":
				group.EntriesRead, err = rd.ReadInt()
				if err != nil && err != Nil {
					return err
				}
			case "lag":
				group.Lag, err = rd.ReadInt()

				// lag: the number of entries in the stream that are still waiting to be delivered
				// to the group's consumers, or a NULL(Nil) when that number can't be determined.
				if err != nil && err != Nil {
					return err
				}
			default:
				return fmt.Errorf("redis: unexpected key %q in XINFO GROUPS reply", key)
			}
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type XInfoStreamCmd struct {
	baseCmd
	val *XInfoStream
}

type XInfoStream struct {
	Length               int64
	RadixTreeKeys        int64
	RadixTreeNodes       int64
	Groups               int64
	LastGeneratedID      string
	MaxDeletedEntryID    string
	EntriesAdded         int64
	FirstEntry           XMessage
	LastEntry            XMessage
	RecordedFirstEntryID string
}

var _ Cmder = (*XInfoStreamCmd)(nil)

func NewXInfoStreamCmd(ctx context.Context, stream string) *XInfoStreamCmd {
	return &XInfoStreamCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: []interface{}{"xinfo", "stream", stream},
		},
	}
}

func (cmd *XInfoStreamCmd) SetVal(val *XInfoStream) {
	cmd.val = val
}

func (cmd *XInfoStreamCmd) Val() *XInfoStream {
	return cmd.val
}

func (cmd *XInfoStreamCmd) Result() (*XInfoStream, error) {
	return cmd.val, cmd.err
}

func (cmd *XInfoStreamCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XInfoStreamCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadMapLen()
	if err != nil {
		return err
	}
	cmd.val = &XInfoStream{}

	for i := 0; i < n; i++ {
		key, err := rd.ReadString()
		if err != nil {
			return err
		}
		switch key {
		case "length":
			cmd.val.Length, err = rd.ReadInt()
			if err != nil {
				return err
			}
		case "radix-tree-keys":
			cmd.val.RadixTreeKeys, err = rd.ReadInt()
			if err != nil {
				return err
			}
		case "radix-tree-nodes":
			cmd.val.RadixTreeNodes, err = rd.ReadInt()
			if err != nil {
				return err
			}
		case "groups":
			cmd.val.Groups, err = rd.ReadInt()
			if err != nil {
				return err
			}
		case "last-generated-id":
			cmd.val.LastGeneratedID, err = rd.ReadString()
			if err != nil {
				return err
			}
		case "max-deleted-entry-id":
			cmd.val.MaxDeletedEntryID, err = rd.ReadString()
			if err != nil {
				return err
			}
		case "entries-added":
			cmd.val.EntriesAdded, err = rd.ReadInt()
			if err != nil {
				return err
			}
		case "first-entry":
			cmd.val.FirstEntry, err = readXMessage(rd)
			if err != nil && err != Nil {
				return err
			}
		case "last-entry":
			cmd.val.LastEntry, err = readXMessage(rd)
			if err != nil && err != Nil {
				return err
			}
		case "recorded-first-entry-id":
			cmd.val.RecordedFirstEntryID, err = rd.ReadString()
			if err != nil {
				return err
			}
		default:
			return fmt.Errorf("redis: unexpected key %q in XINFO STREAM reply", key)
		}
	}
	return nil
}

//------------------------------------------------------------------------------

type XInfoStreamFullCmd struct {
	baseCmd
	val *XInfoStreamFull
}

type XInfoStreamFull struct {
	Length               int64
	RadixTreeKeys        int64
	RadixTreeNodes       int64
	LastGeneratedID      string
	MaxDeletedEntryID    string
	EntriesAdded         int64
	Entries              []XMessage
	Groups               []XInfoStreamGroup
	RecordedFirstEntryID string
}

type XInfoStreamGroup struct {
	Name            string
	LastDeliveredID string
	EntriesRead     int64
	Lag             int64
	PelCount        int64
	Pending         []XInfoStreamGroupPending
	Consumers       []XInfoStreamConsumer
}

type XInfoStreamGroupPending struct {
	ID            string
	Consumer      string
	DeliveryTime  time.Time
	DeliveryCount int64
}

type XInfoStreamConsumer struct {
	Name       string
	SeenTime   time.Time
	ActiveTime time.Time
	PelCount   int64
	Pending    []XInfoStreamConsumerPending
}

type XInfoStreamConsumerPending struct {
	ID            string
	DeliveryTime  time.Time
	DeliveryCount int64
}

var _ Cmder = (*XInfoStreamFullCmd)(nil)

func NewXInfoStreamFullCmd(ctx context.Context, args ...interface{}) *XInfoStreamFullCmd {
	return &XInfoStreamFullCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *XInfoStreamFullCmd) SetVal(val *XInfoStreamFull) {
	cmd.val = val
}

func (cmd *XInfoStreamFullCmd) Val() *XInfoStreamFull {
	return cmd.val
}

func (cmd *XInfoStreamFullCmd) Result() (*XInfoStreamFull, error) {
	return cmd.val, cmd.err
}

func (cmd *XInfoStreamFullCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *XInfoStreamFullCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadMapLen()
	if err != nil {
		return err
	}

	cmd.val = &XInfoStreamFull{}

	for i := 0; i < n; i++ {
		key, err := rd.ReadString()
		if err != nil {
			return err
		}

		switch key {
		case "length":
			cmd.val.Length, err = rd.ReadInt()
			if err != nil {
				return err
			}
		case "radix-tree-keys":
			cmd.val.RadixTreeKeys, err = rd.ReadInt()
			if err != nil {
				return err
			}
		case "radix-tree-nodes":
			cmd.val.RadixTreeNodes, err = rd.ReadInt()
			if err != nil {
				return err
			}
		case "last-generated-id":
			cmd.val.LastGeneratedID, err = rd.ReadString()
			if err != nil {
				return err
			}
		case "entries-added":
			cmd.val.EntriesAdded, err = rd.ReadInt()
			if err != nil {
				return err
			}
		case "entries":
			cmd.val.Entries, err = readXMessageSlice(rd)
			if err != nil {
				return err
			}
		case "groups":
			cmd.val.Groups, err = readStreamGroups(rd)
			if err != nil {
				return err
			}
		case "max-deleted-entry-id":
			cmd.val.MaxDeletedEntryID, err = rd.ReadString()
			if err != nil {
				return err
			}
		case "recorded-first-entry-id":
			cmd.val.RecordedFirstEntryID, err = rd.ReadString()
			if err != nil {
				return err
			}
		default:
			return fmt.Errorf("redis: unexpected key %q in XINFO STREAM FULL reply", key)
		}
	}
	return nil
}

func readStreamGroups(rd *proto.Reader) ([]XInfoStreamGroup, error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return nil, err
	}
	groups := make([]XInfoStreamGroup, 0, n)
	for i := 0; i < n; i++ {
		nn, err := rd.ReadMapLen()
		if err != nil {
			return nil, err
		}

		group := XInfoStreamGroup{}

		for j := 0; j < nn; j++ {
			key, err := rd.ReadString()
			if err != nil {
				return nil, err
			}

			switch key {
			case "name":
				group.Name, err = rd.ReadString()
				if err != nil {
					return nil, err
				}
			case "last-delivered-id":
				group.LastDeliveredID, err = rd.ReadString()
				if err != nil {
					return nil, err
				}
			case "entries-read":
				group.EntriesRead, err = rd.ReadInt()
				if err != nil && err != Nil {
					return nil, err
				}
			case "lag":
				// lag: the number of entries in the stream that are still waiting to be delivered
				// to the group's consumers, or a NULL(Nil) when that number can't be determined.
				group.Lag, err = rd.ReadInt()
				if err != nil && err != Nil {
					return nil, err
				}
			case "pel-count":
				group.PelCount, err = rd.ReadInt()
				if err != nil {
					return nil, err
				}
			case "pending":
				group.Pending, err = readXInfoStreamGroupPending(rd)
				if err != nil {
					return nil, err
				}
			case "consumers":
				group.Consumers, err = readXInfoStreamConsumers(rd)
				if err != nil {
					return nil, err
				}
			default:
				return nil, fmt.Errorf("redis: unexpected key %q in XINFO STREAM FULL reply", key)
			}
		}

		groups = append(groups, group)
	}

	return groups, nil
}

func readXInfoStreamGroupPending(rd *proto.Reader) ([]XInfoStreamGroupPending, error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return nil, err
	}

	pending := make([]XInfoStreamGroupPending, 0, n)

	for i := 0; i < n; i++ {
		if err = rd.ReadFixedArrayLen(4); err != nil {
			return nil, err
		}

		p := XInfoStreamGroupPending{}

		p.ID, err = rd.ReadString()
		if err != nil {
			return nil, err
		}

		p.Consumer, err = rd.ReadString()
		if err != nil {
			return nil, err
		}

		delivery, err := rd.ReadInt()
		if err != nil {
			return nil, err
		}
		p.DeliveryTime = time.Unix(delivery/1000, delivery%1000*int64(time.Millisecond))

		p.DeliveryCount, err = rd.ReadInt()
		if err != nil {
			return nil, err
		}

		pending = append(pending, p)
	}

	return pending, nil
}

func readXInfoStreamConsumers(rd *proto.Reader) ([]XInfoStreamConsumer, error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return nil, err
	}

	consumers := make([]XInfoStreamConsumer, 0, n)

	for i := 0; i < n; i++ {
		nn, err := rd.ReadMapLen()
		if err != nil {
			return nil, err
		}

		c := XInfoStreamConsumer{}

		for f := 0; f < nn; f++ {
			cKey, err := rd.ReadString()
			if err != nil {
				return nil, err
			}

			switch cKey {
			case "name":
				c.Name, err = rd.ReadString()
			case "seen-time":
				seen, err := rd.ReadInt()
				if err != nil {
					return nil, err
				}
				c.SeenTime = time.UnixMilli(seen)
			case "active-time":
				active, err := rd.ReadInt()
				if err != nil {
					return nil, err
				}
				c.ActiveTime = time.UnixMilli(active)
			case "pel-count":
				c.PelCount, err = rd.ReadInt()
			case "pending":
				pendingNumber, err := rd.ReadArrayLen()
				if err != nil {
					return nil, err
				}

				c.Pending = make([]XInfoStreamConsumerPending, 0, pendingNumber)

				for pn := 0; pn < pendingNumber; pn++ {
					if err = rd.ReadFixedArrayLen(3); err != nil {
						return nil, err
					}

					p := XInfoStreamConsumerPending{}

					p.ID, err = rd.ReadString()
					if err != nil {
						return nil, err
					}

					delivery, err := rd.ReadInt()
					if err != nil {
						return nil, err
					}
					p.DeliveryTime = time.Unix(delivery/1000, delivery%1000*int64(time.Millisecond))

					p.DeliveryCount, err = rd.ReadInt()
					if err != nil {
						return nil, err
					}

					c.Pending = append(c.Pending, p)
				}
			default:
				return nil, fmt.Errorf("redis: unexpected content %s "+
					"in XINFO STREAM FULL reply", cKey)
			}
			if err != nil {
				return nil, err
			}
		}
		consumers = append(consumers, c)
	}

	return consumers, nil
}

//------------------------------------------------------------------------------

type ZSliceCmd struct {
	baseCmd

	val []Z
}

var _ Cmder = (*ZSliceCmd)(nil)

func NewZSliceCmd(ctx context.Context, args ...interface{}) *ZSliceCmd {
	return &ZSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *ZSliceCmd) SetVal(val []Z) {
	cmd.val = val
}

func (cmd *ZSliceCmd) Val() []Z {
	return cmd.val
}

func (cmd *ZSliceCmd) Result() ([]Z, error) {
	return cmd.val, cmd.err
}

func (cmd *ZSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *ZSliceCmd) readReply(rd *proto.Reader) error { // nolint:dupl
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	// If the n is 0, can't continue reading.
	if n == 0 {
		cmd.val = make([]Z, 0)
		return nil
	}

	typ, err := rd.PeekReplyType()
	if err != nil {
		return err
	}
	array := typ == proto.RespArray

	if array {
		cmd.val = make([]Z, n)
	} else {
		cmd.val = make([]Z, n/2)
	}

	for i := 0; i < len(cmd.val); i++ {
		if array {
			if err = rd.ReadFixedArrayLen(2); err != nil {
				return err
			}
		}

		if cmd.val[i].Member, err = rd.ReadString(); err != nil {
			return err
		}

		if cmd.val[i].Score, err = rd.ReadFloat(); err != nil {
			return err
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type ZWithKeyCmd struct {
	baseCmd

	val *ZWithKey
}

var _ Cmder = (*ZWithKeyCmd)(nil)

func NewZWithKeyCmd(ctx context.Context, args ...interface{}) *ZWithKeyCmd {
	return &ZWithKeyCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *ZWithKeyCmd) SetVal(val *ZWithKey) {
	cmd.val = val
}

func (cmd *ZWithKeyCmd) Val() *ZWithKey {
	return cmd.val
}

func (cmd *ZWithKeyCmd) Result() (*ZWithKey, error) {
	return cmd.val, cmd.err
}

func (cmd *ZWithKeyCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *ZWithKeyCmd) readReply(rd *proto.Reader) (err error) {
	if err = rd.ReadFixedArrayLen(3); err != nil {
		return err
	}
	cmd.val = &ZWithKey{}

	if cmd.val.Key, err = rd.ReadString(); err != nil {
		return err
	}
	if cmd.val.Member, err = rd.ReadString(); err != nil {
		return err
	}
	if cmd.val.Score, err = rd.ReadFloat(); err != nil {
		return err
	}

	return nil
}

//------------------------------------------------------------------------------

type ScanCmd struct {
	baseCmd

	page   []string
	cursor uint64

	process cmdable
}

var _ Cmder = (*ScanCmd)(nil)

func NewScanCmd(ctx context.Context, process cmdable, args ...interface{}) *ScanCmd {
	return &ScanCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
		process: process,
	}
}

func (cmd *ScanCmd) SetVal(page []string, cursor uint64) {
	cmd.page = page
	cmd.cursor = cursor
}

func (cmd *ScanCmd) Val() (keys []string, cursor uint64) {
	return cmd.page, cmd.cursor
}

func (cmd *ScanCmd) Result() (keys []string, cursor uint64, err error) {
	return cmd.page, cmd.cursor, cmd.err
}

func (cmd *ScanCmd) String() string {
	return cmdString(cmd, cmd.page)
}

func (cmd *ScanCmd) readReply(rd *proto.Reader) error {
	if err := rd.ReadFixedArrayLen(2); err != nil {
		return err
	}

	cursor, err := rd.ReadUint()
	if err != nil {
		return err
	}
	cmd.cursor = cursor

	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.page = make([]string, n)

	for i := 0; i < len(cmd.page); i++ {
		if cmd.page[i], err = rd.ReadString(); err != nil {
			return err
		}
	}
	return nil
}

// Iterator creates a new ScanIterator.
func (cmd *ScanCmd) Iterator() *ScanIterator {
	return &ScanIterator{
		cmd: cmd,
	}
}

//------------------------------------------------------------------------------

type ClusterNode struct {
	ID                 string
	Addr               string
	NetworkingMetadata map[string]string
}

type ClusterSlot struct {
	Start int
	End   int
	Nodes []ClusterNode
}

type ClusterSlotsCmd struct {
	baseCmd

	val []ClusterSlot
}

var _ Cmder = (*ClusterSlotsCmd)(nil)

func NewClusterSlotsCmd(ctx context.Context, args ...interface{}) *ClusterSlotsCmd {
	return &ClusterSlotsCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *ClusterSlotsCmd) SetVal(val []ClusterSlot) {
	cmd.val = val
}

func (cmd *ClusterSlotsCmd) Val() []ClusterSlot {
	return cmd.val
}

func (cmd *ClusterSlotsCmd) Result() ([]ClusterSlot, error) {
	return cmd.val, cmd.err
}

func (cmd *ClusterSlotsCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *ClusterSlotsCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]ClusterSlot, n)

	for i := 0; i < len(cmd.val); i++ {
		n, err = rd.ReadArrayLen()
		if err != nil {
			return err
		}
		if n < 2 {
			return fmt.Errorf("redis: got %d elements in cluster info, expected at least 2", n)
		}

		start, err := rd.ReadInt()
		if err != nil {
			return err
		}

		end, err := rd.ReadInt()
		if err != nil {
			return err
		}

		// subtract start and end.
		nodes := make([]ClusterNode, n-2)

		for j := 0; j < len(nodes); j++ {
			nn, err := rd.ReadArrayLen()
			if err != nil {
				return err
			}
			if nn < 2 || nn > 4 {
				return fmt.Errorf("got %d elements in cluster info address, expected 2, 3, or 4", n)
			}

			ip, err := rd.ReadString()
			if err != nil {
				return err
			}

			port, err := rd.ReadString()
			if err != nil {
				return err
			}

			nodes[j].Addr = net.JoinHostPort(ip, port)

			if nn >= 3 {
				id, err := rd.ReadString()
				if err != nil {
					return err
				}
				nodes[j].ID = id
			}

			if nn >= 4 {
				metadataLength, err := rd.ReadMapLen()
				if err != nil {
					return err
				}

				networkingMetadata := make(map[string]string, metadataLength)

				for i := 0; i < metadataLength; i++ {
					key, err := rd.ReadString()
					if err != nil {
						return err
					}
					value, err := rd.ReadString()
					if err != nil {
						return err
					}
					networkingMetadata[key] = value
				}

				nodes[j].NetworkingMetadata = networkingMetadata
			}
		}

		cmd.val[i] = ClusterSlot{
			Start: int(start),
			End:   int(end),
			Nodes: nodes,
		}
	}

	return nil
}

//------------------------------------------------------------------------------

// GeoLocation is used with GeoAdd to add geospatial location.
type GeoLocation struct {
	Name                      string
	Longitude, Latitude, Dist float64
	GeoHash                   int64
}

// GeoRadiusQuery is used with GeoRadius to query geospatial index.
type GeoRadiusQuery struct {
	Radius float64
	// Can be m, km, ft, or mi. Default is km.
	Unit        string
	WithCoord   bool
	WithDist    bool
	WithGeoHash bool
	Count       int
	// Can be ASC or DESC. Default is no sort order.
	Sort      string
	Store     string
	StoreDist string

	// WithCoord+WithDist+WithGeoHash
	withLen int
}

type GeoLocationCmd struct {
	baseCmd

	q         *GeoRadiusQuery
	locations []GeoLocation
}

var _ Cmder = (*GeoLocationCmd)(nil)

func NewGeoLocationCmd(ctx context.Context, q *GeoRadiusQuery, args ...interface{}) *GeoLocationCmd {
	return &GeoLocationCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: geoLocationArgs(q, args...),
		},
		q: q,
	}
}

func geoLocationArgs(q *GeoRadiusQuery, args ...interface{}) []interface{} {
	args = append(args, q.Radius)
	if q.Unit != "" {
		args = append(args, q.Unit)
	} else {
		args = append(args, "km")
	}
	if q.WithCoord {
		args = append(args, "withcoord")
		q.withLen++
	}
	if q.WithDist {
		args = append(args, "withdist")
		q.withLen++
	}
	if q.WithGeoHash {
		args = append(args, "withhash")
		q.withLen++
	}
	if q.Count > 0 {
		args = append(args, "count", q.Count)
	}
	if q.Sort != "" {
		args = append(args, q.Sort)
	}
	if q.Store != "" {
		args = append(args, "store")
		args = append(args, q.Store)
	}
	if q.StoreDist != "" {
		args = append(args, "storedist")
		args = append(args, q.StoreDist)
	}
	return args
}

func (cmd *GeoLocationCmd) SetVal(locations []GeoLocation) {
	cmd.locations = locations
}

func (cmd *GeoLocationCmd) Val() []GeoLocation {
	return cmd.locations
}

func (cmd *GeoLocationCmd) Result() ([]GeoLocation, error) {
	return cmd.locations, cmd.err
}

func (cmd *GeoLocationCmd) String() string {
	return cmdString(cmd, cmd.locations)
}

func (cmd *GeoLocationCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.locations = make([]GeoLocation, n)

	for i := 0; i < len(cmd.locations); i++ {
		// only name
		if cmd.q.withLen == 0 {
			if cmd.locations[i].Name, err = rd.ReadString(); err != nil {
				return err
			}
			continue
		}

		// +name
		if err = rd.ReadFixedArrayLen(cmd.q.withLen + 1); err != nil {
			return err
		}

		if cmd.locations[i].Name, err = rd.ReadString(); err != nil {
			return err
		}
		if cmd.q.WithDist {
			if cmd.locations[i].Dist, err = rd.ReadFloat(); err != nil {
				return err
			}
		}
		if cmd.q.WithGeoHash {
			if cmd.locations[i].GeoHash, err = rd.ReadInt(); err != nil {
				return err
			}
		}
		if cmd.q.WithCoord {
			if err = rd.ReadFixedArrayLen(2); err != nil {
				return err
			}
			if cmd.locations[i].Longitude, err = rd.ReadFloat(); err != nil {
				return err
			}
			if cmd.locations[i].Latitude, err = rd.ReadFloat(); err != nil {
				return err
			}
		}
	}

	return nil
}

//------------------------------------------------------------------------------

// GeoSearchQuery is used for GEOSearch/GEOSearchStore command query.
type GeoSearchQuery struct {
	Member string

	// Latitude and Longitude when using FromLonLat option.
	Longitude float64
	Latitude  float64

	// Distance and unit when using ByRadius option.
	// Can use m, km, ft, or mi. Default is km.
	Radius     float64
	RadiusUnit string

	// Height, width and unit when using ByBox option.
	// Can be m, km, ft, or mi. Default is km.
	BoxWidth  float64
	BoxHeight float64
	BoxUnit   string

	// Can be ASC or DESC. Default is no sort order.
	Sort     string
	Count    int
	CountAny bool
}

type GeoSearchLocationQuery struct {
	GeoSearchQuery

	WithCoord bool
	WithDist  bool
	WithHash  bool
}

type GeoSearchStoreQuery struct {
	GeoSearchQuery

	// When using the StoreDist option, the command stores the items in a
	// sorted set populated with their distance from the center of the circle or box,
	// as a floating-point number, in the same unit specified for that shape.
	StoreDist bool
}

func geoSearchLocationArgs(q *GeoSearchLocationQuery, args []interface{}) []interface{} {
	args = geoSearchArgs(&q.GeoSearchQuery, args)

	if q.WithCoord {
		args = append(args, "withcoord")
	}
	if q.WithDist {
		args = append(args, "withdist")
	}
	if q.WithHash {
		args = append(args, "withhash")
	}

	return args
}

func geoSearchArgs(q *GeoSearchQuery, args []interface{}) []interface{} {
	if q.Member != "" {
		args = append(args, "frommember", q.Member)
	} else {
		args = append(args, "fromlonlat", q.Longitude, q.Latitude)
	}

	if q.Radius > 0 {
		if q.RadiusUnit == "" {
			q.RadiusUnit = "km"
		}
		args = append(args, "byradius", q.Radius, q.RadiusUnit)
	} else {
		if q.BoxUnit == "" {
			q.BoxUnit = "km"
		}
		args = append(args, "bybox", q.BoxWidth, q.BoxHeight, q.BoxUnit)
	}

	if q.Sort != "" {
		args = append(args, q.Sort)
	}

	if q.Count > 0 {
		args = append(args, "count", q.Count)
		if q.CountAny {
			args = append(args, "any")
		}
	}

	return args
}

type GeoSearchLocationCmd struct {
	baseCmd

	opt *GeoSearchLocationQuery
	val []GeoLocation
}

var _ Cmder = (*GeoSearchLocationCmd)(nil)

func NewGeoSearchLocationCmd(
	ctx context.Context, opt *GeoSearchLocationQuery, args ...interface{},
) *GeoSearchLocationCmd {
	return &GeoSearchLocationCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
		opt: opt,
	}
}

func (cmd *GeoSearchLocationCmd) SetVal(val []GeoLocation) {
	cmd.val = val
}

func (cmd *GeoSearchLocationCmd) Val() []GeoLocation {
	return cmd.val
}

func (cmd *GeoSearchLocationCmd) Result() ([]GeoLocation, error) {
	return cmd.val, cmd.err
}

func (cmd *GeoSearchLocationCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *GeoSearchLocationCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	cmd.val = make([]GeoLocation, n)
	for i := 0; i < n; i++ {
		_, err = rd.ReadArrayLen()
		if err != nil {
			return err
		}

		var loc GeoLocation

		loc.Name, err = rd.ReadString()
		if err != nil {
			return err
		}
		if cmd.opt.WithDist {
			loc.Dist, err = rd.ReadFloat()
			if err != nil {
				return err
			}
		}
		if cmd.opt.WithHash {
			loc.GeoHash, err = rd.ReadInt()
			if err != nil {
				return err
			}
		}
		if cmd.opt.WithCoord {
			if err = rd.ReadFixedArrayLen(2); err != nil {
				return err
			}
			loc.Longitude, err = rd.ReadFloat()
			if err != nil {
				return err
			}
			loc.Latitude, err = rd.ReadFloat()
			if err != nil {
				return err
			}
		}

		cmd.val[i] = loc
	}

	return nil
}

//------------------------------------------------------------------------------

type GeoPos struct {
	Longitude, Latitude float64
}

type GeoPosCmd struct {
	baseCmd

	val []*GeoPos
}

var _ Cmder = (*GeoPosCmd)(nil)

func NewGeoPosCmd(ctx context.Context, args ...interface{}) *GeoPosCmd {
	return &GeoPosCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *GeoPosCmd) SetVal(val []*GeoPos) {
	cmd.val = val
}

func (cmd *GeoPosCmd) Val() []*GeoPos {
	return cmd.val
}

func (cmd *GeoPosCmd) Result() ([]*GeoPos, error) {
	return cmd.val, cmd.err
}

func (cmd *GeoPosCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *GeoPosCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]*GeoPos, n)

	for i := 0; i < len(cmd.val); i++ {
		err = rd.ReadFixedArrayLen(2)
		if err != nil {
			if err == Nil {
				cmd.val[i] = nil
				continue
			}
			return err
		}

		longitude, err := rd.ReadFloat()
		if err != nil {
			return err
		}
		latitude, err := rd.ReadFloat()
		if err != nil {
			return err
		}

		cmd.val[i] = &GeoPos{
			Longitude: longitude,
			Latitude:  latitude,
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type CommandInfo struct {
	Name        string
	Arity       int8
	Flags       []string
	ACLFlags    []string
	FirstKeyPos int8
	LastKeyPos  int8
	StepCount   int8
	ReadOnly    bool
}

type CommandsInfoCmd struct {
	baseCmd

	val map[string]*CommandInfo
}

var _ Cmder = (*CommandsInfoCmd)(nil)

func NewCommandsInfoCmd(ctx context.Context, args ...interface{}) *CommandsInfoCmd {
	return &CommandsInfoCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *CommandsInfoCmd) SetVal(val map[string]*CommandInfo) {
	cmd.val = val
}

func (cmd *CommandsInfoCmd) Val() map[string]*CommandInfo {
	return cmd.val
}

func (cmd *CommandsInfoCmd) Result() (map[string]*CommandInfo, error) {
	return cmd.val, cmd.err
}

func (cmd *CommandsInfoCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *CommandsInfoCmd) readReply(rd *proto.Reader) error {
	const numArgRedis5 = 6
	const numArgRedis6 = 7
	const numArgRedis7 = 10

	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make(map[string]*CommandInfo, n)

	for i := 0; i < n; i++ {
		nn, err := rd.ReadArrayLen()
		if err != nil {
			return err
		}

		switch nn {
		case numArgRedis5, numArgRedis6, numArgRedis7:
			// ok
		default:
			return fmt.Errorf("redis: got %d elements in COMMAND reply, wanted 6/7/10", nn)
		}

		cmdInfo := &CommandInfo{}
		if cmdInfo.Name, err = rd.ReadString(); err != nil {
			return err
		}

		arity, err := rd.ReadInt()
		if err != nil {
			return err
		}
		cmdInfo.Arity = int8(arity)

		flagLen, err := rd.ReadArrayLen()
		if err != nil {
			return err
		}
		cmdInfo.Flags = make([]string, flagLen)
		for f := 0; f < len(cmdInfo.Flags); f++ {
			switch s, err := rd.ReadString(); {
			case err == Nil:
				cmdInfo.Flags[f] = ""
			case err != nil:
				return err
			default:
				if !cmdInfo.ReadOnly && s == "readonly" {
					cmdInfo.ReadOnly = true
				}
				cmdInfo.Flags[f] = s
			}
		}

		firstKeyPos, err := rd.ReadInt()
		if err != nil {
			return err
		}
		cmdInfo.FirstKeyPos = int8(firstKeyPos)

		lastKeyPos, err := rd.ReadInt()
		if err != nil {
			return err
		}
		cmdInfo.LastKeyPos = int8(lastKeyPos)

		stepCount, err := rd.ReadInt()
		if err != nil {
			return err
		}
		cmdInfo.StepCount = int8(stepCount)

		if nn >= numArgRedis6 {
			aclFlagLen, err := rd.ReadArrayLen()
			if err != nil {
				return err
			}
			cmdInfo.ACLFlags = make([]string, aclFlagLen)
			for f := 0; f < len(cmdInfo.ACLFlags); f++ {
				switch s, err := rd.ReadString(); {
				case err == Nil:
					cmdInfo.ACLFlags[f] = ""
				case err != nil:
					return err
				default:
					cmdInfo.ACLFlags[f] = s
				}
			}
		}

		if nn >= numArgRedis7 {
			if err := rd.DiscardNext(); err != nil {
				return err
			}
			if err := rd.DiscardNext(); err != nil {
				return err
			}
			if err := rd.DiscardNext(); err != nil {
				return err
			}
		}

		cmd.val[cmdInfo.Name] = cmdInfo
	}

	return nil
}

//------------------------------------------------------------------------------

type cmdsInfoCache struct {
	fn func(ctx context.Context) (map[string]*CommandInfo, error)

	once internal.Once
	cmds map[string]*CommandInfo
}

func newCmdsInfoCache(fn func(ctx context.Context) (map[string]*CommandInfo, error)) *cmdsInfoCache {
	return &cmdsInfoCache{
		fn: fn,
	}
}

func (c *cmdsInfoCache) Get(ctx context.Context) (map[string]*CommandInfo, error) {
	err := c.once.Do(func() error {
		cmds, err := c.fn(ctx)
		if err != nil {
			return err
		}

		// Extensions have cmd names in upper case. Convert them to lower case.
		for k, v := range cmds {
			lower := internal.ToLower(k)
			if lower != k {
				cmds[lower] = v
			}
		}

		c.cmds = cmds
		return nil
	})
	return c.cmds, err
}

//------------------------------------------------------------------------------

type SlowLog struct {
	ID       int64
	Time     time.Time
	Duration time.Duration
	Args     []string
	// These are also optional fields emitted only by Redis 4.0 or greater:
	// https://redis.io/commands/slowlog#output-format
	ClientAddr string
	ClientName string
}

type SlowLogCmd struct {
	baseCmd

	val []SlowLog
}

var _ Cmder = (*SlowLogCmd)(nil)

func NewSlowLogCmd(ctx context.Context, args ...interface{}) *SlowLogCmd {
	return &SlowLogCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *SlowLogCmd) SetVal(val []SlowLog) {
	cmd.val = val
}

func (cmd *SlowLogCmd) Val() []SlowLog {
	return cmd.val
}

func (cmd *SlowLogCmd) Result() ([]SlowLog, error) {
	return cmd.val, cmd.err
}

func (cmd *SlowLogCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *SlowLogCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]SlowLog, n)

	for i := 0; i < len(cmd.val); i++ {
		nn, err := rd.ReadArrayLen()
		if err != nil {
			return err
		}
		if nn < 4 {
			return fmt.Errorf("redis: got %d elements in slowlog get, expected at least 4", nn)
		}

		if cmd.val[i].ID, err = rd.ReadInt(); err != nil {
			return err
		}

		createdAt, err := rd.ReadInt()
		if err != nil {
			return err
		}
		cmd.val[i].Time = time.Unix(createdAt, 0)

		costs, err := rd.ReadInt()
		if err != nil {
			return err
		}
		cmd.val[i].Duration = time.Duration(costs) * time.Microsecond

		cmdLen, err := rd.ReadArrayLen()
		if err != nil {
			return err
		}
		if cmdLen < 1 {
			return fmt.Errorf("redis: got %d elements commands reply in slowlog get, expected at least 1", cmdLen)
		}

		cmd.val[i].Args = make([]string, cmdLen)
		for f := 0; f < len(cmd.val[i].Args); f++ {
			cmd.val[i].Args[f], err = rd.ReadString()
			if err != nil {
				return err
			}
		}

		if nn >= 5 {
			if cmd.val[i].ClientAddr, err = rd.ReadString(); err != nil {
				return err
			}
		}

		if nn >= 6 {
			if cmd.val[i].ClientName, err = rd.ReadString(); err != nil {
				return err
			}
		}
	}

	return nil
}

//-----------------------------------------------------------------------

type MapStringInterfaceCmd struct {
	baseCmd

	val map[string]interface{}
}

var _ Cmder = (*MapStringInterfaceCmd)(nil)

func NewMapStringInterfaceCmd(ctx context.Context, args ...interface{}) *MapStringInterfaceCmd {
	return &MapStringInterfaceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *MapStringInterfaceCmd) SetVal(val map[string]interface{}) {
	cmd.val = val
}

func (cmd *MapStringInterfaceCmd) Val() map[string]interface{} {
	return cmd.val
}

func (cmd *MapStringInterfaceCmd) Result() (map[string]interface{}, error) {
	return cmd.val, cmd.err
}

func (cmd *MapStringInterfaceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *MapStringInterfaceCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadMapLen()
	if err != nil {
		return err
	}

	cmd.val = make(map[string]interface{}, n)
	for i := 0; i < n; i++ {
		k, err := rd.ReadString()
		if err != nil {
			return err
		}
		v, err := rd.ReadReply()
		if err != nil {
			if err == Nil {
				cmd.val[k] = Nil
				continue
			}
			if err, ok := err.(proto.RedisError); ok {
				cmd.val[k] = err
				continue
			}
			return err
		}
		cmd.val[k] = v
	}
	return nil
}

//-----------------------------------------------------------------------

type MapStringStringSliceCmd struct {
	baseCmd

	val []map[string]string
}

var _ Cmder = (*MapStringStringSliceCmd)(nil)

func NewMapStringStringSliceCmd(ctx context.Context, args ...interface{}) *MapStringStringSliceCmd {
	return &MapStringStringSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *MapStringStringSliceCmd) SetVal(val []map[string]string) {
	cmd.val = val
}

func (cmd *MapStringStringSliceCmd) Val() []map[string]string {
	return cmd.val
}

func (cmd *MapStringStringSliceCmd) Result() ([]map[string]string, error) {
	return cmd.val, cmd.err
}

func (cmd *MapStringStringSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *MapStringStringSliceCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	cmd.val = make([]map[string]string, n)
	for i := 0; i < n; i++ {
		nn, err := rd.ReadMapLen()
		if err != nil {
			return err
		}
		cmd.val[i] = make(map[string]string, nn)
		for f := 0; f < nn; f++ {
			k, err := rd.ReadString()
			if err != nil {
				return err
			}

			v, err := rd.ReadString()
			if err != nil {
				return err
			}
			cmd.val[i][k] = v
		}
	}
	return nil
}

// -----------------------------------------------------------------------

// MapMapStringInterfaceCmd represents a command that returns a map of strings to interface{}.
type MapMapStringInterfaceCmd struct {
	baseCmd
	val map[string]interface{}
}

func NewMapMapStringInterfaceCmd(ctx context.Context, args ...interface{}) *MapMapStringInterfaceCmd {
	return &MapMapStringInterfaceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *MapMapStringInterfaceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *MapMapStringInterfaceCmd) SetVal(val map[string]interface{}) {
	cmd.val = val
}

func (cmd *MapMapStringInterfaceCmd) Result() (map[string]interface{}, error) {
	return cmd.val, cmd.err
}

func (cmd *MapMapStringInterfaceCmd) Val() map[string]interface{} {
	return cmd.val
}

// readReply will try to parse the reply from the proto.Reader for both resp2 and resp3
func (cmd *MapMapStringInterfaceCmd) readReply(rd *proto.Reader) (err error) {
	data, err := rd.ReadReply()
	if err != nil {
		return err
	}
	resultMap := map[string]interface{}{}

	switch midResponse := data.(type) {
	case map[interface{}]interface{}: // resp3 will return map
		for k, v := range midResponse {
			stringKey, ok := k.(string)
			if !ok {
				return fmt.Errorf("redis: invalid map key %#v", k)
			}
			resultMap[stringKey] = v
		}
	case []interface{}: // resp2 will return array of arrays
		n := len(midResponse)
		for i := 0; i < n; i++ {
			finalArr, ok := midResponse[i].([]interface{}) // final array that we need to transform to map
			if !ok {
				return fmt.Errorf("redis: unexpected response %#v", data)
			}
			m := len(finalArr)
			if m%2 != 0 { // since this should be map, keys should be even number
				return fmt.Errorf("redis: unexpected response %#v", data)
			}

			for j := 0; j < m; j += 2 {
				stringKey, ok := finalArr[j].(string) // the first one
				if !ok {
					return fmt.Errorf("redis: invalid map key %#v", finalArr[i])
				}
				resultMap[stringKey] = finalArr[j+1] // second one is value
			}
		}
	default:
		return fmt.Errorf("redis: unexpected response %#v", data)
	}

	cmd.val = resultMap
	return nil
}

//-----------------------------------------------------------------------

type MapStringInterfaceSliceCmd struct {
	baseCmd

	val []map[string]interface{}
}

var _ Cmder = (*MapStringInterfaceSliceCmd)(nil)

func NewMapStringInterfaceSliceCmd(ctx context.Context, args ...interface{}) *MapStringInterfaceSliceCmd {
	return &MapStringInterfaceSliceCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *MapStringInterfaceSliceCmd) SetVal(val []map[string]interface{}) {
	cmd.val = val
}

func (cmd *MapStringInterfaceSliceCmd) Val() []map[string]interface{} {
	return cmd.val
}

func (cmd *MapStringInterfaceSliceCmd) Result() ([]map[string]interface{}, error) {
	return cmd.val, cmd.err
}

func (cmd *MapStringInterfaceSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *MapStringInterfaceSliceCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	cmd.val = make([]map[string]interface{}, n)
	for i := 0; i < n; i++ {
		nn, err := rd.ReadMapLen()
		if err != nil {
			return err
		}
		cmd.val[i] = make(map[string]interface{}, nn)
		for f := 0; f < nn; f++ {
			k, err := rd.ReadString()
			if err != nil {
				return err
			}
			v, err := rd.ReadReply()
			if err != nil {
				if err != Nil {
					return err
				}
			}
			cmd.val[i][k] = v
		}
	}
	return nil
}

//------------------------------------------------------------------------------

type KeyValuesCmd struct {
	baseCmd

	key string
	val []string
}

var _ Cmder = (*KeyValuesCmd)(nil)

func NewKeyValuesCmd(ctx context.Context, args ...interface{}) *KeyValuesCmd {
	return &KeyValuesCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *KeyValuesCmd) SetVal(key string, val []string) {
	cmd.key = key
	cmd.val = val
}

func (cmd *KeyValuesCmd) Val() (string, []string) {
	return cmd.key, cmd.val
}

func (cmd *KeyValuesCmd) Result() (string, []string, error) {
	return cmd.key, cmd.val, cmd.err
}

func (cmd *KeyValuesCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *KeyValuesCmd) readReply(rd *proto.Reader) (err error) {
	if err = rd.ReadFixedArrayLen(2); err != nil {
		return err
	}

	cmd.key, err = rd.ReadString()
	if err != nil {
		return err
	}

	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]string, n)
	for i := 0; i < n; i++ {
		cmd.val[i], err = rd.ReadString()
		if err != nil {
			return err
		}
	}

	return nil
}

//------------------------------------------------------------------------------

type ZSliceWithKeyCmd struct {
	baseCmd

	key string
	val []Z
}

var _ Cmder = (*ZSliceWithKeyCmd)(nil)

func NewZSliceWithKeyCmd(ctx context.Context, args ...interface{}) *ZSliceWithKeyCmd {
	return &ZSliceWithKeyCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *ZSliceWithKeyCmd) SetVal(key string, val []Z) {
	cmd.key = key
	cmd.val = val
}

func (cmd *ZSliceWithKeyCmd) Val() (string, []Z) {
	return cmd.key, cmd.val
}

func (cmd *ZSliceWithKeyCmd) Result() (string, []Z, error) {
	return cmd.key, cmd.val, cmd.err
}

func (cmd *ZSliceWithKeyCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *ZSliceWithKeyCmd) readReply(rd *proto.Reader) (err error) {
	if err = rd.ReadFixedArrayLen(2); err != nil {
		return err
	}

	cmd.key, err = rd.ReadString()
	if err != nil {
		return err
	}

	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	typ, err := rd.PeekReplyType()
	if err != nil {
		return err
	}
	array := typ == proto.RespArray

	if array {
		cmd.val = make([]Z, n)
	} else {
		cmd.val = make([]Z, n/2)
	}

	for i := 0; i < len(cmd.val); i++ {
		if array {
			if err = rd.ReadFixedArrayLen(2); err != nil {
				return err
			}
		}

		if cmd.val[i].Member, err = rd.ReadString(); err != nil {
			return err
		}

		if cmd.val[i].Score, err = rd.ReadFloat(); err != nil {
			return err
		}
	}

	return nil
}

type Function struct {
	Name        string
	Description string
	Flags       []string
}

type Library struct {
	Name      string
	Engine    string
	Functions []Function
	Code      string
}

type FunctionListCmd struct {
	baseCmd

	val []Library
}

var _ Cmder = (*FunctionListCmd)(nil)

func NewFunctionListCmd(ctx context.Context, args ...interface{}) *FunctionListCmd {
	return &FunctionListCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *FunctionListCmd) SetVal(val []Library) {
	cmd.val = val
}

func (cmd *FunctionListCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *FunctionListCmd) Val() []Library {
	return cmd.val
}

func (cmd *FunctionListCmd) Result() ([]Library, error) {
	return cmd.val, cmd.err
}

func (cmd *FunctionListCmd) First() (*Library, error) {
	if cmd.err != nil {
		return nil, cmd.err
	}
	if len(cmd.val) > 0 {
		return &cmd.val[0], nil
	}
	return nil, Nil
}

func (cmd *FunctionListCmd) readReply(rd *proto.Reader) (err error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	libraries := make([]Library, n)
	for i := 0; i < n; i++ {
		nn, err := rd.ReadMapLen()
		if err != nil {
			return err
		}

		library := Library{}
		for f := 0; f < nn; f++ {
			key, err := rd.ReadString()
			if err != nil {
				return err
			}

			switch key {
			case "library_name":
				library.Name, err = rd.ReadString()
			case "engine":
				library.Engine, err = rd.ReadString()
			case "functions":
				library.Functions, err = cmd.readFunctions(rd)
			case "library_code":
				library.Code, err = rd.ReadString()
			default:
				return fmt.Errorf("redis: function list unexpected key %s", key)
			}

			if err != nil {
				return err
			}
		}

		libraries[i] = library
	}
	cmd.val = libraries
	return nil
}

func (cmd *FunctionListCmd) readFunctions(rd *proto.Reader) ([]Function, error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return nil, err
	}

	functions := make([]Function, n)
	for i := 0; i < n; i++ {
		nn, err := rd.ReadMapLen()
		if err != nil {
			return nil, err
		}

		function := Function{}
		for f := 0; f < nn; f++ {
			key, err := rd.ReadString()
			if err != nil {
				return nil, err
			}

			switch key {
			case "name":
				if function.Name, err = rd.ReadString(); err != nil {
					return nil, err
				}
			case "description":
				if function.Description, err = rd.ReadString(); err != nil && err != Nil {
					return nil, err
				}
			case "flags":
				// resp set
				nx, err := rd.ReadArrayLen()
				if err != nil {
					return nil, err
				}

				function.Flags = make([]string, nx)
				for j := 0; j < nx; j++ {
					if function.Flags[j], err = rd.ReadString(); err != nil {
						return nil, err
					}
				}
			default:
				return nil, fmt.Errorf("redis: function list unexpected key %s", key)
			}
		}

		functions[i] = function
	}
	return functions, nil
}

// FunctionStats contains information about the scripts currently executing on the server, and the available engines
//   - Engines:
//     Statistics about the engine like number of functions and number of libraries
//   - RunningScript:
//     The script currently running on the shard we're connecting to.
//     For Redis Enterprise and Redis Cloud, this represents the
//     function with the longest running time, across all the running functions, on all shards
//   - RunningScripts
//     All scripts currently running in a Redis Enterprise clustered database.
//     Only available on Redis Enterprise
type FunctionStats struct {
	Engines   []Engine
	isRunning bool
	rs        RunningScript
	allrs     []RunningScript
}

func (fs *FunctionStats) Running() bool {
	return fs.isRunning
}

func (fs *FunctionStats) RunningScript() (RunningScript, bool) {
	return fs.rs, fs.isRunning
}

// AllRunningScripts returns all scripts currently running in a Redis Enterprise clustered database.
// Only available on Redis Enterprise
func (fs *FunctionStats) AllRunningScripts() []RunningScript {
	return fs.allrs
}

type RunningScript struct {
	Name     string
	Command  []string
	Duration time.Duration
}

type Engine struct {
	Language       string
	LibrariesCount int64
	FunctionsCount int64
}

type FunctionStatsCmd struct {
	baseCmd
	val FunctionStats
}

var _ Cmder = (*FunctionStatsCmd)(nil)

func NewFunctionStatsCmd(ctx context.Context, args ...interface{}) *FunctionStatsCmd {
	return &FunctionStatsCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *FunctionStatsCmd) SetVal(val FunctionStats) {
	cmd.val = val
}

func (cmd *FunctionStatsCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *FunctionStatsCmd) Val() FunctionStats {
	return cmd.val
}

func (cmd *FunctionStatsCmd) Result() (FunctionStats, error) {
	return cmd.val, cmd.err
}

func (cmd *FunctionStatsCmd) readReply(rd *proto.Reader) (err error) {
	n, err := rd.ReadMapLen()
	if err != nil {
		return err
	}

	var key string
	var result FunctionStats
	for f := 0; f < n; f++ {
		key, err = rd.ReadString()
		if err != nil {
			return err
		}

		switch key {
		case "running_script":
			result.rs, result.isRunning, err = cmd.readRunningScript(rd)
		case "engines":
			result.Engines, err = cmd.readEngines(rd)
		case "all_running_scripts": // Redis Enterprise only
			result.allrs, result.isRunning, err = cmd.readRunningScripts(rd)
		default:
			return fmt.Errorf("redis: function stats unexpected key %s", key)
		}

		if err != nil {
			return err
		}
	}

	cmd.val = result
	return nil
}

func (cmd *FunctionStatsCmd) readRunningScript(rd *proto.Reader) (RunningScript, bool, error) {
	err := rd.ReadFixedMapLen(3)
	if err != nil {
		if err == Nil {
			return RunningScript{}, false, nil
		}
		return RunningScript{}, false, err
	}

	var runningScript RunningScript
	for i := 0; i < 3; i++ {
		key, err := rd.ReadString()
		if err != nil {
			return RunningScript{}, false, err
		}

		switch key {
		case "name":
			runningScript.Name, err = rd.ReadString()
		case "duration_ms":
			runningScript.Duration, err = cmd.readDuration(rd)
		case "command":
			runningScript.Command, err = cmd.readCommand(rd)
		default:
			return RunningScript{}, false, fmt.Errorf("redis: function stats unexpected running_script key %s", key)
		}

		if err != nil {
			return RunningScript{}, false, err
		}
	}

	return runningScript, true, nil
}

func (cmd *FunctionStatsCmd) readEngines(rd *proto.Reader) ([]Engine, error) {
	n, err := rd.ReadMapLen()
	if err != nil {
		return nil, err
	}

	engines := make([]Engine, 0, n)
	for i := 0; i < n; i++ {
		engine := Engine{}
		engine.Language, err = rd.ReadString()
		if err != nil {
			return nil, err
		}

		err = rd.ReadFixedMapLen(2)
		if err != nil {
			return nil, fmt.Errorf("redis: function stats unexpected %s engine map length", engine.Language)
		}

		for i := 0; i < 2; i++ {
			key, err := rd.ReadString()
			switch key {
			case "libraries_count":
				engine.LibrariesCount, err = rd.ReadInt()
			case "functions_count":
				engine.FunctionsCount, err = rd.ReadInt()
			}
			if err != nil {
				return nil, err
			}
		}

		engines = append(engines, engine)
	}
	return engines, nil
}

func (cmd *FunctionStatsCmd) readDuration(rd *proto.Reader) (time.Duration, error) {
	t, err := rd.ReadInt()
	if err != nil {
		return time.Duration(0), err
	}
	return time.Duration(t) * time.Millisecond, nil
}

func (cmd *FunctionStatsCmd) readCommand(rd *proto.Reader) ([]string, error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return nil, err
	}

	command := make([]string, 0, n)
	for i := 0; i < n; i++ {
		x, err := rd.ReadString()
		if err != nil {
			return nil, err
		}
		command = append(command, x)
	}

	return command, nil
}

func (cmd *FunctionStatsCmd) readRunningScripts(rd *proto.Reader) ([]RunningScript, bool, error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return nil, false, err
	}

	runningScripts := make([]RunningScript, 0, n)
	for i := 0; i < n; i++ {
		rs, _, err := cmd.readRunningScript(rd)
		if err != nil {
			return nil, false, err
		}
		runningScripts = append(runningScripts, rs)
	}

	return runningScripts, len(runningScripts) > 0, nil
}

//------------------------------------------------------------------------------

// LCSQuery is a parameter used for the LCS command
type LCSQuery struct {
	Key1         string
	Key2         string
	Len          bool
	Idx          bool
	MinMatchLen  int
	WithMatchLen bool
}

// LCSMatch is the result set of the LCS command.
type LCSMatch struct {
	MatchString string
	Matches     []LCSMatchedPosition
	Len         int64
}

type LCSMatchedPosition struct {
	Key1 LCSPosition
	Key2 LCSPosition

	// only for withMatchLen is true
	MatchLen int64
}

type LCSPosition struct {
	Start int64
	End   int64
}

type LCSCmd struct {
	baseCmd

	// 1: match string
	// 2: match len
	// 3: match idx LCSMatch
	readType uint8
	val      *LCSMatch
}

func NewLCSCmd(ctx context.Context, q *LCSQuery) *LCSCmd {
	args := make([]interface{}, 3, 7)
	args[0] = "lcs"
	args[1] = q.Key1
	args[2] = q.Key2

	cmd := &LCSCmd{readType: 1}
	if q.Len {
		cmd.readType = 2
		args = append(args, "len")
	} else if q.Idx {
		cmd.readType = 3
		args = append(args, "idx")
		if q.MinMatchLen != 0 {
			args = append(args, "minmatchlen", q.MinMatchLen)
		}
		if q.WithMatchLen {
			args = append(args, "withmatchlen")
		}
	}
	cmd.baseCmd = baseCmd{
		ctx:  ctx,
		args: args,
	}

	return cmd
}

func (cmd *LCSCmd) SetVal(val *LCSMatch) {
	cmd.val = val
}

func (cmd *LCSCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *LCSCmd) Val() *LCSMatch {
	return cmd.val
}

func (cmd *LCSCmd) Result() (*LCSMatch, error) {
	return cmd.val, cmd.err
}

func (cmd *LCSCmd) readReply(rd *proto.Reader) (err error) {
	lcs := &LCSMatch{}
	switch cmd.readType {
	case 1:
		// match string
		if lcs.MatchString, err = rd.ReadString(); err != nil {
			return err
		}
	case 2:
		// match len
		if lcs.Len, err = rd.ReadInt(); err != nil {
			return err
		}
	case 3:
		// read LCSMatch
		if err = rd.ReadFixedMapLen(2); err != nil {
			return err
		}

		// read matches or len field
		for i := 0; i < 2; i++ {
			key, err := rd.ReadString()
			if err != nil {
				return err
			}

			switch key {
			case "matches":
				// read array of matched positions
				if lcs.Matches, err = cmd.readMatchedPositions(rd); err != nil {
					return err
				}
			case "len":
				// read match length
				if lcs.Len, err = rd.ReadInt(); err != nil {
					return err
				}
			}
		}
	}

	cmd.val = lcs
	return nil
}

func (cmd *LCSCmd) readMatchedPositions(rd *proto.Reader) ([]LCSMatchedPosition, error) {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return nil, err
	}

	positions := make([]LCSMatchedPosition, n)
	for i := 0; i < n; i++ {
		pn, err := rd.ReadArrayLen()
		if err != nil {
			return nil, err
		}

		if positions[i].Key1, err = cmd.readPosition(rd); err != nil {
			return nil, err
		}
		if positions[i].Key2, err = cmd.readPosition(rd); err != nil {
			return nil, err
		}

		// read match length if WithMatchLen is true
		if pn > 2 {
			if positions[i].MatchLen, err = rd.ReadInt(); err != nil {
				return nil, err
			}
		}
	}

	return positions, nil
}

func (cmd *LCSCmd) readPosition(rd *proto.Reader) (pos LCSPosition, err error) {
	if err = rd.ReadFixedArrayLen(2); err != nil {
		return pos, err
	}
	if pos.Start, err = rd.ReadInt(); err != nil {
		return pos, err
	}
	if pos.End, err = rd.ReadInt(); err != nil {
		return pos, err
	}

	return pos, nil
}

// ------------------------------------------------------------------------

type KeyFlags struct {
	Key   string
	Flags []string
}

type KeyFlagsCmd struct {
	baseCmd

	val []KeyFlags
}

var _ Cmder = (*KeyFlagsCmd)(nil)

func NewKeyFlagsCmd(ctx context.Context, args ...interface{}) *KeyFlagsCmd {
	return &KeyFlagsCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *KeyFlagsCmd) SetVal(val []KeyFlags) {
	cmd.val = val
}

func (cmd *KeyFlagsCmd) Val() []KeyFlags {
	return cmd.val
}

func (cmd *KeyFlagsCmd) Result() ([]KeyFlags, error) {
	return cmd.val, cmd.err
}

func (cmd *KeyFlagsCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *KeyFlagsCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	if n == 0 {
		cmd.val = make([]KeyFlags, 0)
		return nil
	}

	cmd.val = make([]KeyFlags, n)

	for i := 0; i < len(cmd.val); i++ {

		if err = rd.ReadFixedArrayLen(2); err != nil {
			return err
		}

		if cmd.val[i].Key, err = rd.ReadString(); err != nil {
			return err
		}
		flagsLen, err := rd.ReadArrayLen()
		if err != nil {
			return err
		}
		cmd.val[i].Flags = make([]string, flagsLen)

		for j := 0; j < flagsLen; j++ {
			if cmd.val[i].Flags[j], err = rd.ReadString(); err != nil {
				return err
			}
		}
	}

	return nil
}

// ---------------------------------------------------------------------------------------------------

type ClusterLink struct {
	Direction           string
	Node                string
	CreateTime          int64
	Events              string
	SendBufferAllocated int64
	SendBufferUsed      int64
}

type ClusterLinksCmd struct {
	baseCmd

	val []ClusterLink
}

var _ Cmder = (*ClusterLinksCmd)(nil)

func NewClusterLinksCmd(ctx context.Context, args ...interface{}) *ClusterLinksCmd {
	return &ClusterLinksCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *ClusterLinksCmd) SetVal(val []ClusterLink) {
	cmd.val = val
}

func (cmd *ClusterLinksCmd) Val() []ClusterLink {
	return cmd.val
}

func (cmd *ClusterLinksCmd) Result() ([]ClusterLink, error) {
	return cmd.val, cmd.err
}

func (cmd *ClusterLinksCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *ClusterLinksCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]ClusterLink, n)

	for i := 0; i < len(cmd.val); i++ {
		m, err := rd.ReadMapLen()
		if err != nil {
			return err
		}

		for j := 0; j < m; j++ {
			key, err := rd.ReadString()
			if err != nil {
				return err
			}

			switch key {
			case "direction":
				cmd.val[i].Direction, err = rd.ReadString()
			case "node":
				cmd.val[i].Node, err = rd.ReadString()
			case "create-time":
				cmd.val[i].CreateTime, err = rd.ReadInt()
			case "events":
				cmd.val[i].Events, err = rd.ReadString()
			case "send-buffer-allocated":
				cmd.val[i].SendBufferAllocated, err = rd.ReadInt()
			case "send-buffer-used":
				cmd.val[i].SendBufferUsed, err = rd.ReadInt()
			default:
				return fmt.Errorf("redis: unexpected key %q in CLUSTER LINKS reply", key)
			}

			if err != nil {
				return err
			}
		}
	}

	return nil
}

// ------------------------------------------------------------------------------------------------------------------

type SlotRange struct {
	Start int64
	End   int64
}

type Node struct {
	ID                string
	Endpoint          string
	IP                string
	Hostname          string
	Port              int64
	TLSPort           int64
	Role              string
	ReplicationOffset int64
	Health            string
}

type ClusterShard struct {
	Slots []SlotRange
	Nodes []Node
}

type ClusterShardsCmd struct {
	baseCmd

	val []ClusterShard
}

var _ Cmder = (*ClusterShardsCmd)(nil)

func NewClusterShardsCmd(ctx context.Context, args ...interface{}) *ClusterShardsCmd {
	return &ClusterShardsCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *ClusterShardsCmd) SetVal(val []ClusterShard) {
	cmd.val = val
}

func (cmd *ClusterShardsCmd) Val() []ClusterShard {
	return cmd.val
}

func (cmd *ClusterShardsCmd) Result() ([]ClusterShard, error) {
	return cmd.val, cmd.err
}

func (cmd *ClusterShardsCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *ClusterShardsCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}
	cmd.val = make([]ClusterShard, n)

	for i := 0; i < n; i++ {
		m, err := rd.ReadMapLen()
		if err != nil {
			return err
		}

		for j := 0; j < m; j++ {
			key, err := rd.ReadString()
			if err != nil {
				return err
			}

			switch key {
			case "slots":
				l, err := rd.ReadArrayLen()
				if err != nil {
					return err
				}
				for k := 0; k < l; k += 2 {
					start, err := rd.ReadInt()
					if err != nil {
						return err
					}

					end, err := rd.ReadInt()
					if err != nil {
						return err
					}

					cmd.val[i].Slots = append(cmd.val[i].Slots, SlotRange{Start: start, End: end})
				}
			case "nodes":
				nodesLen, err := rd.ReadArrayLen()
				if err != nil {
					return err
				}
				cmd.val[i].Nodes = make([]Node, nodesLen)
				for k := 0; k < nodesLen; k++ {
					nodeMapLen, err := rd.ReadMapLen()
					if err != nil {
						return err
					}

					for l := 0; l < nodeMapLen; l++ {
						nodeKey, err := rd.ReadString()
						if err != nil {
							return err
						}

						switch nodeKey {
						case "id":
							cmd.val[i].Nodes[k].ID, err = rd.ReadString()
						case "endpoint":
							cmd.val[i].Nodes[k].Endpoint, err = rd.ReadString()
						case "ip":
							cmd.val[i].Nodes[k].IP, err = rd.ReadString()
						case "hostname":
							cmd.val[i].Nodes[k].Hostname, err = rd.ReadString()
						case "port":
							cmd.val[i].Nodes[k].Port, err = rd.ReadInt()
						case "tls-port":
							cmd.val[i].Nodes[k].TLSPort, err = rd.ReadInt()
						case "role":
							cmd.val[i].Nodes[k].Role, err = rd.ReadString()
						case "replication-offset":
							cmd.val[i].Nodes[k].ReplicationOffset, err = rd.ReadInt()
						case "health":
							cmd.val[i].Nodes[k].Health, err = rd.ReadString()
						default:
							return fmt.Errorf("redis: unexpected key %q in CLUSTER SHARDS node reply", nodeKey)
						}

						if err != nil {
							return err
						}
					}
				}
			default:
				return fmt.Errorf("redis: unexpected key %q in CLUSTER SHARDS reply", key)
			}
		}
	}

	return nil
}

// -----------------------------------------

type RankScore struct {
	Rank  int64
	Score float64
}

type RankWithScoreCmd struct {
	baseCmd

	val RankScore
}

var _ Cmder = (*RankWithScoreCmd)(nil)

func NewRankWithScoreCmd(ctx context.Context, args ...interface{}) *RankWithScoreCmd {
	return &RankWithScoreCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *RankWithScoreCmd) SetVal(val RankScore) {
	cmd.val = val
}

func (cmd *RankWithScoreCmd) Val() RankScore {
	return cmd.val
}

func (cmd *RankWithScoreCmd) Result() (RankScore, error) {
	return cmd.val, cmd.err
}

func (cmd *RankWithScoreCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *RankWithScoreCmd) readReply(rd *proto.Reader) error {
	if err := rd.ReadFixedArrayLen(2); err != nil {
		return err
	}

	rank, err := rd.ReadInt()
	if err != nil {
		return err
	}

	score, err := rd.ReadFloat()
	if err != nil {
		return err
	}

	cmd.val = RankScore{Rank: rank, Score: score}

	return nil
}

// --------------------------------------------------------------------------------------------------

// ClientFlags is redis-server client flags, copy from redis/src/server.h (redis 7.0)
type ClientFlags uint64

const (
	ClientSlave            ClientFlags = 1 << 0  /* This client is a replica */
	ClientMaster           ClientFlags = 1 << 1  /* This client is a master */
	ClientMonitor          ClientFlags = 1 << 2  /* This client is a slave monitor, see MONITOR */
	ClientMulti            ClientFlags = 1 << 3  /* This client is in a MULTI context */
	ClientBlocked          ClientFlags = 1 << 4  /* The client is waiting in a blocking operation */
	ClientDirtyCAS         ClientFlags = 1 << 5  /* Watched keys modified. EXEC will fail. */
	ClientCloseAfterReply  ClientFlags = 1 << 6  /* Close after writing entire reply. */
	ClientUnBlocked        ClientFlags = 1 << 7  /* This client was unblocked and is stored in server.unblocked_clients */
	ClientScript           ClientFlags = 1 << 8  /* This is a non-connected client used by Lua */
	ClientAsking           ClientFlags = 1 << 9  /* Client issued the ASKING command */
	ClientCloseASAP        ClientFlags = 1 << 10 /* Close this client ASAP */
	ClientUnixSocket       ClientFlags = 1 << 11 /* Client connected via Unix domain socket */
	ClientDirtyExec        ClientFlags = 1 << 12 /* EXEC will fail for errors while queueing */
	ClientMasterForceReply ClientFlags = 1 << 13 /* Queue replies even if is master */
	ClientForceAOF         ClientFlags = 1 << 14 /* Force AOF propagation of current cmd. */
	ClientForceRepl        ClientFlags = 1 << 15 /* Force replication of current cmd. */
	ClientPrePSync         ClientFlags = 1 << 16 /* Instance don't understand PSYNC. */
	ClientReadOnly         ClientFlags = 1 << 17 /* Cluster client is in read-only state. */
	ClientPubSub           ClientFlags = 1 << 18 /* Client is in Pub/Sub mode. */
	ClientPreventAOFProp   ClientFlags = 1 << 19 /* Don't propagate to AOF. */
	ClientPreventReplProp  ClientFlags = 1 << 20 /* Don't propagate to slaves. */
	ClientPreventProp      ClientFlags = ClientPreventAOFProp | ClientPreventReplProp
	ClientPendingWrite     ClientFlags = 1 << 21 /* Client has output to send but a-write handler is yet not installed. */
	ClientReplyOff         ClientFlags = 1 << 22 /* Don't send replies to client. */
	ClientReplySkipNext    ClientFlags = 1 << 23 /* Set ClientREPLY_SKIP for next cmd */
	ClientReplySkip        ClientFlags = 1 << 24 /* Don't send just this reply. */
	ClientLuaDebug         ClientFlags = 1 << 25 /* Run EVAL in debug mode. */
	ClientLuaDebugSync     ClientFlags = 1 << 26 /* EVAL debugging without fork() */
	ClientModule           ClientFlags = 1 << 27 /* Non connected client used by some module. */
	ClientProtected        ClientFlags = 1 << 28 /* Client should not be freed for now. */
	ClientExecutingCommand ClientFlags = 1 << 29 /* Indicates that the client is currently in the process of handling
	   a command. usually this will be marked only during call()
	   however, blocked clients might have this flag kept until they
	   will try to reprocess the command. */
	ClientPendingCommand      ClientFlags = 1 << 30 /* Indicates the client has a fully * parsed command ready for execution. */
	ClientTracking            ClientFlags = 1 << 31 /* Client enabled keys tracking in order to perform client side caching. */
	ClientTrackingBrokenRedir ClientFlags = 1 << 32 /* Target client is invalid. */
	ClientTrackingBCAST       ClientFlags = 1 << 33 /* Tracking in BCAST mode. */
	ClientTrackingOptIn       ClientFlags = 1 << 34 /* Tracking in opt-in mode. */
	ClientTrackingOptOut      ClientFlags = 1 << 35 /* Tracking in opt-out mode. */
	ClientTrackingCaching     ClientFlags = 1 << 36 /* CACHING yes/no was given, depending on optin/optout mode. */
	ClientTrackingNoLoop      ClientFlags = 1 << 37 /* Don't send invalidation messages about writes performed by myself.*/
	ClientInTimeoutTable      ClientFlags = 1 << 38 /* This client is in the timeout table. */
	ClientProtocolError       ClientFlags = 1 << 39 /* Protocol error chatting with it. */
	ClientCloseAfterCommand   ClientFlags = 1 << 40 /* Close after executing commands * and writing entire reply. */
	ClientDenyBlocking        ClientFlags = 1 << 41 /* Indicate that the client should not be blocked. currently, turned on inside MULTI, Lua, RM_Call, and AOF client */
	ClientReplRDBOnly         ClientFlags = 1 << 42 /* This client is a replica that only wants RDB without replication buffer. */
	ClientNoEvict             ClientFlags = 1 << 43 /* This client is protected against client memory eviction. */
	ClientAllowOOM            ClientFlags = 1 << 44 /* Client used by RM_Call is allowed to fully execute scripts even when in OOM */
	ClientNoTouch             ClientFlags = 1 << 45 /* This client will not touch LFU/LRU stats. */
	ClientPushing             ClientFlags = 1 << 46 /* This client is pushing notifications. */
)

// ClientInfo is redis-server ClientInfo, not go-redis *Client
type ClientInfo struct {
	ID                 int64         // redis version 2.8.12, a unique 64-bit client ID
	Addr               string        // address/port of the client
	LAddr              string        // address/port of local address client connected to (bind address)
	FD                 int64         // file descriptor corresponding to the socket
	Name               string        // the name set by the client with CLIENT SETNAME
	Age                time.Duration // total duration of the connection in seconds
	Idle               time.Duration // idle time of the connection in seconds
	Flags              ClientFlags   // client flags (see below)
	DB                 int           // current database ID
	Sub                int           // number of channel subscriptions
	PSub               int           // number of pattern matching subscriptions
	SSub               int           // redis version 7.0.3, number of shard channel subscriptions
	Multi              int           // number of commands in a MULTI/EXEC context
	Watch              int           // redis version 7.4 RC1, number of keys this client is currently watching.
	QueryBuf           int           // qbuf, query buffer length (0 means no query pending)
	QueryBufFree       int           // qbuf-free, free space of the query buffer (0 means the buffer is full)
	ArgvMem            int           // incomplete arguments for the next command (already extracted from query buffer)
	MultiMem           int           // redis version 7.0, memory is used up by buffered multi commands
	BufferSize         int           // rbs, usable size of buffer
	BufferPeak         int           // rbp, peak used size of buffer in last 5 sec interval
	OutputBufferLength int           // obl, output buffer length
	OutputListLength   int           // oll, output list length (replies are queued in this list when the buffer is full)
	OutputMemory       int           // omem, output buffer memory usage
	TotalMemory        int           // tot-mem, total memory consumed by this client in its various buffers
	IoThread           int           // io-thread id
	Events             string        // file descriptor events (see below)
	LastCmd            string        // cmd, last command played
	User               string        // the authenticated username of the client
	Redir              int64         // client id of current client tracking redirection
	Resp               int           // redis version 7.0, client RESP protocol version
	LibName            string        // redis version 7.2, client library name
	LibVer             string        // redis version 7.2, client library version
}

type ClientInfoCmd struct {
	baseCmd

	val *ClientInfo
}

var _ Cmder = (*ClientInfoCmd)(nil)

func NewClientInfoCmd(ctx context.Context, args ...interface{}) *ClientInfoCmd {
	return &ClientInfoCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *ClientInfoCmd) SetVal(val *ClientInfo) {
	cmd.val = val
}

func (cmd *ClientInfoCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *ClientInfoCmd) Val() *ClientInfo {
	return cmd.val
}

func (cmd *ClientInfoCmd) Result() (*ClientInfo, error) {
	return cmd.val, cmd.err
}

func (cmd *ClientInfoCmd) readReply(rd *proto.Reader) (err error) {
	txt, err := rd.ReadString()
	if err != nil {
		return err
	}

	// sds o = catClientInfoString(sdsempty(), c);
	// o = sdscatlen(o,"\n",1);
	// addReplyVerbatim(c,o,sdslen(o),"txt");
	// sdsfree(o);
	cmd.val, err = parseClientInfo(strings.TrimSpace(txt))
	return err
}

// fmt.Sscanf() cannot handle null values
func parseClientInfo(txt string) (info *ClientInfo, err error) {
	info = &ClientInfo{}
	for _, s := range strings.Split(txt, " ") {
		kv := strings.Split(s, "=")
		if len(kv) != 2 {
			return nil, fmt.Errorf("redis: unexpected client info data (%s)", s)
		}
		key, val := kv[0], kv[1]

		switch key {
		case "id":
			info.ID, err = strconv.ParseInt(val, 10, 64)
		case "addr":
			info.Addr = val
		case "laddr":
			info.LAddr = val
		case "fd":
			info.FD, err = strconv.ParseInt(val, 10, 64)
		case "name":
			info.Name = val
		case "age":
			var age int
			if age, err = strconv.Atoi(val); err == nil {
				info.Age = time.Duration(age) * time.Second
			}
		case "idle":
			var idle int
			if idle, err = strconv.Atoi(val); err == nil {
				info.Idle = time.Duration(idle) * time.Second
			}
		case "flags":
			if val == "N" {
				break
			}

			for i := 0; i < len(val); i++ {
				switch val[i] {
				case 'S':
					info.Flags |= ClientSlave
				case 'O':
					info.Flags |= ClientSlave | ClientMonitor
				case 'M':
					info.Flags |= ClientMaster
				case 'P':
					info.Flags |= ClientPubSub
				case 'x':
					info.Flags |= ClientMulti
				case 'b':
					info.Flags |= ClientBlocked
				case 't':
					info.Flags |= ClientTracking
				case 'R':
					info.Flags |= ClientTrackingBrokenRedir
				case 'B':
					info.Flags |= ClientTrackingBCAST
				case 'd':
					info.Flags |= ClientDirtyCAS
				case 'c':
					info.Flags |= ClientCloseAfterCommand
				case 'u':
					info.Flags |= ClientUnBlocked
				case 'A':
					info.Flags |= ClientCloseASAP
				case 'U':
					info.Flags |= ClientUnixSocket
				case 'r':
					info.Flags |= ClientReadOnly
				case 'e':
					info.Flags |= ClientNoEvict
				case 'T':
					info.Flags |= ClientNoTouch
				default:
					return nil, fmt.Errorf("redis: unexpected client info flags(%s)", string(val[i]))
				}
			}
		case "db":
			info.DB, err = strconv.Atoi(val)
		case "sub":
			info.Sub, err = strconv.Atoi(val)
		case "psub":
			info.PSub, err = strconv.Atoi(val)
		case "ssub":
			info.SSub, err = strconv.Atoi(val)
		case "multi":
			info.Multi, err = strconv.Atoi(val)
		case "watch":
			info.Watch, err = strconv.Atoi(val)
		case "qbuf":
			info.QueryBuf, err = strconv.Atoi(val)
		case "qbuf-free":
			info.QueryBufFree, err = strconv.Atoi(val)
		case "argv-mem":
			info.ArgvMem, err = strconv.Atoi(val)
		case "multi-mem":
			info.MultiMem, err = strconv.Atoi(val)
		case "rbs":
			info.BufferSize, err = strconv.Atoi(val)
		case "rbp":
			info.BufferPeak, err = strconv.Atoi(val)
		case "obl":
			info.OutputBufferLength, err = strconv.Atoi(val)
		case "oll":
			info.OutputListLength, err = strconv.Atoi(val)
		case "omem":
			info.OutputMemory, err = strconv.Atoi(val)
		case "tot-mem":
			info.TotalMemory, err = strconv.Atoi(val)
		case "events":
			info.Events = val
		case "cmd":
			info.LastCmd = val
		case "user":
			info.User = val
		case "redir":
			info.Redir, err = strconv.ParseInt(val, 10, 64)
		case "resp":
			info.Resp, err = strconv.Atoi(val)
		case "lib-name":
			info.LibName = val
		case "lib-ver":
			info.LibVer = val
		case "io-thread":
			info.IoThread, err = strconv.Atoi(val)
		default:
			return nil, fmt.Errorf("redis: unexpected client info key(%s)", key)
		}

		if err != nil {
			return nil, err
		}
	}

	return info, nil
}

// -------------------------------------------

type ACLLogEntry struct {
	Count                int64
	Reason               string
	Context              string
	Object               string
	Username             string
	AgeSeconds           float64
	ClientInfo           *ClientInfo
	EntryID              int64
	TimestampCreated     int64
	TimestampLastUpdated int64
}

type ACLLogCmd struct {
	baseCmd

	val []*ACLLogEntry
}

var _ Cmder = (*ACLLogCmd)(nil)

func NewACLLogCmd(ctx context.Context, args ...interface{}) *ACLLogCmd {
	return &ACLLogCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *ACLLogCmd) SetVal(val []*ACLLogEntry) {
	cmd.val = val
}

func (cmd *ACLLogCmd) Val() []*ACLLogEntry {
	return cmd.val
}

func (cmd *ACLLogCmd) Result() ([]*ACLLogEntry, error) {
	return cmd.val, cmd.err
}

func (cmd *ACLLogCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *ACLLogCmd) readReply(rd *proto.Reader) error {
	n, err := rd.ReadArrayLen()
	if err != nil {
		return err
	}

	cmd.val = make([]*ACLLogEntry, n)
	for i := 0; i < n; i++ {
		cmd.val[i] = &ACLLogEntry{}
		entry := cmd.val[i]
		respLen, err := rd.ReadMapLen()
		if err != nil {
			return err
		}
		for j := 0; j < respLen; j++ {
			key, err := rd.ReadString()
			if err != nil {
				return err
			}

			switch key {
			case "count":
				entry.Count, err = rd.ReadInt()
			case "reason":
				entry.Reason, err = rd.ReadString()
			case "context":
				entry.Context, err = rd.ReadString()
			case "object":
				entry.Object, err = rd.ReadString()
			case "username":
				entry.Username, err = rd.ReadString()
			case "age-seconds":
				entry.AgeSeconds, err = rd.ReadFloat()
			case "client-info":
				txt, err := rd.ReadString()
				if err != nil {
					return err
				}
				entry.ClientInfo, err = parseClientInfo(strings.TrimSpace(txt))
				if err != nil {
					return err
				}
			case "entry-id":
				entry.EntryID, err = rd.ReadInt()
			case "timestamp-created":
				entry.TimestampCreated, err = rd.ReadInt()
			case "timestamp-last-updated":
				entry.TimestampLastUpdated, err = rd.ReadInt()
			default:
				return fmt.Errorf("redis: unexpected key %q in ACL LOG reply", key)
			}

			if err != nil {
				return err
			}
		}
	}

	return nil
}

// LibraryInfo holds the library info.
type LibraryInfo struct {
	LibName *string
	LibVer  *string
}

// WithLibraryName returns a valid LibraryInfo with library name only.
func WithLibraryName(libName string) LibraryInfo {
	return LibraryInfo{LibName: &libName}
}

// WithLibraryVersion returns a valid LibraryInfo with library version only.
func WithLibraryVersion(libVer string) LibraryInfo {
	return LibraryInfo{LibVer: &libVer}
}

// -------------------------------------------

type InfoCmd struct {
	baseCmd
	val map[string]map[string]string
}

var _ Cmder = (*InfoCmd)(nil)

func NewInfoCmd(ctx context.Context, args ...interface{}) *InfoCmd {
	return &InfoCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: args,
		},
	}
}

func (cmd *InfoCmd) SetVal(val map[string]map[string]string) {
	cmd.val = val
}

func (cmd *InfoCmd) Val() map[string]map[string]string {
	return cmd.val
}

func (cmd *InfoCmd) Result() (map[string]map[string]string, error) {
	return cmd.val, cmd.err
}

func (cmd *InfoCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *InfoCmd) readReply(rd *proto.Reader) error {
	val, err := rd.ReadString()
	if err != nil {
		return err
	}

	section := ""
	scanner := bufio.NewScanner(strings.NewReader(val))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "#") {
			if cmd.val == nil {
				cmd.val = make(map[string]map[string]string)
			}
			section = strings.TrimPrefix(line, "# ")
			cmd.val[section] = make(map[string]string)
		} else if line != "" {
			if section == "Modules" {
				moduleRe := regexp.MustCompile(`module:name=(.+?),(.+)$`)
				kv := moduleRe.FindStringSubmatch(line)
				if len(kv) == 3 {
					cmd.val[section][kv[1]] = kv[2]
				}
			} else {
				kv := strings.SplitN(line, ":", 2)
				if len(kv) == 2 {
					cmd.val[section][kv[0]] = kv[1]
				}
			}
		}
	}

	return nil
}

func (cmd *InfoCmd) Item(section, key string) string {
	if cmd.val == nil {
		return ""
	} else if cmd.val[section] == nil {
		return ""
	} else {
		return cmd.val[section][key]
	}
}

type MonitorStatus int

const (
	monitorStatusIdle MonitorStatus = iota
	monitorStatusStart
	monitorStatusStop
)

type MonitorCmd struct {
	baseCmd
	ch     chan string
	status MonitorStatus
	mu     sync.Mutex
}

func newMonitorCmd(ctx context.Context, ch chan string) *MonitorCmd {
	return &MonitorCmd{
		baseCmd: baseCmd{
			ctx:  ctx,
			args: []interface{}{"monitor"},
		},
		ch:     ch,
		status: monitorStatusIdle,
		mu:     sync.Mutex{},
	}
}

func (cmd *MonitorCmd) String() string {
	return cmdString(cmd, nil)
}

func (cmd *MonitorCmd) readReply(rd *proto.Reader) error {
	ctx, cancel := context.WithCancel(cmd.ctx)
	go func(ctx context.Context) {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				err := cmd.readMonitor(rd, cancel)
				if err != nil {
					cmd.err = err
					return
				}
			}
		}
	}(ctx)
	return nil
}

func (cmd *MonitorCmd) readMonitor(rd *proto.Reader, cancel context.CancelFunc) error {
	for {
		cmd.mu.Lock()
		st := cmd.status
		pk, _ := rd.Peek(1)
		cmd.mu.Unlock()
		if len(pk) != 0 && st == monitorStatusStart {
			cmd.mu.Lock()
			line, err := rd.ReadString()
			cmd.mu.Unlock()
			if err != nil {
				return err
			}
			cmd.ch <- line
		}
		if st == monitorStatusStop {
			cancel()
			break
		}
	}
	return nil
}

func (cmd *MonitorCmd) Start() {
	cmd.mu.Lock()
	defer cmd.mu.Unlock()
	cmd.status = monitorStatusStart
}

func (cmd *MonitorCmd) Stop() {
	cmd.mu.Lock()
	defer cmd.mu.Unlock()
	cmd.status = monitorStatusStop
}
