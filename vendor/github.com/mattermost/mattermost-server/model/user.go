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

	"golang.org/x/crypto/bcrypt"
)

const (
	ME                           = "me"
	USER_NOTIFY_ALL              = "all"
	USER_NOTIFY_MENTION          = "mention"
	USER_NOTIFY_NONE             = "none"
	DESKTOP_NOTIFY_PROP          = "desktop"
	DESKTOP_SOUND_NOTIFY_PROP    = "desktop_sound"
	DESKTOP_DURATION_NOTIFY_PROP = "desktop_duration"
	MARK_UNREAD_NOTIFY_PROP      = "mark_unread"
	PUSH_NOTIFY_PROP             = "push"
	PUSH_STATUS_NOTIFY_PROP      = "push_status"
	EMAIL_NOTIFY_PROP            = "email"
	CHANNEL_MENTIONS_NOTIFY_PROP = "channel"
	COMMENTS_NOTIFY_PROP         = "comments"
	MENTION_KEYS_NOTIFY_PROP     = "mention_keys"
	COMMENTS_NOTIFY_NEVER        = "never"
	COMMENTS_NOTIFY_ROOT         = "root"
	COMMENTS_NOTIFY_ANY          = "any"

	DEFAULT_LOCALE          = "en"
	USER_AUTH_SERVICE_EMAIL = "email"

	USER_EMAIL_MAX_LENGTH     = 128
	USER_NICKNAME_MAX_RUNES   = 64
	USER_POSITION_MAX_RUNES   = 64
	USER_FIRST_NAME_MAX_RUNES = 64
	USER_LAST_NAME_MAX_RUNES  = 64
	USER_AUTH_DATA_MAX_LENGTH = 128
	USER_NAME_MAX_LENGTH      = 64
	USER_NAME_MIN_LENGTH      = 1
	USER_PASSWORD_MAX_LENGTH  = 72
)

type User struct {
	Id                 string    `json:"id"`
	CreateAt           int64     `json:"create_at,omitempty"`
	UpdateAt           int64     `json:"update_at,omitempty"`
	DeleteAt           int64     `json:"delete_at"`
	Username           string    `json:"username"`
	Password           string    `json:"password,omitempty"`
	AuthData           *string   `json:"auth_data,omitempty"`
	AuthService        string    `json:"auth_service"`
	Email              string    `json:"email"`
	EmailVerified      bool      `json:"email_verified,omitempty"`
	Nickname           string    `json:"nickname"`
	FirstName          string    `json:"first_name"`
	LastName           string    `json:"last_name"`
	Position           string    `json:"position"`
	Roles              string    `json:"roles"`
	AllowMarketing     bool      `json:"allow_marketing,omitempty"`
	Props              StringMap `json:"props,omitempty"`
	NotifyProps        StringMap `json:"notify_props,omitempty"`
	LastPasswordUpdate int64     `json:"last_password_update,omitempty"`
	LastPictureUpdate  int64     `json:"last_picture_update,omitempty"`
	FailedAttempts     int       `json:"failed_attempts,omitempty"`
	Locale             string    `json:"locale"`
	MfaActive          bool      `json:"mfa_active,omitempty"`
	MfaSecret          string    `json:"mfa_secret,omitempty"`
	LastActivityAt     int64     `db:"-" json:"last_activity_at,omitempty"`
}

type UserPatch struct {
	Username    *string   `json:"username"`
	Nickname    *string   `json:"nickname"`
	FirstName   *string   `json:"first_name"`
	LastName    *string   `json:"last_name"`
	Position    *string   `json:"position"`
	Email       *string   `json:"email"`
	Props       StringMap `json:"props,omitempty"`
	NotifyProps StringMap `json:"notify_props,omitempty"`
	Locale      *string   `json:"locale"`
}

type UserAuth struct {
	Password    string  `json:"password,omitempty"`
	AuthData    *string `json:"auth_data,omitempty"`
	AuthService string  `json:"auth_service,omitempty"`
}

