package conf

import (
	"strings"
	"testing"

	"github.com/qiniu/x/rpc.v7"
)

func TestUA(t *testing.T) {
	err := SetAppName("")
	if err != nil {
		t.Fatal("expect no error")
	}
	err = SetAppName("错误的UA")
	if err == nil {
		t.Fatal("expect an invalid ua format")
	}
	err = SetAppName("Test0-_.")
	if err != nil {
		t.Fatal("expect no error")
	}
}

func TestFormat(t *testing.T) {
	str := "tesT0.-_"
	SetAppName(str)
	v := rpc.UserAgent
	if !strings.Contains(v, str) {
		t.Fatal("should include user")
	}
	if !strings.HasPrefix(v, "QiniuGo/"+version) {
		t.Fatal("invalid format")
	}
}
