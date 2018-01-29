// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	TEAM_OPEN                       = "O"
	TEAM_INVITE                     = "I"
	TEAM_ALLOWED_DOMAINS_MAX_LENGTH = 500
	TEAM_COMPANY_NAME_MAX_LENGTH    = 64
	TEAM_DESCRIPTION_MAX_LENGTH     = 255
	TEAM_DISPLAY_NAME_MAX_RUNES     = 64
	TEAM_EMAIL_MAX_LENGTH           = 128
	TEAM_NAME_MAX_LENGTH            = 64
	TEAM_NAME_MIN_LENGTH            = 2
)

type Team struct {
	Id              string `json:"id"`
	CreateAt        int64  `json:"create_at"`
	UpdateAt        int64  `json:"update_at"`
	DeleteAt        int64  `json:"delete_at"`
	DisplayName     string `json:"display_name"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	Email           string `json:"email"`
	Type            string `json:"type"`
	CompanyName     string `json:"company_name"`
	AllowedDomains  string `json:"allowed_domains"`
	InviteId        string `json:"invite_id"`
	AllowOpenInvite bool   `json:"allow_open_invite"`
}

type TeamPatch struct {
	DisplayName     *string `json:"display_name"`
	Description     *string `json:"description"`
	CompanyName     *string `json:"company_name"`
	InviteId        *string `json:"invite_id"`
	AllowOpenInvite *bool   `json:"allow_open_invite"`
}

type Invites struct {
	Invites []map[string]string `json:"invites"`
}

func InvitesFromJson(data io.Reader) *Invites {
	decoder := json.NewDecoder(data)
	var o Invites
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func (o *Invites) ToEmailList() []string {
	emailList := make([]string, len(o.Invites))
	for _, invite := range o.Invites {
		emailList = append(emailList, invite["email"])
	}
	return emailList
}

func (o *Invites) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (o *Team) ToJson() string {
	b, err := json.Marshal(o)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func TeamFromJson(data io.Reader) *Team {
	decoder := json.NewDecoder(data)
	var o Team
	err := decoder.Decode(&o)
	if err == nil {
		return &o
	} else {
		return nil
	}
}

func TeamMapToJson(u map[string]*Team) string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func TeamMapFromJson(data io.Reader) map[string]*Team {
	decoder := json.NewDecoder(data)
	var teams map[string]*Team
	err := decoder.Decode(&teams)
	if err == nil {
		return teams
	} else {
		return nil
	}
}

func TeamListToJson(t []*Team) string {
	b, err := json.Marshal(t)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func TeamListFromJson(data io.Reader) []*Team {
	decoder := json.NewDecoder(data)
	var teams []*Team
	err := decoder.Decode(&teams)
	if err == nil {
		return teams
	} else {
		return nil
	}
}

func (o *Team) Etag() string {
	return Etag(o.Id, o.UpdateAt)
}

func (o *Team) IsValid() *AppError {

	if len(o.Id) != 26 {
		return NewAppError("Team.IsValid", "model.team.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("Team.IsValid", "model.team.is_valid.create_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if o.UpdateAt == 0 {
		return NewAppError("Team.IsValid", "model.team.is_valid.update_at.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.Email) > TEAM_EMAIL_MAX_LENGTH {
		return NewAppError("Team.IsValid", "model.team.is_valid.email.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.Email) > 0 && !IsValidEmail(o.Email) {
		return NewAppError("Team.IsValid", "model.team.is_valid.email.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if utf8.RuneCountInString(o.DisplayName) == 0 || utf8.RuneCountInString(o.DisplayName) > TEAM_DISPLAY_NAME_MAX_RUNES {
		return NewAppError("Team.IsValid", "model.team.is_valid.name.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.Name) > TEAM_NAME_MAX_LENGTH {
		return NewAppError("Team.IsValid", "model.team.is_valid.url.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.Description) > TEAM_DESCRIPTION_MAX_LENGTH {
		return NewAppError("Team.IsValid", "model.team.is_valid.description.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if IsReservedTeamName(o.Name) {
		return NewAppError("Team.IsValid", "model.team.is_valid.reserved.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !IsValidTeamName(o.Name) {
		return NewAppError("Team.IsValid", "model.team.is_valid.characters.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if !(o.Type == TEAM_OPEN || o.Type == TEAM_INVITE) {
		return NewAppError("Team.IsValid", "model.team.is_valid.type.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.CompanyName) > TEAM_COMPANY_NAME_MAX_LENGTH {
		return NewAppError("Team.IsValid", "model.team.is_valid.company.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	if len(o.AllowedDomains) > TEAM_ALLOWED_DOMAINS_MAX_LENGTH {
		return NewAppError("Team.IsValid", "model.team.is_valid.domains.app_error", nil, "id="+o.Id, http.StatusBadRequest)
	}

	return nil
}

func (o *Team) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	o.CreateAt = GetMillis()
	o.UpdateAt = o.CreateAt

	if len(o.InviteId) == 0 {
		o.InviteId = NewId()
	}
}

func (o *Team) PreUpdate() {
	o.UpdateAt = GetMillis()
}

func IsReservedTeamName(s string) bool {
	s = strings.ToLower(s)

	for _, value := range reservedName {
		if strings.Index(s, value) == 0 {
			return true
		}
	}

	return false
}

func IsValidTeamName(s string) bool {

	if !IsValidAlphaNum(s) {
		return false
	}

	if len(s) < TEAM_NAME_MIN_LENGTH {
		return false
	}

	return true
}

var validTeamNameCharacter = regexp.MustCompile(`^[a-z0-9-]$`)

func CleanTeamName(s string) string {
	s = strings.ToLower(strings.Replace(s, " ", "-", -1))

	for _, value := range reservedName {
		if strings.Index(s, value) == 0 {
			s = strings.Replace(s, value, "", -1)
		}
	}

	s = strings.TrimSpace(s)

	for _, c := range s {
		char := fmt.Sprintf("%c", c)
		if !validTeamNameCharacter.MatchString(char) {
			s = strings.Replace(s, char, "", -1)
		}
	}

	s = strings.Trim(s, "-")

	if !IsValidTeamName(s) {
		s = NewId()
	}

	return s
}

func (o *Team) Sanitize() {
	o.Email = ""
	o.AllowedDomains = ""
}

func (o *Team) SanitizeForNotLoggedIn() {
	o.Email = ""
	o.AllowedDomains = ""
	o.CompanyName = ""
	if !o.AllowOpenInvite {
		o.InviteId = ""
	}
}

func (t *Team) Patch(patch *TeamPatch) {
	if patch.DisplayName != nil {
		t.DisplayName = *patch.DisplayName
	}

	if patch.Description != nil {
		t.Description = *patch.Description
	}

	if patch.CompanyName != nil {
		t.CompanyName = *patch.CompanyName
	}

	if patch.InviteId != nil {
		t.InviteId = *patch.InviteId
	}

	if patch.AllowOpenInvite != nil {
		t.AllowOpenInvite = *patch.AllowOpenInvite
	}
}

func (t *TeamPatch) ToJson() string {
	b, err := json.Marshal(t)
	if err != nil {
		return ""
	}

	return string(b)
}

func TeamPatchFromJson(data io.Reader) *TeamPatch {
	decoder := json.NewDecoder(data)
	var team TeamPatch
	err := decoder.Decode(&team)
	if err != nil {
		return nil
	}

	return &team
}
