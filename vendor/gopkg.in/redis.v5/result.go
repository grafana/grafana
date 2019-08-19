package redis

import "time"

// NewCmdResult returns a Cmd initalised with val and err for testing
func NewCmdResult(val interface{}, err error) *Cmd {
	var cmd Cmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewSliceResult returns a SliceCmd initalised with val and err for testing
func NewSliceResult(val []interface{}, err error) *SliceCmd {
	var cmd SliceCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewStatusResult returns a StatusCmd initalised with val and err for testing
func NewStatusResult(val string, err error) *StatusCmd {
	var cmd StatusCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewIntResult returns an IntCmd initalised with val and err for testing
func NewIntResult(val int64, err error) *IntCmd {
	var cmd IntCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewDurationResult returns a DurationCmd initalised with val and err for testing
func NewDurationResult(val time.Duration, err error) *DurationCmd {
	var cmd DurationCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewBoolResult returns a BoolCmd initalised with val and err for testing
func NewBoolResult(val bool, err error) *BoolCmd {
	var cmd BoolCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewStringResult returns a StringCmd initalised with val and err for testing
func NewStringResult(val string, err error) *StringCmd {
	var cmd StringCmd
	cmd.val = []byte(val)
	cmd.setErr(err)
	return &cmd
}

// NewFloatResult returns a FloatCmd initalised with val and err for testing
func NewFloatResult(val float64, err error) *FloatCmd {
	var cmd FloatCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewStringSliceResult returns a StringSliceCmd initalised with val and err for testing
func NewStringSliceResult(val []string, err error) *StringSliceCmd {
	var cmd StringSliceCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewBoolSliceResult returns a BoolSliceCmd initalised with val and err for testing
func NewBoolSliceResult(val []bool, err error) *BoolSliceCmd {
	var cmd BoolSliceCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewStringStringMapResult returns a StringStringMapCmd initalised with val and err for testing
func NewStringStringMapResult(val map[string]string, err error) *StringStringMapCmd {
	var cmd StringStringMapCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewStringIntMapCmdResult returns a StringIntMapCmd initalised with val and err for testing
func NewStringIntMapCmdResult(val map[string]int64, err error) *StringIntMapCmd {
	var cmd StringIntMapCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewZSliceCmdResult returns a ZSliceCmd initalised with val and err for testing
func NewZSliceCmdResult(val []Z, err error) *ZSliceCmd {
	var cmd ZSliceCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewScanCmdResult returns a ScanCmd initalised with val and err for testing
func NewScanCmdResult(keys []string, cursor uint64, err error) *ScanCmd {
	var cmd ScanCmd
	cmd.page = keys
	cmd.cursor = cursor
	cmd.setErr(err)
	return &cmd
}

// NewClusterSlotsCmdResult returns a ClusterSlotsCmd initalised with val and err for testing
func NewClusterSlotsCmdResult(val []ClusterSlot, err error) *ClusterSlotsCmd {
	var cmd ClusterSlotsCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}

// NewGeoLocationCmdResult returns a GeoLocationCmd initalised with val and err for testing
func NewGeoLocationCmdResult(val []GeoLocation, err error) *GeoLocationCmd {
	var cmd GeoLocationCmd
	cmd.locations = val
	cmd.setErr(err)
	return &cmd
}

// NewCommandsInfoCmdResult returns a CommandsInfoCmd initalised with val and err for testing
func NewCommandsInfoCmdResult(val map[string]*CommandInfo, err error) *CommandsInfoCmd {
	var cmd CommandsInfoCmd
	cmd.val = val
	cmd.setErr(err)
	return &cmd
}
