package redis

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"gopkg.in/bufio.v1"
)

var (
	_ Cmder = (*Cmd)(nil)
	_ Cmder = (*SliceCmd)(nil)
	_ Cmder = (*StatusCmd)(nil)
	_ Cmder = (*IntCmd)(nil)
	_ Cmder = (*DurationCmd)(nil)
	_ Cmder = (*BoolCmd)(nil)
	_ Cmder = (*StringCmd)(nil)
	_ Cmder = (*FloatCmd)(nil)
	_ Cmder = (*StringSliceCmd)(nil)
	_ Cmder = (*BoolSliceCmd)(nil)
	_ Cmder = (*StringStringMapCmd)(nil)
	_ Cmder = (*ZSliceCmd)(nil)
	_ Cmder = (*ScanCmd)(nil)
)

type Cmder interface {
	args() []string
	parseReply(*bufio.Reader) error
	setErr(error)

	writeTimeout() *time.Duration
	readTimeout() *time.Duration

	Err() error
	String() string
}

func setCmdsErr(cmds []Cmder, e error) {
	for _, cmd := range cmds {
		cmd.setErr(e)
	}
}

func cmdString(cmd Cmder, val interface{}) string {
	s := strings.Join(cmd.args(), " ")
	if err := cmd.Err(); err != nil {
		return s + ": " + err.Error()
	}
	if val != nil {
		return s + ": " + fmt.Sprint(val)
	}
	return s

}

//------------------------------------------------------------------------------

type baseCmd struct {
	_args []string

	err error

	_writeTimeout, _readTimeout *time.Duration
}

func newBaseCmd(args ...string) *baseCmd {
	return &baseCmd{
		_args: args,
	}
}

func (cmd *baseCmd) Err() error {
	if cmd.err != nil {
		return cmd.err
	}
	return nil
}

func (cmd *baseCmd) args() []string {
	return cmd._args
}

func (cmd *baseCmd) readTimeout() *time.Duration {
	return cmd._readTimeout
}

func (cmd *baseCmd) setReadTimeout(d time.Duration) {
	cmd._readTimeout = &d
}

func (cmd *baseCmd) writeTimeout() *time.Duration {
	return cmd._writeTimeout
}

func (cmd *baseCmd) setWriteTimeout(d time.Duration) {
	cmd._writeTimeout = &d
}

func (cmd *baseCmd) setErr(e error) {
	cmd.err = e
}

//------------------------------------------------------------------------------

type Cmd struct {
	*baseCmd

	val interface{}
}

func NewCmd(args ...string) *Cmd {
	return &Cmd{
		baseCmd: newBaseCmd(args...),
	}
}

func (cmd *Cmd) Val() interface{} {
	return cmd.val
}

func (cmd *Cmd) Result() (interface{}, error) {
	return cmd.val, cmd.err
}

func (cmd *Cmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *Cmd) parseReply(rd *bufio.Reader) error {
	cmd.val, cmd.err = parseReply(rd, parseSlice)
	return cmd.err
}

//------------------------------------------------------------------------------

type SliceCmd struct {
	*baseCmd

	val []interface{}
}

func NewSliceCmd(args ...string) *SliceCmd {
	return &SliceCmd{
		baseCmd: newBaseCmd(args...),
	}
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

func (cmd *SliceCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, parseSlice)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = v.([]interface{})
	return nil
}

//------------------------------------------------------------------------------

type StatusCmd struct {
	*baseCmd

	val string
}

func NewStatusCmd(args ...string) *StatusCmd {
	return &StatusCmd{
		baseCmd: newBaseCmd(args...),
	}
}

func (cmd *StatusCmd) Val() string {
	return cmd.val
}

func (cmd *StatusCmd) Result() (string, error) {
	return cmd.val, cmd.err
}

func (cmd *StatusCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *StatusCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, nil)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = v.(string)
	return nil
}

//------------------------------------------------------------------------------

type IntCmd struct {
	*baseCmd

	val int64
}

func NewIntCmd(args ...string) *IntCmd {
	return &IntCmd{
		baseCmd: newBaseCmd(args...),
	}
}

func (cmd *IntCmd) Val() int64 {
	return cmd.val
}

func (cmd *IntCmd) Result() (int64, error) {
	return cmd.val, cmd.err
}

func (cmd *IntCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *IntCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, nil)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = v.(int64)
	return nil
}

//------------------------------------------------------------------------------

type DurationCmd struct {
	*baseCmd

	val       time.Duration
	precision time.Duration
}

func NewDurationCmd(precision time.Duration, args ...string) *DurationCmd {
	return &DurationCmd{
		baseCmd:   newBaseCmd(args...),
		precision: precision,
	}
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

func (cmd *DurationCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, nil)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = time.Duration(v.(int64)) * cmd.precision
	return nil
}

//------------------------------------------------------------------------------

type BoolCmd struct {
	*baseCmd

	val bool
}

