package cdn

import (
	"math/rand"
	"os"
	"reflect"
	"strconv"
	"testing"

	"time"

	"github.com/qiniu/api.v7/kodo"
)

var (
	ak             = os.Getenv("QINIU_ACCESS_KEY")
	sk             = os.Getenv("QINIU_SECRET_KEY")
	domain         = os.Getenv("QINIU_TEST_DOMAIN")
	testBucketName = os.Getenv("QINIU_TEST_BUCKET")

	testDate = time.Now().AddDate(0, 0, -3).Format("2006-01-02")
	bucket   = newBucket()
	client   *kodo.Client
	testKey  = "fusionTest"
	testURL  string
)

func init() {
	kodo.SetMac(ak, sk)
	rand.Seed(time.Now().UnixNano())
	testKey += strconv.Itoa(rand.Int())
	bucket.PutFile(nil, nil, testKey, "doc.go", nil)
	testURL = domain + "/" + testKey

}

func TestGetBandWidthData(t *testing.T) {
	type args struct {
		startDate   string
		endDate     string
		granularity string
		domainList  []string
	}
	tests := []struct {
		name        string
		args        args
		wantTraffic TrafficResp
		wantErr     bool
	}{
		{
			name: "BandWidthTest_1",
			args: args{
				testDate,
				testDate,
				"5min",
				[]string{domain},
			},
		},
	}
	kodo.SetMac(ak, sk)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := GetBandWidthData(tt.args.startDate, tt.args.endDate, tt.args.granularity, tt.args.domainList)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetBandWidthData() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

		})
	}
}

func TestGetFluxData(t *testing.T) {
	type args struct {
		startDate   string
		endDate     string
		granularity string
		domainList  []string
	}
	tests := []struct {
		name        string
		args        args
		wantTraffic TrafficResp
		wantErr     bool
	}{
		{
			name: "BandWidthTest_1",
			args: args{
				testDate,
				testDate,
				"5min",
				[]string{domain},
			},
		},
	}
	kodo.SetMac(ak, sk)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := GetFluxData(tt.args.startDate, tt.args.endDate, tt.args.granularity, tt.args.domainList)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetFluxData() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}

func TestRefreshUrlsAndDirs(t *testing.T) {
	kodo.SetMac(ak, sk)

	type args struct {
		urls []string
		dirs []string
	}
	tests := []struct {
		name       string
		args       args
		wantResult RefreshResp
		wantErr    bool
	}{
		{
			name: "refresh_test_1",
			args: args{
				urls: []string{testURL},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := RefreshUrlsAndDirs(tt.args.urls, tt.args.dirs)
			if (err != nil) != tt.wantErr {
				t.Errorf("RefreshUrlsAndDirs() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

		})
	}
}

func TestRefreshUrls(t *testing.T) {
	type args struct {
		urls []string
	}
	tests := []struct {
		name       string
		args       args
		wantResult RefreshResp
		wantErr    bool
	}{
		{
			name: "refresh_test_1",
			args: args{
				urls: []string{testURL},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := RefreshUrls(tt.args.urls)
			if (err != nil) != tt.wantErr {
				t.Errorf("RefreshUrls() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}

func TestRefreshDirs(t *testing.T) {
	type args struct {
		dirs []string
	}
	tests := []struct {
		name       string
		args       args
		wantResult RefreshResp
		wantErr    bool
	}{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotResult, err := RefreshDirs(tt.args.dirs)
			if (err != nil) != tt.wantErr {
				t.Errorf("RefreshDirs() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(gotResult, tt.wantResult) {
				t.Errorf("RefreshDirs() = %v, want %v", gotResult, tt.wantResult)
			}
		})
	}
}

func TestPrefetchUrls(t *testing.T) {
	type args struct {
		urls []string
	}
	tests := []struct {
		name       string
		args       args
		wantResult PrefetchResp
		wantErr    bool
	}{
		{
			name: "refresh_test_1",
			args: args{
				urls: []string{testURL},
			},
			wantErr: false,
		},
	}
	kodo.SetMac(ak, sk)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := PrefetchUrls(tt.args.urls)
			if (err != nil) != tt.wantErr {
				t.Errorf("PrefetchUrls() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}

func newBucket() (bucket kodo.Bucket) {

	ak := os.Getenv("QINIU_ACCESS_KEY")
	sk := os.Getenv("QINIU_SECRET_KEY")
	if ak == "" || sk == "" {
		panic("require ACCESS_KEY & SECRET_KEY")
	}
	kodo.SetMac(ak, sk)

	testBucketName = os.Getenv("QINIU_TEST_BUCKET")
	domain = os.Getenv("QINIU_TEST_DOMAIN")
	if testBucketName == "" || domain == "" {
		panic("require test env")
	}
	client = kodo.NewWithoutZone(nil)

	return client.Bucket(testBucketName)
}
