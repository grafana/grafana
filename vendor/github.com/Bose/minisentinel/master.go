package minisentinel

import (
	"errors"
	"fmt"
	"reflect"
	"time"

	"github.com/google/uuid"
)

// MasterInfo - define a redis master
type MasterInfo struct {
	Name                  string `mapstructure:"name"`
	IP                    string `mapstructure:"ip"`
	Port                  string `mapstructure:"port"`
	RunID                 string `mapstructure:"runid"`
	Flags                 string `mapstructure:"flags"`
	LinkPendingCommands   string `mapstructure:"link-pending-commands"`
	LinkRefCount          string `mapstructure:"link-refcount"`
	LastPingSent          string `mapstructure:"last-ping-sent"`
	LastOkPingReply       string `mapstructure:"last-ok-ping-reply"`
	LastPingReply         string `mapstructure:"last-ping-reply"`
	DownAfterMilliseconds string `mapstructure:"down-after-milliseconds"`
	InfoRefresh           string `mapstructure:"info-refresh"`
	RoleReported          string `mapstructure:"role-reported"`
	RoleReportedTime      string `mapstructure:"role-reported-time"`
	ConfigEpoch           string `mapstructure:"config-epoch"`
	NumSlaves             string `mapstructure:"num-slaves"`
	NumOtherSentinels     string `mapstructure:"num-other-sentinels"`
	Quorum                string `mapstructure:"quorum"`
	FailoverTimeout       string `mapstructure:"failover-timeout"`
	ParallelSync          string `mapstructure:"parallel-syncs"`
}

func initMasterInfo(s *Sentinel, opts ...Option) MasterInfo {
	o := GetOpts(opts...)
	s.masterInfo = MasterInfo{
		Name:                  o.masterName,
		IP:                    s.master.Host(),
		Port:                  s.master.Port(),
		RunID:                 uuid.New().String(),
		Flags:                 "master",
		LinkPendingCommands:   "0",
		LinkRefCount:          "1",
		LastPingSent:          "0",
		LastOkPingReply:       "0",
		LastPingReply:         "0",
		DownAfterMilliseconds: "5000",
		InfoRefresh:           "6295",
		RoleReported:          "master",
		RoleReportedTime:      fmt.Sprintf("%d", time.Now().Unix()),
		ConfigEpoch:           "1",
		NumSlaves:             "1", // only supporting 1 replica
		NumOtherSentinels:     "0",
		Quorum:                "1",
		FailoverTimeout:       "60000",
		ParallelSync:          "1",
	}
	return s.masterInfo
}

// NewMasterInfoFromStrings creates a new MasterInfo
func NewMasterInfoFromStrings(s []string) (MasterInfo, error) {
	m := MasterInfo{}
	if len(s)%2 != 0 {
		return m, errors.New("[]strings not a modulus of 2")
	}

	t := reflect.TypeOf(m)
	v := reflect.ValueOf(&m)

	// Iterate over all available fields and read the tag value
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		tag := field.Tag.Get("mapstructure")
		// find the tag in s []string
		for si, sv := range s {
			if si%2 != 0 {
				continue
			}
			if sv == tag {
				if len(s) >= si+1 {
					v.Elem().Field(i).SetString(s[si+1])
				}
				break
			}
		}
	}
	return m, nil
}
