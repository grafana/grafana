// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

const (
	COMPLIANCE_STATUS_CREATED  = "created"
	COMPLIANCE_STATUS_RUNNING  = "running"
	COMPLIANCE_STATUS_FINISHED = "finished"
	COMPLIANCE_STATUS_FAILED   = "failed"
	COMPLIANCE_STATUS_REMOVED  = "removed"

	COMPLIANCE_TYPE_DAILY = "daily"
	COMPLIANCE_TYPE_ADHOC = "adhoc"
)

type Compliance struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	UserId   string `json:"user_id"`
	Status   string `json:"status"`
	Count    int    `json:"count"`
	Desc     string `json:"desc"`
	Type     string `json:"type"`
	StartAt  int64  `json:"start_at"`
	EndAt    int64  `json:"end_at"`
	Keywords string `json:"keywords"`
	Emails   string `json:"emails"`
}

type Compliances []Compliance

func (o *Compliance) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (me *Compliance) PreSave() {
	if me.Id == "" {
		me.Id = NewId()
	}

	if me.Status == "" {
		me.Status = COMPLIANCE_STATUS_CREATED
	}

	me.Count = 0
	me.Emails = strings.ToLower(me.Emails)
	me.Keywords = strings.ToLower(me.Keywords)

	me.CreateAt = GetMillis()
}

func (me *Compliance) JobName() string {
	jobName := me.Type
	if me.Type == COMPLIANCE_TYPE_DAILY {
		jobName += "-" + me.Desc
	}

	jobName += "-" + me.Id

	return jobName
}

func (me *Compliance) IsValid() *AppError {

	if len(me.Id) != 26 {
		return NewAppError("Compliance.IsValid", "model.compliance.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if me.CreateAt == 0 {
		return NewAppError("Compliance.IsValid", "model.compliance.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if len(me.Desc) > 512 || len(me.Desc) == 0 {
		return NewAppError("Compliance.IsValid", "model.compliance.is_valid.desc.app_error", nil, "", http.StatusBadRequest)
	}

	if me.StartAt == 0 {
		return NewAppError("Compliance.IsValid", "model.compliance.is_valid.start_at.app_error", nil, "", http.StatusBadRequest)
	}

	if me.EndAt == 0 {
		return NewAppError("Compliance.IsValid", "model.compliance.is_valid.end_at.app_error", nil, "", http.StatusBadRequest)
	}

	if me.EndAt <= me.StartAt {
		return NewAppError("Compliance.IsValid", "model.compliance.is_valid.start_end_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func ComplianceFromJson(data io.Reader) *Compliance {
	decoder := json.NewDecoder(data)
	var o Compliance
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o Compliances) ToJson() string {
	if b, err := json.Marshal(o); err != nil {
		return "[]"
	} else {
		return string(b)
	}
}

func CompliancesFromJson(data io.Reader) Compliances {
	decoder := json.NewDecoder(data)
	var o Compliances
	err := decoder.Decode(&o)
	if err == nil {
		return o
	} else {
		return nil
	}
}
