package minisentinel

import (
	"errors"
	"fmt"
	"reflect"
	"time"

	"github.com/google/uuid"
)

// ReplicaInfo - define a redis master
type ReplicaInfo struct {
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
	MasterLinkDownTime    string `mapstructure:"master-link-down-time"`
	MasterLinkStatus      string `mapstructure:"master-link-status"`
	MasterHost            string `mapstructure:"master-host"`
	MasterPort            string `mapstructure:"master-port"`
	SlavePriority         string `mapstructure:"slave-priority"`
	SlaveReplOffset       string `mapstructure:"slave-repl-offset"`
}

func initReplicaInfo(s *Sentinel, opts ...Option) ReplicaInfo {
	o := GetOpts(opts...)
	s.replicaInfo = ReplicaInfo{
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
		MasterLinkDownTime:    "0",
		MasterLinkStatus:      "ok",
		MasterHost:            s.master.Host(),
		MasterPort:            s.master.Port(),
		SlavePriority:         "100",
		SlaveReplOffset:       "1", // far from ideal, we need miniRedis to implement a replication ID capability
	}
	return s.replicaInfo
}

// NewReplicaInfoFromStrings creates a new ReplicaInfo
func NewReplicaInfoFromStrings(s []string) (ReplicaInfo, error) {
	r := ReplicaInfo{}
	if len(s)%2 != 0 {
		return r, errors.New("[]strings not a modulus of 2")
	}

	t := reflect.TypeOf(r)
	v := reflect.ValueOf(&r)

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
	return r, nil
}
