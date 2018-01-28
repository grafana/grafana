// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (a *App) LoadLicense() {
	utils.RemoveLicense()

	licenseId := ""
	if result := <-a.Srv.Store.System().Get(); result.Err == nil {
		props := result.Data.(model.StringMap)
		licenseId = props[model.SYSTEM_ACTIVE_LICENSE_ID]
	}

	if len(licenseId) != 26 {
		// Lets attempt to load the file from disk since it was missing from the DB
		license, licenseBytes := utils.GetAndValidateLicenseFileFromDisk()

		if license != nil {
			if _, err := a.SaveLicense(licenseBytes); err != nil {
				l4g.Info("Failed to save license key loaded from disk err=%v", err.Error())
			} else {
				licenseId = license.Id
			}
		}
	}

	if result := <-a.Srv.Store.License().Get(licenseId); result.Err == nil {
		record := result.Data.(*model.LicenseRecord)
		utils.LoadLicense([]byte(record.Bytes))
		l4g.Info("License key valid unlocking enterprise features.")
	} else {
		l4g.Info(utils.T("mattermost.load_license.find.warn"))
	}
}

func (a *App) SaveLicense(licenseBytes []byte) (*model.License, *model.AppError) {
	var license *model.License

	if success, licenseStr := utils.ValidateLicense(licenseBytes); success {
		license = model.LicenseFromJson(strings.NewReader(licenseStr))

		if result := <-a.Srv.Store.User().AnalyticsUniqueUserCount(""); result.Err != nil {
			return nil, model.NewAppError("addLicense", "api.license.add_license.invalid_count.app_error", nil, result.Err.Error(), http.StatusBadRequest)
		} else {
			uniqueUserCount := result.Data.(int64)

			if uniqueUserCount > int64(*license.Features.Users) {
				return nil, model.NewAppError("addLicense", "api.license.add_license.unique_users.app_error", map[string]interface{}{"Users": *license.Features.Users, "Count": uniqueUserCount}, "", http.StatusBadRequest)
			}
		}

		if ok := utils.SetLicense(license); !ok {
			return nil, model.NewAppError("addLicense", model.EXPIRED_LICENSE_ERROR, nil, "", http.StatusBadRequest)
		}

		record := &model.LicenseRecord{}
		record.Id = license.Id
		record.Bytes = string(licenseBytes)
		rchan := a.Srv.Store.License().Save(record)

		if result := <-rchan; result.Err != nil {
			a.RemoveLicense()
			return nil, model.NewAppError("addLicense", "api.license.add_license.save.app_error", nil, "err="+result.Err.Error(), http.StatusInternalServerError)
		}

		sysVar := &model.System{}
		sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
		sysVar.Value = license.Id
		schan := a.Srv.Store.System().SaveOrUpdate(sysVar)

		if result := <-schan; result.Err != nil {
			a.RemoveLicense()
			return nil, model.NewAppError("addLicense", "api.license.add_license.save_active.app_error", nil, "", http.StatusInternalServerError)
		}
	} else {
		return nil, model.NewAppError("addLicense", model.INVALID_LICENSE_ERROR, nil, "", http.StatusBadRequest)
	}

	a.ReloadConfig()
	a.InvalidateAllCaches()

	// start job server if necessary - this handles the edge case where a license file is uploaded, but the job server
	// doesn't start until the server is restarted, which prevents the 'run job now' buttons in system console from
	// functioning as expected
	if *a.Config().JobSettings.RunJobs {
		a.Jobs.StartWorkers()
	}
	if *a.Config().JobSettings.RunScheduler {
		a.Jobs.StartSchedulers()
	}

	return license, nil
}

func (a *App) RemoveLicense() *model.AppError {
	utils.RemoveLicense()

	sysVar := &model.System{}
	sysVar.Name = model.SYSTEM_ACTIVE_LICENSE_ID
	sysVar.Value = ""

	if result := <-a.Srv.Store.System().SaveOrUpdate(sysVar); result.Err != nil {
		utils.RemoveLicense()
		return result.Err
	}

	a.ReloadConfig()

	a.InvalidateAllCaches()

	return nil
}
