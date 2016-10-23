package xorm

import "testing"

func TestSplitTag(t *testing.T) {
	var cases = []struct {
		tag  string
		tags []string
	}{
		{"not null default '2000-01-01 00:00:00' TIMESTAMP", []string{"not", "null", "default", "'2000-01-01 00:00:00'", "TIMESTAMP"}},
		{"TEXT", []string{"TEXT"}},
		{"default('2000-01-01 00:00:00')", []string{"default('2000-01-01 00:00:00')"}},
		{"json  binary", []string{"json", "binary"}},
	}

	for _, kase := range cases {
		tags := splitTag(kase.tag)
		if !sliceEq(tags, kase.tags) {
			t.Fatalf("[%d]%v is not equal [%d]%v", len(tags), tags, len(kase.tags), kase.tags)
		}
	}
}