func NewBoolCmd(args ...string) *BoolCmd {
	return &BoolCmd{
		baseCmd: newBaseCmd(args...),
	}
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

func (cmd *BoolCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, nil)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = v.(int64) == 1
	return nil
}

//------------------------------------------------------------------------------

type StringCmd struct {
	*baseCmd

	val string
}

func NewStringCmd(args ...string) *StringCmd {
	return &StringCmd{
		baseCmd: newBaseCmd(args...),
	}
}

func (cmd *StringCmd) Val() string {
	return cmd.val
}

func (cmd *StringCmd) Result() (string, error) {
	return cmd.val, cmd.err
}

func (cmd *StringCmd) Int64() (int64, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return strconv.ParseInt(cmd.val, 10, 64)
}

func (cmd *StringCmd) Uint64() (uint64, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return strconv.ParseUint(cmd.val, 10, 64)
}

func (cmd *StringCmd) Float64() (float64, error) {
	if cmd.err != nil {
		return 0, cmd.err
	}
	return strconv.ParseFloat(cmd.val, 64)
}

func (cmd *StringCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *StringCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, nil)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = v.(string)
	return nil
}

//------------------------------------------------------------------------------

type FloatCmd struct {
	*baseCmd

	val float64
}

func NewFloatCmd(args ...string) *FloatCmd {
	return &FloatCmd{
		baseCmd: newBaseCmd(args...),
	}
}

func (cmd *FloatCmd) Val() float64 {
	return cmd.val
}

func (cmd *FloatCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *FloatCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, nil)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val, cmd.err = strconv.ParseFloat(v.(string), 64)
	return cmd.err
}

//------------------------------------------------------------------------------

type StringSliceCmd struct {
	*baseCmd

	val []string
}

func NewStringSliceCmd(args ...string) *StringSliceCmd {
	return &StringSliceCmd{
		baseCmd: newBaseCmd(args...),
	}
}

func (cmd *StringSliceCmd) Val() []string {
	return cmd.val
}

func (cmd *StringSliceCmd) Result() ([]string, error) {
	return cmd.Val(), cmd.Err()
}

func (cmd *StringSliceCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *StringSliceCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, parseStringSlice)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = v.([]string)
	return nil
}

//------------------------------------------------------------------------------

type BoolSliceCmd struct {
	*baseCmd

	val []bool
}

func NewBoolSliceCmd(args ...string) *BoolSliceCmd {
	return &BoolSliceCmd{
		baseCmd: newBaseCmd(args...),
	}
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

func (cmd *BoolSliceCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, parseBoolSlice)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = v.([]bool)
	return nil
}

//------------------------------------------------------------------------------

type StringStringMapCmd struct {
	*baseCmd

	val map[string]string
}

func NewStringStringMapCmd(args ...string) *StringStringMapCmd {
	return &StringStringMapCmd{
		baseCmd: newBaseCmd(args...),
	}
}

func (cmd *StringStringMapCmd) Val() map[string]string {
	return cmd.val
}

func (cmd *StringStringMapCmd) Result() (map[string]string, error) {
	return cmd.val, cmd.err
}

func (cmd *StringStringMapCmd) String() string {
	return cmdString(cmd, cmd.val)
}

func (cmd *StringStringMapCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, parseStringStringMap)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = v.(map[string]string)
	return nil
}

//------------------------------------------------------------------------------

type ZSliceCmd struct {
	*baseCmd

	val []Z
}

func NewZSliceCmd(args ...string) *ZSliceCmd {
	return &ZSliceCmd{
		baseCmd: newBaseCmd(args...),
	}
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

func (cmd *ZSliceCmd) parseReply(rd *bufio.Reader) error {
	v, err := parseReply(rd, parseZSlice)
	if err != nil {
		cmd.err = err
		return err
	}
	cmd.val = v.([]Z)
	return nil
}

//------------------------------------------------------------------------------

type ScanCmd struct {
	*baseCmd

	cursor int64
	keys   []string
}

func NewScanCmd(args ...string) *ScanCmd {
	return &ScanCmd{
		baseCmd: newBaseCmd(args...),
	}
}

func (cmd *ScanCmd) Val() (int64, []string) {
	return cmd.cursor, cmd.keys
}

func (cmd *ScanCmd) Result() (int64, []string, error) {
	return cmd.cursor, cmd.keys, cmd.err
}

func (cmd *ScanCmd) String() string {
	return cmdString(cmd, cmd.keys)
}

func (cmd *ScanCmd) parseReply(rd *bufio.Reader) error {
	vi, err := parseReply(rd, parseSlice)
	if err != nil {
		cmd.err = err
		return cmd.err
	}
	v := vi.([]interface{})

	cmd.cursor, cmd.err = strconv.ParseInt(v[0].(string), 10, 64)
	if cmd.err != nil {
		return cmd.err
	}

	keys := v[1].([]interface{})
	for _, keyi := range keys {
		cmd.keys = append(cmd.keys, keyi.(string))
	}

	return nil
}