// IsValid validates the user and returns an error if it isn't configured
// correctly.
func (u *User) IsValid() *AppError {

	if len(u.Id) != 26 {
		return InvalidUserError("id", "")
	}

	if u.CreateAt == 0 {
		return InvalidUserError("create_at", u.Id)
	}

	if u.UpdateAt == 0 {
		return InvalidUserError("update_at", u.Id)
	}

	if !IsValidUsername(u.Username) {
		return InvalidUserError("username", u.Id)
	}

	if len(u.Email) > USER_EMAIL_MAX_LENGTH || len(u.Email) == 0 {
		return InvalidUserError("email", u.Id)
	}

	if utf8.RuneCountInString(u.Nickname) > USER_NICKNAME_MAX_RUNES {
		return InvalidUserError("nickname", u.Id)
	}

	if utf8.RuneCountInString(u.Position) > USER_POSITION_MAX_RUNES {
		return InvalidUserError("position", u.Id)
	}

	if utf8.RuneCountInString(u.FirstName) > USER_FIRST_NAME_MAX_RUNES {
		return InvalidUserError("first_name", u.Id)
	}

	if utf8.RuneCountInString(u.LastName) > USER_LAST_NAME_MAX_RUNES {
		return InvalidUserError("last_name", u.Id)
	}

	if u.AuthData != nil && len(*u.AuthData) > USER_AUTH_DATA_MAX_LENGTH {
		return InvalidUserError("auth_data", u.Id)
	}

	if u.AuthData != nil && len(*u.AuthData) > 0 && len(u.AuthService) == 0 {
		return InvalidUserError("auth_data_type", u.Id)
	}

	if len(u.Password) > 0 && u.AuthData != nil && len(*u.AuthData) > 0 {
		return InvalidUserError("auth_data_pwd", u.Id)
	}

	if len(u.Password) > USER_PASSWORD_MAX_LENGTH {
		return InvalidUserError("password_limit", u.Id)
	}

	return nil
}

func InvalidUserError(fieldName string, userId string) *AppError {
	id := fmt.Sprintf("model.user.is_valid.%s.app_error", fieldName)
	details := ""
	if userId != "" {
		details = "user_id=" + userId
	}
	return NewAppError("User.IsValid", id, nil, details, http.StatusBadRequest)
}

// PreSave will set the Id and Username if missing.  It will also fill
// in the CreateAt, UpdateAt times.  It will also hash the password.  It should
// be run before saving the user to the db.
func (u *User) PreSave() {
	if u.Id == "" {
		u.Id = NewId()
	}

	if u.Username == "" {
		u.Username = NewId()
	}

	if u.AuthData != nil && *u.AuthData == "" {
		u.AuthData = nil
	}

	u.Username = strings.ToLower(u.Username)
	u.Email = strings.ToLower(u.Email)

	u.CreateAt = GetMillis()
	u.UpdateAt = u.CreateAt

	u.LastPasswordUpdate = u.CreateAt

	u.MfaActive = false

	if u.Locale == "" {
		u.Locale = DEFAULT_LOCALE
	}

	if u.Props == nil {
		u.Props = make(map[string]string)
	}

	if u.NotifyProps == nil || len(u.NotifyProps) == 0 {
		u.SetDefaultNotifications()
	}

	if len(u.Password) > 0 {
		u.Password = HashPassword(u.Password)
	}
}

// PreUpdate should be run before updating the user in the db.
func (u *User) PreUpdate() {
	u.Username = strings.ToLower(u.Username)
	u.Email = strings.ToLower(u.Email)
	u.UpdateAt = GetMillis()

	if u.AuthData != nil && *u.AuthData == "" {
		u.AuthData = nil
	}

	if u.NotifyProps == nil || len(u.NotifyProps) == 0 {
		u.SetDefaultNotifications()
	} else if _, ok := u.NotifyProps["mention_keys"]; ok {
		// Remove any blank mention keys
		splitKeys := strings.Split(u.NotifyProps["mention_keys"], ",")
		goodKeys := []string{}
		for _, key := range splitKeys {
			if len(key) > 0 {
				goodKeys = append(goodKeys, strings.ToLower(key))
			}
		}
		u.NotifyProps["mention_keys"] = strings.Join(goodKeys, ",")
	}
}

func (u *User) SetDefaultNotifications() {
	u.NotifyProps = make(map[string]string)
	u.NotifyProps["email"] = "true"
	u.NotifyProps["push"] = USER_NOTIFY_MENTION
	u.NotifyProps["desktop"] = USER_NOTIFY_MENTION
	u.NotifyProps["desktop_sound"] = "true"
	u.NotifyProps["mention_keys"] = u.Username + ",@" + u.Username
	u.NotifyProps["channel"] = "true"
	u.NotifyProps["push_status"] = STATUS_AWAY
	u.NotifyProps["comments"] = "never"
	u.NotifyProps["first_name"] = "false"
}

