// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"io"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func (api *API) InitLicense() {
	api.BaseRoutes.License.Handle("/add", api.ApiAdminSystemRequired(addLicense)).Methods("POST")
	api.BaseRoutes.License.Handle("/remove", api.ApiAdminSystemRequired(removeLicense)).Methods("POST")
	api.BaseRoutes.License.Handle("/client_config", api.ApiAppHandler(getClientLicenceConfig)).Methods("GET")
}

func addLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("attempt")
	err := r.ParseMultipartForm(*c.App.Config().FileSettings.MaxFileSize)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	m := r.MultipartForm

	fileArray, ok := m.File["license"]
	if !ok {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.no_file.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if len(fileArray) <= 0 {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.array.app_error", nil, "", http.StatusBadRequest)
		return
	}

	fileData := fileArray[0]

	file, err := fileData.Open()
	if err != nil {
		c.Err = model.NewAppError("addLicense", "api.license.add_license.open.app_error", nil, err.Error(), http.StatusInternalServerError)
		return
	}
	defer file.Close()

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	if license, err := c.App.SaveLicense(buf.Bytes()); err != nil {
		if err.Id == model.EXPIRED_LICENSE_ERROR {
			c.LogAudit("failed - expired or non-started license")
		} else if err.Id == model.INVALID_LICENSE_ERROR {
			c.LogAudit("failed - invalid license")
		} else {
			c.LogAudit("failed - unable to save license")
		}
		c.Err = err
		return
	} else {
		c.LogAudit("success")
		w.Write([]byte(license.ToJson()))
	}
}

func removeLicense(c *Context, w http.ResponseWriter, r *http.Request) {
	c.LogAudit("")

	if err := c.App.RemoveLicense(); err != nil {
		c.Err = err
		return
	}

	rdata := map[string]string{}
	rdata["status"] = "ok"
	w.Write([]byte(model.MapToJson(rdata)))
}

func getClientLicenceConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	useSanitizedLicense := !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM)

	etag := utils.GetClientLicenseEtag(useSanitizedLicense)
	if c.HandleEtag(etag, "Get Client License Config", w, r) {
		return
	}

	var clientLicense map[string]string

	if useSanitizedLicense {
		clientLicense = utils.ClientLicense()
	} else {
		clientLicense = utils.GetSanitizedClientLicense()
	}

	w.Header().Set(model.HEADER_ETAG_SERVER, etag)
	w.Write([]byte(model.MapToJson(clientLicense)))
}
