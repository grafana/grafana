// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestLicenseStore(t *testing.T, ss store.Store) {
	t.Run("Save", func(t *testing.T) { testLicenseStoreSave(t, ss) })
	t.Run("Get", func(t *testing.T) { testLicenseStoreGet(t, ss) })
}

func testLicenseStoreSave(t *testing.T, ss store.Store) {
	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	if err := (<-ss.License().Save(&l1)).Err; err != nil {
		t.Fatal("couldn't save license record", err)
	}

	if err := (<-ss.License().Save(&l1)).Err; err != nil {
		t.Fatal("shouldn't fail on trying to save existing license record", err)
	}

	l1.Id = ""

	if err := (<-ss.License().Save(&l1)).Err; err == nil {
		t.Fatal("should fail on invalid license", err)
	}
}

func testLicenseStoreGet(t *testing.T, ss store.Store) {
	l1 := model.LicenseRecord{}
	l1.Id = model.NewId()
	l1.Bytes = "junk"

	store.Must(ss.License().Save(&l1))

	if r := <-ss.License().Get(l1.Id); r.Err != nil {
		t.Fatal("couldn't get license", r.Err)
	} else {
		if r.Data.(*model.LicenseRecord).Bytes != l1.Bytes {
			t.Fatal("license bytes didn't match")
		}
	}

	if err := (<-ss.License().Get("missing")).Err; err == nil {
		t.Fatal("should fail on get license", err)
	}
}