func (user *User) UpdateMentionKeysFromUsername(oldUsername string) {
	nonUsernameKeys := []string{}
	splitKeys := strings.Split(user.NotifyProps["mention_keys"], ",")
	for _, key := range splitKeys {
		if key != oldUsername && key != "@"+oldUsername {
			nonUsernameKeys = append(nonUsernameKeys, key)
		}
	}

	user.NotifyProps["mention_keys"] = user.Username + ",@" + user.Username
	if len(nonUsernameKeys) > 0 {
		user.NotifyProps["mention_keys"] += "," + strings.Join(nonUsernameKeys, ",")
	}
}

func (u *User) Patch(patch *UserPatch) {
	if patch.Username != nil {
		u.Username = *patch.Username
	}

	if patch.Nickname != nil {
		u.Nickname = *patch.Nickname
	}

	if patch.FirstName != nil {
		u.FirstName = *patch.FirstName
	}

	if patch.LastName != nil {
		u.LastName = *patch.LastName
	}

	if patch.Position != nil {
		u.Position = *patch.Position
	}

	if patch.Email != nil {
		u.Email = *patch.Email
	}

	if patch.Props != nil {
		u.Props = patch.Props
	}

	if patch.NotifyProps != nil {
		u.NotifyProps = patch.NotifyProps
	}

	if patch.Locale != nil {
		u.Locale = *patch.Locale
	}
}

// ToJson convert a User to a json string
func (u *User) ToJson() string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (u *UserPatch) ToJson() string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func (u *UserAuth) ToJson() string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

// Generate a valid strong etag so the browser can cache the results
func (u *User) Etag(showFullName, showEmail bool) string {
	return Etag(u.Id, u.UpdateAt, showFullName, showEmail)
}

// Remove any private data from the user object
func (u *User) Sanitize(options map[string]bool) {
	u.Password = ""
	u.AuthData = NewString("")
	u.MfaSecret = ""

	if len(options) != 0 && !options["email"] {
		u.Email = ""
	}
	if len(options) != 0 && !options["fullname"] {
		u.FirstName = ""
		u.LastName = ""
	}
	if len(options) != 0 && !options["passwordupdate"] {
		u.LastPasswordUpdate = 0
	}
	if len(options) != 0 && !options["authservice"] {
		u.AuthService = ""
	}
}

func (u *User) ClearNonProfileFields() {
	u.Password = ""
	u.AuthData = NewString("")
	u.MfaSecret = ""
	u.EmailVerified = false
	u.AllowMarketing = false
	u.NotifyProps = StringMap{}
	u.LastPasswordUpdate = 0
	u.FailedAttempts = 0
}

func (u *User) SanitizeProfile(options map[string]bool) {
	u.ClearNonProfileFields()

	u.Sanitize(options)
}

func (u *User) MakeNonNil() {
	if u.Props == nil {
		u.Props = make(map[string]string)
	}

	if u.NotifyProps == nil {
		u.NotifyProps = make(map[string]string)
	}
}

func (u *User) AddProp(key string, value string) {
	u.MakeNonNil()

	u.Props[key] = value
}

func (u *User) AddNotifyProp(key string, value string) {
	u.MakeNonNil()

	u.NotifyProps[key] = value
}

func (u *User) GetFullName() string {
	if u.FirstName != "" && u.LastName != "" {
		return u.FirstName + " " + u.LastName
	} else if u.FirstName != "" {
		return u.FirstName
	} else if u.LastName != "" {
		return u.LastName
	} else {
		return ""
	}
}

func (u *User) GetDisplayName(nameFormat string) string {
	displayName := u.Username

	if nameFormat == SHOW_NICKNAME_FULLNAME {
		if u.Nickname != "" {
			displayName = u.Nickname
		} else if fullName := u.GetFullName(); fullName != "" {
			displayName = fullName
		}
	} else if nameFormat == SHOW_FULLNAME {
		if fullName := u.GetFullName(); fullName != "" {
			displayName = fullName
		}
	}

	return displayName
}

func (u *User) GetRoles() []string {
	return strings.Fields(u.Roles)
}

func (u *User) GetRawRoles() string {
	return u.Roles
}

func IsValidUserRoles(userRoles string) bool {

	roles := strings.Fields(userRoles)

	for _, r := range roles {
		if !isValidRole(r) {
			return false
		}
	}

	// Exclude just the system_admin role explicitly to prevent mistakes
	if len(roles) == 1 && roles[0] == "system_admin" {
		return false
	}

	return true
}

func isValidRole(roleId string) bool {
	_, ok := DefaultRoles[roleId]
	return ok
}

