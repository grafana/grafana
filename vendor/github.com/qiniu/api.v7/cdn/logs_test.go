package cdn

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/qiniu/api.v7/kodo"
)

func init() {
	kodo.SetMac(ak, sk)
}

func TestGetCdnLogList(t *testing.T) {
	type args struct {
		date    string
		domains string
	}
	tests := []struct {
		name           string
		args           args
		wantDomainLogs []LogDomainInfo
		wantErr        bool
	}{
		{
			name: "getCdnLogListTest",
			args: args{
				date:    testDate,
				domains: domain,
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotDomainLogs, err := GetCdnLogList(tt.args.date, tt.args.domains)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetCdnLogList() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			fmt.Println(domain, gotDomainLogs)
			if !reflect.DeepEqual(gotDomainLogs, tt.wantDomainLogs) {
				t.Errorf("GetCdnLogList() = %v, want %v", gotDomainLogs, tt.wantDomainLogs)
			}
		})
	}
}
