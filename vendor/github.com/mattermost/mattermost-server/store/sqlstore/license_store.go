// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlLicenseStore struct {
	SqlStore
}

func NewSqlLicenseStore(sqlStore SqlStore) store.LicenseStore {
	ls := &SqlLicenseStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.LicenseRecord{}, "Licenses").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("Bytes").SetMaxSize(10000)
	}

	return ls
}

func (ls SqlLicenseStore) CreateIndexesIfNotExists() {
}

func (ls SqlLicenseStore) Save(license *model.LicenseRecord) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		license.PreSave()
		if result.Err = license.IsValid(); result.Err != nil {
			return
		}

		// Only insert if not exists
		if err := ls.GetReplica().SelectOne(&model.LicenseRecord{}, "SELECT * FROM Licenses WHERE Id = :Id", map[string]interface{}{"Id": license.Id}); err != nil {
			if err := ls.GetMaster().Insert(license); err != nil {
				result.Err = model.NewAppError("SqlLicenseStore.Save", "store.sql_license.save.app_error", nil, "license_id="+license.Id+", "+err.Error(), http.StatusInternalServerError)
			} else {
				result.Data = license
			}
		}
	})
}

func (ls SqlLicenseStore) Get(id string) store.StoreChannel {
	return store.Do(func(result *store.StoreResult) {
		if obj, err := ls.GetReplica().Get(model.LicenseRecord{}, id); err != nil {
			result.Err = model.NewAppError("SqlLicenseStore.Get", "store.sql_license.get.app_error", nil, "license_id="+id+", "+err.Error(), http.StatusInternalServerError)
		} else if obj == nil {
			result.Err = model.NewAppError("SqlLicenseStore.Get", "store.sql_license.get.missing.app_error", nil, "license_id="+id, http.StatusNotFound)
		} else {
			result.Data = obj.(*model.LicenseRecord)
		}
	})
}