// Make sure you acually want to use this function. In context.go there are functions to check permissions
// This function should not be used to check permissions.
func (u *User) IsInRole(inRole string) bool {
	return IsInRole(u.Roles, inRole)
}

// Make sure you acually want to use this function. In context.go there are functions to check permissions
// This function should not be used to check permissions.
func IsInRole(userRoles string, inRole string) bool {
	roles := strings.Split(userRoles, " ")

	for _, r := range roles {
		if r == inRole {
			return true
		}
	}

	return false
}

func (u *User) IsSSOUser() bool {
	return u.AuthService != "" && u.AuthService != USER_AUTH_SERVICE_EMAIL
}

func (u *User) IsOAuthUser() bool {
	return u.AuthService == USER_AUTH_SERVICE_GITLAB
}

func (u *User) IsLDAPUser() bool {
	return u.AuthService == USER_AUTH_SERVICE_LDAP
}

func (u *User) IsSAMLUser() bool {
	return u.AuthService == USER_AUTH_SERVICE_SAML
}

// UserFromJson will decode the input and return a User
func UserFromJson(data io.Reader) *User {
	decoder := json.NewDecoder(data)
	var user User
	err := decoder.Decode(&user)
	if err == nil {
		return &user
	} else {
		return nil
	}
}

func UserPatchFromJson(data io.Reader) *UserPatch {
	decoder := json.NewDecoder(data)
	var user UserPatch
	err := decoder.Decode(&user)
	if err == nil {
		return &user
	} else {
		return nil
	}
}

func UserAuthFromJson(data io.Reader) *UserAuth {
	decoder := json.NewDecoder(data)
	var user UserAuth
	err := decoder.Decode(&user)
	if err == nil {
		return &user
	} else {
		return nil
	}
}

func UserMapToJson(u map[string]*User) string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func UserMapFromJson(data io.Reader) map[string]*User {
	decoder := json.NewDecoder(data)
	var users map[string]*User
	err := decoder.Decode(&users)
	if err == nil {
		return users
	} else {
		return nil
	}
}

func UserListToJson(u []*User) string {
	b, err := json.Marshal(u)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func UserListFromJson(data io.Reader) []*User {
	decoder := json.NewDecoder(data)
	var users []*User
	err := decoder.Decode(&users)
	if err == nil {
		return users
	} else {
		return nil
	}
}

// HashPassword generates a hash using the bcrypt.GenerateFromPassword
func HashPassword(password string) string {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		panic(err)
	}

	return string(hash)
}

// ComparePassword compares the hash
func ComparePassword(hash string, password string) bool {

	if len(password) == 0 || len(hash) == 0 {
		return false
	}

	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

var validUsernameChars = regexp.MustCompile(`^[a-z0-9\.\-_]+$`)

var restrictedUsernames = []string{
	"all",
	"channel",
	"matterbot",
}

func IsValidUsername(s string) bool {
	if len(s) < USER_NAME_MIN_LENGTH || len(s) > USER_NAME_MAX_LENGTH {
		return false
	}

	if !validUsernameChars.MatchString(s) {
		return false
	}

	for _, restrictedUsername := range restrictedUsernames {
		if s == restrictedUsername {
			return false
		}
	}

	return true
}

func CleanUsername(s string) string {
	s = strings.ToLower(strings.Replace(s, " ", "-", -1))

	for _, value := range reservedName {
		if s == value {
			s = strings.Replace(s, value, "", -1)
		}
	}

	s = strings.TrimSpace(s)

	for _, c := range s {
		char := fmt.Sprintf("%c", c)
		if !validUsernameChars.MatchString(char) {
			s = strings.Replace(s, char, "-", -1)
		}
	}

	s = strings.Trim(s, "-")

	if !IsValidUsername(s) {
		s = "a" + NewId()
	}

	return s
}

func IsValidUserNotifyLevel(notifyLevel string) bool {
	return notifyLevel == CHANNEL_NOTIFY_ALL ||
		notifyLevel == CHANNEL_NOTIFY_MENTION ||
		notifyLevel == CHANNEL_NOTIFY_NONE
}

func IsValidPushStatusNotifyLevel(notifyLevel string) bool {
	return notifyLevel == STATUS_ONLINE ||
		notifyLevel == STATUS_AWAY ||
		notifyLevel == STATUS_OFFLINE
}

func IsValidCommentsNotifyLevel(notifyLevel string) bool {
	return notifyLevel == COMMENTS_NOTIFY_ANY ||
		notifyLevel == COMMENTS_NOTIFY_ROOT ||
		notifyLevel == COMMENTS_NOTIFY_NEVER
}
