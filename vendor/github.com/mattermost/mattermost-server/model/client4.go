// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type Response struct {
	StatusCode    int
	Error         *AppError
	RequestId     string
	Etag          string
	ServerVersion string
	Header        http.Header
}

type Client4 struct {
	Url        string       // The location of the server, for example  "http://localhost:8065"
	ApiUrl     string       // The api location of the server, for example "http://localhost:8065/api/v4"
	HttpClient *http.Client // The http client
	AuthToken  string
	AuthType   string
}

func NewAPIv4Client(url string) *Client4 {
	return &Client4{url, url + API_URL_SUFFIX, &http.Client{}, "", ""}
}

func BuildErrorResponse(r *http.Response, err *AppError) *Response {
	var statusCode int
	var header http.Header
	if r != nil {
		statusCode = r.StatusCode
		header = r.Header
	} else {
		statusCode = 0
		header = make(http.Header)
	}

	return &Response{
		StatusCode: statusCode,
		Error:      err,
		Header:     header,
	}
}

func BuildResponse(r *http.Response) *Response {
	return &Response{
		StatusCode:    r.StatusCode,
		RequestId:     r.Header.Get(HEADER_REQUEST_ID),
		Etag:          r.Header.Get(HEADER_ETAG_SERVER),
		ServerVersion: r.Header.Get(HEADER_VERSION_ID),
		Header:        r.Header,
	}
}

func (c *Client4) SetOAuthToken(token string) {
	c.AuthToken = token
	c.AuthType = HEADER_TOKEN
}

func (c *Client4) ClearOAuthToken() {
	c.AuthToken = ""
	c.AuthType = HEADER_BEARER
}

func (c *Client4) GetUsersRoute() string {
	return fmt.Sprintf("/users")
}

func (c *Client4) GetUserRoute(userId string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/%v", userId)
}

func (c *Client4) GetUserAccessTokenRoute(tokenId string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/tokens/%v", tokenId)
}

func (c *Client4) GetUserByUsernameRoute(userName string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/username/%v", userName)
}

func (c *Client4) GetUserByEmailRoute(email string) string {
	return fmt.Sprintf(c.GetUsersRoute()+"/email/%v", email)
}

func (c *Client4) GetTeamsRoute() string {
	return fmt.Sprintf("/teams")
}

func (c *Client4) GetTeamRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamsRoute()+"/%v", teamId)
}

func (c *Client4) GetTeamAutoCompleteCommandsRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamsRoute()+"/%v/commands/autocomplete", teamId)
}

func (c *Client4) GetTeamByNameRoute(teamName string) string {
	return fmt.Sprintf(c.GetTeamsRoute()+"/name/%v", teamName)
}

func (c *Client4) GetTeamMemberRoute(teamId, userId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId)+"/members/%v", userId)
}

func (c *Client4) GetTeamMembersRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId) + "/members")
}

func (c *Client4) GetTeamStatsRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId) + "/stats")
}

func (c *Client4) GetTeamImportRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId) + "/import")
}

func (c *Client4) GetChannelsRoute() string {
	return fmt.Sprintf("/channels")
}

func (c *Client4) GetChannelsForTeamRoute(teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId) + "/channels")
}

func (c *Client4) GetChannelRoute(channelId string) string {
	return fmt.Sprintf(c.GetChannelsRoute()+"/%v", channelId)
}

func (c *Client4) GetChannelByNameRoute(channelName, teamId string) string {
	return fmt.Sprintf(c.GetTeamRoute(teamId)+"/channels/name/%v", channelName)
}

func (c *Client4) GetChannelByNameForTeamNameRoute(channelName, teamName string) string {
	return fmt.Sprintf(c.GetTeamByNameRoute(teamName)+"/channels/name/%v", channelName)
}

func (c *Client4) GetChannelMembersRoute(channelId string) string {
	return fmt.Sprintf(c.GetChannelRoute(channelId) + "/members")
}

func (c *Client4) GetChannelMemberRoute(channelId, userId string) string {
	return fmt.Sprintf(c.GetChannelMembersRoute(channelId)+"/%v", userId)
}

func (c *Client4) GetPostsRoute() string {
	return fmt.Sprintf("/posts")
}

func (c *Client4) GetConfigRoute() string {
	return fmt.Sprintf("/config")
}

func (c *Client4) GetLicenseRoute() string {
	return fmt.Sprintf("/license")
}

func (c *Client4) GetPostRoute(postId string) string {
	return fmt.Sprintf(c.GetPostsRoute()+"/%v", postId)
}

func (c *Client4) GetFilesRoute() string {
	return fmt.Sprintf("/files")
}

func (c *Client4) GetFileRoute(fileId string) string {
	return fmt.Sprintf(c.GetFilesRoute()+"/%v", fileId)
}

func (c *Client4) GetPluginsRoute() string {
	return fmt.Sprintf("/plugins")
}

func (c *Client4) GetPluginRoute(pluginId string) string {
	return fmt.Sprintf(c.GetPluginsRoute()+"/%v", pluginId)
}

func (c *Client4) GetSystemRoute() string {
	return fmt.Sprintf("/system")
}

func (c *Client4) GetTestEmailRoute() string {
	return fmt.Sprintf("/email/test")
}

func (c *Client4) GetDatabaseRoute() string {
	return fmt.Sprintf("/database")
}

func (c *Client4) GetCacheRoute() string {
	return fmt.Sprintf("/caches")
}

func (c *Client4) GetClusterRoute() string {
	return fmt.Sprintf("/cluster")
}

func (c *Client4) GetIncomingWebhooksRoute() string {
	return fmt.Sprintf("/hooks/incoming")
}

func (c *Client4) GetIncomingWebhookRoute(hookID string) string {
	return fmt.Sprintf(c.GetIncomingWebhooksRoute()+"/%v", hookID)
}

func (c *Client4) GetComplianceReportsRoute() string {
	return fmt.Sprintf("/compliance/reports")
}

func (c *Client4) GetComplianceReportRoute(reportId string) string {
	return fmt.Sprintf("/compliance/reports/%v", reportId)
}

func (c *Client4) GetOutgoingWebhooksRoute() string {
	return fmt.Sprintf("/hooks/outgoing")
}

func (c *Client4) GetOutgoingWebhookRoute(hookID string) string {
	return fmt.Sprintf(c.GetOutgoingWebhooksRoute()+"/%v", hookID)
}

func (c *Client4) GetPreferencesRoute(userId string) string {
	return fmt.Sprintf(c.GetUserRoute(userId) + "/preferences")
}

func (c *Client4) GetUserStatusRoute(userId string) string {
	return fmt.Sprintf(c.GetUserRoute(userId) + "/status")
}

func (c *Client4) GetUserStatusesRoute() string {
	return fmt.Sprintf(c.GetUsersRoute() + "/status")
}

func (c *Client4) GetSamlRoute() string {
	return fmt.Sprintf("/saml")
}

func (c *Client4) GetLdapRoute() string {
	return fmt.Sprintf("/ldap")
}

func (c *Client4) GetBrandRoute() string {
	return fmt.Sprintf("/brand")
}

func (c *Client4) GetDataRetentionRoute() string {
	return fmt.Sprintf("/data_retention")
}

func (c *Client4) GetElasticsearchRoute() string {
	return fmt.Sprintf("/elasticsearch")
}

func (c *Client4) GetCommandsRoute() string {
	return fmt.Sprintf("/commands")
}

func (c *Client4) GetCommandRoute(commandId string) string {
	return fmt.Sprintf(c.GetCommandsRoute()+"/%v", commandId)
}

func (c *Client4) GetEmojisRoute() string {
	return fmt.Sprintf("/emoji")
}

func (c *Client4) GetEmojiRoute(emojiId string) string {
	return fmt.Sprintf(c.GetEmojisRoute()+"/%v", emojiId)
}

func (c *Client4) GetReactionsRoute() string {
	return fmt.Sprintf("/reactions")
}

func (c *Client4) GetOAuthAppsRoute() string {
	return fmt.Sprintf("/oauth/apps")
}

func (c *Client4) GetOAuthAppRoute(appId string) string {
	return fmt.Sprintf("/oauth/apps/%v", appId)
}

func (c *Client4) GetOpenGraphRoute() string {
	return fmt.Sprintf("/opengraph")
}

func (c *Client4) GetJobsRoute() string {
	return fmt.Sprintf("/jobs")
}

func (c *Client4) GetAnalyticsRoute() string {
	return fmt.Sprintf("/analytics")
}

func (c *Client4) DoApiGet(url string, etag string) (*http.Response, *AppError) {
	return c.DoApiRequest(http.MethodGet, c.ApiUrl+url, "", etag)
}

func (c *Client4) DoApiPost(url string, data string) (*http.Response, *AppError) {
	return c.DoApiRequest(http.MethodPost, c.ApiUrl+url, data, "")
}

func (c *Client4) DoApiPut(url string, data string) (*http.Response, *AppError) {
	return c.DoApiRequest(http.MethodPut, c.ApiUrl+url, data, "")
}

func (c *Client4) DoApiDelete(url string) (*http.Response, *AppError) {
	return c.DoApiRequest(http.MethodDelete, c.ApiUrl+url, "", "")
}

func (c *Client4) DoApiRequest(method, url, data, etag string) (*http.Response, *AppError) {
	rq, _ := http.NewRequest(method, url, strings.NewReader(data))
	rq.Close = true

	if len(etag) > 0 {
		rq.Header.Set(HEADER_ETAG_CLIENT, etag)
	}

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil || rp == nil {
		return nil, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	} else if rp.StatusCode == 304 {
		return rp, nil
	} else if rp.StatusCode >= 300 {
		defer closeBody(rp)
		return rp, AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

func (c *Client4) DoUploadFile(url string, data []byte, contentType string) (*FileUploadResponse, *Response) {
	rq, _ := http.NewRequest("POST", c.ApiUrl+url, bytes.NewReader(data))
	rq.Header.Set("Content-Type", contentType)
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil || rp == nil {
		return nil, BuildErrorResponse(rp, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0))
	} else {
		defer closeBody(rp)

		if rp.StatusCode >= 300 {
			return nil, BuildErrorResponse(rp, AppErrorFromJson(rp.Body))
		} else {
			return FileUploadResponseFromJson(rp.Body), BuildResponse(rp)
		}
	}
}

func (c *Client4) DoEmojiUploadFile(url string, data []byte, contentType string) (*Emoji, *Response) {
	rq, _ := http.NewRequest("POST", c.ApiUrl+url, bytes.NewReader(data))
	rq.Header.Set("Content-Type", contentType)
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil || rp == nil {
		return nil, BuildErrorResponse(rp, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0))
	} else {
		defer closeBody(rp)

		if rp.StatusCode >= 300 {
			return nil, BuildErrorResponse(rp, AppErrorFromJson(rp.Body))
		} else {
			return EmojiFromJson(rp.Body), BuildResponse(rp)
		}
	}
}

func (c *Client4) DoUploadImportTeam(url string, data []byte, contentType string) (map[string]string, *Response) {
	rq, _ := http.NewRequest("POST", c.ApiUrl+url, bytes.NewReader(data))
	rq.Header.Set("Content-Type", contentType)
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil || rp == nil {
		return nil, BuildErrorResponse(rp, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0))
	} else {
		defer closeBody(rp)

		if rp.StatusCode >= 300 {
			return nil, BuildErrorResponse(rp, AppErrorFromJson(rp.Body))
		} else {
			return MapFromJson(rp.Body), BuildResponse(rp)
		}
	}
}

// CheckStatusOK is a convenience function for checking the standard OK response
// from the web service.
func CheckStatusOK(r *http.Response) bool {
	m := MapFromJson(r.Body)
	defer closeBody(r)

	if m != nil && m[STATUS] == STATUS_OK {
		return true
	}

	return false
}

// Authentication Section

// LoginById authenticates a user by user id and password.
func (c *Client4) LoginById(id string, password string) (*User, *Response) {
	m := make(map[string]string)
	m["id"] = id
	m["password"] = password
	return c.login(m)
}

// Login authenticates a user by login id, which can be username, email or some sort
// of SSO identifier based on server configuration, and a password.
func (c *Client4) Login(loginId string, password string) (*User, *Response) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	return c.login(m)
}

// LoginByLdap authenticates a user by LDAP id and password.
func (c *Client4) LoginByLdap(loginId string, password string) (*User, *Response) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["ldap_only"] = "true"
	return c.login(m)
}

// LoginWithDevice authenticates a user by login id (username, email or some sort
// of SSO identifier based on configuration), password and attaches a device id to
// the session.
func (c *Client4) LoginWithDevice(loginId string, password string, deviceId string) (*User, *Response) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["device_id"] = deviceId
	return c.login(m)
}

func (c *Client4) login(m map[string]string) (*User, *Response) {
	if r, err := c.DoApiPost("/users/login", MapToJson(m)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		c.AuthToken = r.Header.Get(HEADER_TOKEN)
		c.AuthType = HEADER_BEARER
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// Logout terminates the current user's session.
func (c *Client4) Logout() (bool, *Response) {
	if r, err := c.DoApiPost("/users/logout", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		c.AuthToken = ""
		c.AuthType = HEADER_BEARER

		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// SwitchAccountType changes a user's login type from one type to another.
func (c *Client4) SwitchAccountType(switchRequest *SwitchRequest) (string, *Response) {
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/login/switch", switchRequest.ToJson()); err != nil {
		return "", BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body)["follow_link"], BuildResponse(r)
	}
}

// User Section

// CreateUser creates a user in the system based on the provided user struct.
func (c *Client4) CreateUser(user *User) (*User, *Response) {
	if r, err := c.DoApiPost(c.GetUsersRoute(), user.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// CreateUserWithHash creates a user in the system based on the provided user struct and hash created.
func (c *Client4) CreateUserWithHash(user *User, hash, data string) (*User, *Response) {
	var query string
	if hash != "" && data != "" {
		query = fmt.Sprintf("?d=%v&h=%v", url.QueryEscape(data), hash)
	} else {
		err := NewAppError("MissingHashOrData", "api.user.create_user.missing_hash_or_data.app_error", nil, "", http.StatusBadRequest)
		return nil, &Response{StatusCode: err.StatusCode, Error: err}
	}
	if r, err := c.DoApiPost(c.GetUsersRoute()+query, user.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// CreateUserWithInviteId creates a user in the system based on the provided invited id.
func (c *Client4) CreateUserWithInviteId(user *User, inviteId string) (*User, *Response) {
	var query string
	if inviteId != "" {
		query = fmt.Sprintf("?iid=%v", url.QueryEscape(inviteId))
	} else {
		err := NewAppError("MissingInviteId", "api.user.create_user.missing_invite_id.app_error", nil, "", http.StatusBadRequest)
		return nil, &Response{StatusCode: err.StatusCode, Error: err}
	}
	if r, err := c.DoApiPost(c.GetUsersRoute()+query, user.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// GetMe returns the logged in user.
func (c *Client4) GetMe(etag string) (*User, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(ME), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// GetUser returns a user based on the provided user id string.
func (c *Client4) GetUser(userId, etag string) (*User, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// GetUserByUsername returns a user based on the provided user name string.
func (c *Client4) GetUserByUsername(userName, etag string) (*User, *Response) {
	if r, err := c.DoApiGet(c.GetUserByUsernameRoute(userName), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// GetUserByEmail returns a user based on the provided user email string.
func (c *Client4) GetUserByEmail(email, etag string) (*User, *Response) {
	if r, err := c.DoApiGet(c.GetUserByEmailRoute(email), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// AutocompleteUsersInTeam returns the users on a team based on search term.
func (c *Client4) AutocompleteUsersInTeam(teamId string, username string, etag string) (*UserAutocomplete, *Response) {
	query := fmt.Sprintf("?in_team=%v&name=%v", teamId, username)
	if r, err := c.DoApiGet(c.GetUsersRoute()+"/autocomplete"+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserAutocompleteFromJson(r.Body), BuildResponse(r)
	}
}

// AutocompleteUsersInChannel returns the users in a channel based on search term.
func (c *Client4) AutocompleteUsersInChannel(teamId string, channelId string, username string, etag string) (*UserAutocomplete, *Response) {
	query := fmt.Sprintf("?in_team=%v&in_channel=%v&name=%v", teamId, channelId, username)
	if r, err := c.DoApiGet(c.GetUsersRoute()+"/autocomplete"+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserAutocompleteFromJson(r.Body), BuildResponse(r)
	}
}

// AutocompleteUsers returns the users in the system based on search term.
func (c *Client4) AutocompleteUsers(username string, etag string) (*UserAutocomplete, *Response) {
	query := fmt.Sprintf("?name=%v", username)
	if r, err := c.DoApiGet(c.GetUsersRoute()+"/autocomplete"+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserAutocompleteFromJson(r.Body), BuildResponse(r)
	}
}

// GetProfileImage gets user's profile image. Must be logged in or be a system administrator.
func (c *Client4) GetProfileImage(userId, etag string) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/image", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		if data, err := ioutil.ReadAll(r.Body); err != nil {
			return nil, BuildErrorResponse(r, NewAppError("GetProfileImage", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode))
		} else {
			return data, BuildResponse(r)
		}
	}
}

// GetUsers returns a page of users on the system. Page counting starts at 0.
func (c *Client4) GetUsers(page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetNewUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetNewUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?sort=create_at&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetRecentlyActiveUsersInTeam returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetRecentlyActiveUsersInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?sort=last_activity_at&in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersNotInTeam returns a page of users who are not in a team. Page counting starts at 0.
func (c *Client4) GetUsersNotInTeam(teamId string, page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?not_in_team=%v&page=%v&per_page=%v", teamId, page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersInChannel returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersInChannel(channelId string, page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?in_channel=%v&page=%v&per_page=%v", channelId, page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersNotInChannel returns a page of users on a team. Page counting starts at 0.
func (c *Client4) GetUsersNotInChannel(teamId, channelId string, page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?in_team=%v&not_in_channel=%v&page=%v&per_page=%v", teamId, channelId, page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersWithoutTeam returns a page of users on the system that aren't on any teams. Page counting starts at 0.
func (c *Client4) GetUsersWithoutTeam(page int, perPage int, etag string) ([]*User, *Response) {
	query := fmt.Sprintf("?without_team=1&page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetUsersRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersByIds returns a list of users based on the provided user ids.
func (c *Client4) GetUsersByIds(userIds []string) ([]*User, *Response) {
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/ids", ArrayToJson(userIds)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersByUsernames returns a list of users based on the provided usernames.
func (c *Client4) GetUsersByUsernames(usernames []string) ([]*User, *Response) {
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/usernames", ArrayToJson(usernames)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// SearchUsers returns a list of users based on some search criteria.
func (c *Client4) SearchUsers(search *UserSearch) ([]*User, *Response) {
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/search", search.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserListFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateUser updates a user in the system based on the provided user struct.
func (c *Client4) UpdateUser(user *User) (*User, *Response) {
	if r, err := c.DoApiPut(c.GetUserRoute(user.Id), user.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// PatchUser partially updates a user in the system. Any missing fields are not updated.
func (c *Client4) PatchUser(userId string, patch *UserPatch) (*User, *Response) {
	if r, err := c.DoApiPut(c.GetUserRoute(userId)+"/patch", patch.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateUserAuth updates a user AuthData (uthData, authService and password) in the system.
func (c *Client4) UpdateUserAuth(userId string, userAuth *UserAuth) (*UserAuth, *Response) {
	if r, err := c.DoApiPut(c.GetUserRoute(userId)+"/auth", userAuth.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserAuthFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateUserMfa activates multi-factor authentication for a user if activate
// is true and a valid code is provided. If activate is false, then code is not
// required and multi-factor authentication is disabled for the user.
func (c *Client4) UpdateUserMfa(userId, code string, activate bool) (bool, *Response) {
	requestBody := make(map[string]interface{})
	requestBody["activate"] = activate
	requestBody["code"] = code

	if r, err := c.DoApiPut(c.GetUserRoute(userId)+"/mfa", StringInterfaceToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// CheckUserMfa checks whether a user has MFA active on their account or not based on the
// provided login id.
func (c *Client4) CheckUserMfa(loginId string) (bool, *Response) {
	requestBody := make(map[string]interface{})
	requestBody["login_id"] = loginId

	if r, err := c.DoApiPost(c.GetUsersRoute()+"/mfa", StringInterfaceToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		data := StringInterfaceFromJson(r.Body)
		if mfaRequired, ok := data["mfa_required"].(bool); !ok {
			return false, BuildResponse(r)
		} else {
			return mfaRequired, BuildResponse(r)
		}
	}
}

// GenerateMfaSecret will generate a new MFA secret for a user and return it as a string and
// as a base64 encoded image QR code.
func (c *Client4) GenerateMfaSecret(userId string) (*MfaSecret, *Response) {
	if r, err := c.DoApiPost(c.GetUserRoute(userId)+"/mfa/generate", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MfaSecretFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateUserPassword updates a user's password. Must be logged in as the user or be a system administrator.
func (c *Client4) UpdateUserPassword(userId, currentPassword, newPassword string) (bool, *Response) {
	requestBody := map[string]string{"current_password": currentPassword, "new_password": newPassword}
	if r, err := c.DoApiPut(c.GetUserRoute(userId)+"/password", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// UpdateUserRoles updates a user's roles in the system. A user can have "system_user" and "system_admin" roles.
func (c *Client4) UpdateUserRoles(userId, roles string) (bool, *Response) {
	requestBody := map[string]string{"roles": roles}
	if r, err := c.DoApiPut(c.GetUserRoute(userId)+"/roles", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// UpdateUserActive updates status of a user whether active or not.
func (c *Client4) UpdateUserActive(userId string, active bool) (bool, *Response) {
	requestBody := make(map[string]interface{})
	requestBody["active"] = active

	if r, err := c.DoApiPut(c.GetUserRoute(userId)+"/active", StringInterfaceToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// DeleteUser deactivates a user in the system based on the provided user id string.
func (c *Client4) DeleteUser(userId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetUserRoute(userId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// SendPasswordResetEmail will send a link for password resetting to a user with the
// provided email.
func (c *Client4) SendPasswordResetEmail(email string) (bool, *Response) {
	requestBody := map[string]string{"email": email}
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/password/reset/send", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// ResetPassword uses a recovery code to update reset a user's password.
func (c *Client4) ResetPassword(token, newPassword string) (bool, *Response) {
	requestBody := map[string]string{"token": token, "new_password": newPassword}
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/password/reset", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetSessions returns a list of sessions based on the provided user id string.
func (c *Client4) GetSessions(userId, etag string) ([]*Session, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/sessions", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return SessionsFromJson(r.Body), BuildResponse(r)
	}
}

// RevokeSession revokes a user session based on the provided user id and session id strings.
func (c *Client4) RevokeSession(userId, sessionId string) (bool, *Response) {
	requestBody := map[string]string{"session_id": sessionId}
	if r, err := c.DoApiPost(c.GetUserRoute(userId)+"/sessions/revoke", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// RevokeAllSessions revokes all sessions for the provided user id string.
func (c *Client4) RevokeAllSessions(userId string) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetUserRoute(userId)+"/sessions/revoke/all", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// AttachDeviceId attaches a mobile device ID to the current session.
func (c *Client4) AttachDeviceId(deviceId string) (bool, *Response) {
	requestBody := map[string]string{"device_id": deviceId}
	if r, err := c.DoApiPut(c.GetUsersRoute()+"/sessions/device", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetTeamsUnreadForUser will return an array with TeamUnread objects that contain the amount
// of unread messages and mentions the current user has for the teams it belongs to.
// An optional team ID can be set to exclude that team from the results. Must be authenticated.
func (c *Client4) GetTeamsUnreadForUser(userId, teamIdToExclude string) ([]*TeamUnread, *Response) {
	optional := ""
	if teamIdToExclude != "" {
		optional += fmt.Sprintf("?exclude_team=%s", url.QueryEscape(teamIdToExclude))
	}

	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/teams/unread"+optional, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamsUnreadFromJson(r.Body), BuildResponse(r)
	}
}

// GetUserAudits returns a list of audit based on the provided user id string.
func (c *Client4) GetUserAudits(userId string, page int, perPage int, etag string) (Audits, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/audits"+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return AuditsFromJson(r.Body), BuildResponse(r)
	}
}

// VerifyUserEmail will verify a user's email using the supplied token.
func (c *Client4) VerifyUserEmail(token string) (bool, *Response) {
	requestBody := map[string]string{"token": token}
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/email/verify", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// SendVerificationEmail will send an email to the user with the provided email address, if
// that user exists. The email will contain a link that can be used to verify the user's
// email address.
func (c *Client4) SendVerificationEmail(email string) (bool, *Response) {
	requestBody := map[string]string{"email": email}
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/email/verify/send", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// SetProfileImage sets profile image of the user
func (c *Client4) SetProfileImage(userId string, data []byte) (bool, *Response) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("image", "profile.png"); err != nil {
		return false, &Response{Error: NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return false, &Response{Error: NewAppError("SetProfileImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if err := writer.Close(); err != nil {
		return false, &Response{Error: NewAppError("SetProfileImage", "model.client.set_profile_user.writer.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	rq, _ := http.NewRequest("POST", c.ApiUrl+c.GetUserRoute(userId)+"/image", bytes.NewReader(body.Bytes()))
	rq.Header.Set("Content-Type", writer.FormDataContentType())
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil || rp == nil {
		// set to http.StatusForbidden(403)
		return false, &Response{StatusCode: http.StatusForbidden, Error: NewAppError(c.GetUserRoute(userId)+"/image", "model.client.connecting.app_error", nil, err.Error(), 403)}
	} else {
		defer closeBody(rp)

		if rp.StatusCode >= 300 {
			return false, BuildErrorResponse(rp, AppErrorFromJson(rp.Body))
		} else {
			return CheckStatusOK(rp), BuildResponse(rp)
		}
	}
}

// CreateUserAccessToken will generate a user access token that can be used in place
// of a session token to access the REST API. Must have the 'create_user_access_token'
// permission and if generating for another user, must have the 'edit_other_users'
// permission. A non-blank description is required.
func (c *Client4) CreateUserAccessToken(userId, description string) (*UserAccessToken, *Response) {
	requestBody := map[string]string{"description": description}
	if r, err := c.DoApiPost(c.GetUserRoute(userId)+"/tokens", MapToJson(requestBody)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserAccessTokenFromJson(r.Body), BuildResponse(r)
	}
}

// GetUserAccessToken will get a user access token's id, description and the user_id
// of the user it is for. The actual token will not be returned. Must have the
// 'read_user_access_token' permission and if getting for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) GetUserAccessToken(tokenId string) (*UserAccessToken, *Response) {
	if r, err := c.DoApiGet(c.GetUserAccessTokenRoute(tokenId), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserAccessTokenFromJson(r.Body), BuildResponse(r)
	}
}

// GetUserAccessTokensForUser will get a paged list of user access tokens showing id,
// description and user_id for each. The actual tokens will not be returned. Must have
// the 'read_user_access_token' permission and if getting for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) GetUserAccessTokensForUser(userId string, page, perPage int) ([]*UserAccessToken, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/tokens"+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return UserAccessTokenListFromJson(r.Body), BuildResponse(r)
	}
}

// RevokeUserAccessToken will revoke a user access token by id. Must have the
// 'revoke_user_access_token' permission and if revoking for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) RevokeUserAccessToken(tokenId string) (bool, *Response) {
	requestBody := map[string]string{"token_id": tokenId}
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/tokens/revoke", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// DisableUserAccessToken will disable a user access token by id. Must have the
// 'revoke_user_access_token' permission and if disabling for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) DisableUserAccessToken(tokenId string) (bool, *Response) {
	requestBody := map[string]string{"token_id": tokenId}
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/tokens/disable", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// EnableUserAccessToken will enable a user access token by id. Must have the
// 'create_user_access_token' permission and if enabling for another user, must have the
// 'edit_other_users' permission.
func (c *Client4) EnableUserAccessToken(tokenId string) (bool, *Response) {
	requestBody := map[string]string{"token_id": tokenId}
	if r, err := c.DoApiPost(c.GetUsersRoute()+"/tokens/enable", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Team Section

// CreateTeam creates a team in the system based on the provided team struct.
func (c *Client4) CreateTeam(team *Team) (*Team, *Response) {
	if r, err := c.DoApiPost(c.GetTeamsRoute(), team.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeam returns a team based on the provided team id string.
func (c *Client4) GetTeam(teamId, etag string) (*Team, *Response) {
	if r, err := c.DoApiGet(c.GetTeamRoute(teamId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamFromJson(r.Body), BuildResponse(r)
	}
}

// GetAllTeams returns all teams based on permissions.
func (c *Client4) GetAllTeams(etag string, page int, perPage int) ([]*Team, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetTeamsRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamListFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeamByName returns a team based on the provided team name string.
func (c *Client4) GetTeamByName(name, etag string) (*Team, *Response) {
	if r, err := c.DoApiGet(c.GetTeamByNameRoute(name), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamFromJson(r.Body), BuildResponse(r)
	}
}

// SearchTeams returns teams matching the provided search term.
func (c *Client4) SearchTeams(search *TeamSearch) ([]*Team, *Response) {
	if r, err := c.DoApiPost(c.GetTeamsRoute()+"/search", search.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamListFromJson(r.Body), BuildResponse(r)
	}
}

// TeamExists returns true or false if the team exist or not.
func (c *Client4) TeamExists(name, etag string) (bool, *Response) {
	if r, err := c.DoApiGet(c.GetTeamByNameRoute(name)+"/exists", etag); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MapBoolFromJson(r.Body)["exists"], BuildResponse(r)
	}
}

// GetTeamsForUser returns a list of teams a user is on. Must be logged in as the user
// or be a system administrator.
func (c *Client4) GetTeamsForUser(userId, etag string) ([]*Team, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/teams", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamListFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeamMember returns a team member based on the provided team and user id strings.
func (c *Client4) GetTeamMember(teamId, userId, etag string) (*TeamMember, *Response) {
	if r, err := c.DoApiGet(c.GetTeamMemberRoute(teamId, userId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamMemberFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateTeamMemberRoles will update the roles on a team for a user.
func (c *Client4) UpdateTeamMemberRoles(teamId, userId, newRoles string) (bool, *Response) {
	requestBody := map[string]string{"roles": newRoles}
	if r, err := c.DoApiPut(c.GetTeamMemberRoute(teamId, userId)+"/roles", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// UpdateTeam will update a team.
func (c *Client4) UpdateTeam(team *Team) (*Team, *Response) {
	if r, err := c.DoApiPut(c.GetTeamRoute(team.Id), team.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamFromJson(r.Body), BuildResponse(r)
	}
}

// PatchTeam partially updates a team. Any missing fields are not updated.
func (c *Client4) PatchTeam(teamId string, patch *TeamPatch) (*Team, *Response) {
	if r, err := c.DoApiPut(c.GetTeamRoute(teamId)+"/patch", patch.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamFromJson(r.Body), BuildResponse(r)
	}
}

// SoftDeleteTeam deletes the team softly (archive only, not permanent delete).
func (c *Client4) SoftDeleteTeam(teamId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetTeamRoute(teamId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// PermanentDeleteTeam deletes the team, should only be used when needed for
// compliance and the like
func (c *Client4) PermanentDeleteTeam(teamId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetTeamRoute(teamId) + "?permanent=true"); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetTeamMembers returns team members based on the provided team id string.
func (c *Client4) GetTeamMembers(teamId string, page int, perPage int, etag string) ([]*TeamMember, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetTeamMembersRoute(teamId)+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamMembersFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeamMembersForUser returns the team members for a user.
func (c *Client4) GetTeamMembersForUser(userId string, etag string) ([]*TeamMember, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/teams/members", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamMembersFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeamMembersByIds will return an array of team members based on the
// team id and a list of user ids provided. Must be authenticated.
func (c *Client4) GetTeamMembersByIds(teamId string, userIds []string) ([]*TeamMember, *Response) {
	if r, err := c.DoApiPost(fmt.Sprintf("/teams/%v/members/ids", teamId), ArrayToJson(userIds)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamMembersFromJson(r.Body), BuildResponse(r)
	}
}

// AddTeamMember adds user to a team and return a team member.
func (c *Client4) AddTeamMember(teamId, userId string) (*TeamMember, *Response) {
	member := &TeamMember{TeamId: teamId, UserId: userId}

	if r, err := c.DoApiPost(c.GetTeamMembersRoute(teamId), member.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamMemberFromJson(r.Body), BuildResponse(r)
	}
}

// AddTeamMemberFromInvite adds a user to a team and return a team member using an invite id
// or an invite hash/data pair.
func (c *Client4) AddTeamMemberFromInvite(hash, dataToHash, inviteId string) (*TeamMember, *Response) {
	var query string

	if inviteId != "" {
		query += fmt.Sprintf("?invite_id=%v", inviteId)
	}

	if hash != "" && dataToHash != "" {
		query += fmt.Sprintf("?hash=%v&data=%v", hash, dataToHash)
	}

	if r, err := c.DoApiPost(c.GetTeamsRoute()+"/members/invite"+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamMemberFromJson(r.Body), BuildResponse(r)
	}
}

// AddTeamMembers adds a number of users to a team and returns the team members.
func (c *Client4) AddTeamMembers(teamId string, userIds []string) ([]*TeamMember, *Response) {
	var members []*TeamMember
	for _, userId := range userIds {
		member := &TeamMember{TeamId: teamId, UserId: userId}
		members = append(members, member)
	}

	if r, err := c.DoApiPost(c.GetTeamMembersRoute(teamId)+"/batch", TeamMembersToJson(members)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamMembersFromJson(r.Body), BuildResponse(r)
	}
}

// RemoveTeamMember will remove a user from a team.
func (c *Client4) RemoveTeamMember(teamId, userId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetTeamMemberRoute(teamId, userId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetTeamStats returns a team stats based on the team id string.
// Must be authenticated.
func (c *Client4) GetTeamStats(teamId, etag string) (*TeamStats, *Response) {
	if r, err := c.DoApiGet(c.GetTeamStatsRoute(teamId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamStatsFromJson(r.Body), BuildResponse(r)
	}
}

// GetTeamUnread will return a TeamUnread object that contains the amount of
// unread messages and mentions the user has for the specified team.
// Must be authenticated.
func (c *Client4) GetTeamUnread(teamId, userId string) (*TeamUnread, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+c.GetTeamRoute(teamId)+"/unread", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamUnreadFromJson(r.Body), BuildResponse(r)
	}
}

// ImportTeam will import an exported team from other app into a existing team.
func (c *Client4) ImportTeam(data []byte, filesize int, importFrom, filename, teamId string) (map[string]string, *Response) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("file", filename); err != nil {
		return nil, &Response{Error: NewAppError("UploadImportTeam", "model.client.upload_post_attachment.file.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, &Response{Error: NewAppError("UploadImportTeam", "model.client.upload_post_attachment.file.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if part, err := writer.CreateFormField("filesize"); err != nil {
		return nil, &Response{Error: NewAppError("UploadImportTeam", "model.client.upload_post_attachment.file_size.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, strings.NewReader(strconv.Itoa(filesize))); err != nil {
		return nil, &Response{Error: NewAppError("UploadImportTeam", "model.client.upload_post_attachment.file_size.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if part, err := writer.CreateFormField("importFrom"); err != nil {
		return nil, &Response{Error: NewAppError("UploadImportTeam", "model.client.upload_post_attachment.import_from.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, strings.NewReader(importFrom)); err != nil {
		return nil, &Response{Error: NewAppError("UploadImportTeam", "model.client.upload_post_attachment.import_from.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if err := writer.Close(); err != nil {
		return nil, &Response{Error: NewAppError("UploadImportTeam", "model.client.upload_post_attachment.writer.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	return c.DoUploadImportTeam(c.GetTeamImportRoute(teamId), body.Bytes(), writer.FormDataContentType())
}

// InviteUsersToTeam invite users by email to the team.
func (c *Client4) InviteUsersToTeam(teamId string, userEmails []string) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/invite/email", ArrayToJson(userEmails)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetTeamInviteInfo returns a team object from an invite id containing sanitized information.
func (c *Client4) GetTeamInviteInfo(inviteId string) (*Team, *Response) {
	if r, err := c.DoApiGet(c.GetTeamsRoute()+"/invite/"+inviteId, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return TeamFromJson(r.Body), BuildResponse(r)
	}
}

// Channel Section

// CreateChannel creates a channel based on the provided channel struct.
func (c *Client4) CreateChannel(channel *Channel) (*Channel, *Response) {
	if r, err := c.DoApiPost(c.GetChannelsRoute(), channel.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateChannel update a channel based on the provided channel struct.
func (c *Client4) UpdateChannel(channel *Channel) (*Channel, *Response) {
	if r, err := c.DoApiPut(c.GetChannelRoute(channel.Id), channel.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// PatchChannel partially updates a channel. Any missing fields are not updated.
func (c *Client4) PatchChannel(channelId string, patch *ChannelPatch) (*Channel, *Response) {
	if r, err := c.DoApiPut(c.GetChannelRoute(channelId)+"/patch", patch.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// RestoreChannel restores a previously deleted channel. Any missing fields are not updated.
func (c *Client4) RestoreChannel(channelId string) (*Channel, *Response) {
	if r, err := c.DoApiPost(c.GetChannelRoute(channelId)+"/restore", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// CreateDirectChannel creates a direct message channel based on the two user
// ids provided.
func (c *Client4) CreateDirectChannel(userId1, userId2 string) (*Channel, *Response) {
	requestBody := []string{userId1, userId2}
	if r, err := c.DoApiPost(c.GetChannelsRoute()+"/direct", ArrayToJson(requestBody)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// CreateGroupChannel creates a group message channel based on userIds provided
func (c *Client4) CreateGroupChannel(userIds []string) (*Channel, *Response) {
	if r, err := c.DoApiPost(c.GetChannelsRoute()+"/group", ArrayToJson(userIds)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannel returns a channel based on the provided channel id string.
func (c *Client4) GetChannel(channelId, etag string) (*Channel, *Response) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelStats returns statistics for a channel.
func (c *Client4) GetChannelStats(channelId string, etag string) (*ChannelStats, *Response) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/stats", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelStatsFromJson(r.Body), BuildResponse(r)
	}
}

// GetPinnedPosts gets a list of pinned posts.
func (c *Client4) GetPinnedPosts(channelId string, etag string) (*PostList, *Response) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/pinned", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// GetPublicChannelsForTeam returns a list of public channels based on the provided team id string.
func (c *Client4) GetPublicChannelsForTeam(teamId string, page int, perPage int, etag string) ([]*Channel, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetChannelsForTeamRoute(teamId)+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelSliceFromJson(r.Body), BuildResponse(r)
	}
}

// GetDeletedChannelsForTeam returns a list of public channels based on the provided team id string.
func (c *Client4) GetDeletedChannelsForTeam(teamId string, page int, perPage int, etag string) ([]*Channel, *Response) {
	query := fmt.Sprintf("/deleted?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetChannelsForTeamRoute(teamId)+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelSliceFromJson(r.Body), BuildResponse(r)
	}
}

// GetPublicChannelsByIdsForTeam returns a list of public channels based on provided team id string
func (c *Client4) GetPublicChannelsByIdsForTeam(teamId string, channelIds []string) ([]*Channel, *Response) {
	if r, err := c.DoApiPost(c.GetChannelsForTeamRoute(teamId)+"/ids", ArrayToJson(channelIds)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelSliceFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelsForTeamForUser returns a list channels of on a team for a user.
func (c *Client4) GetChannelsForTeamForUser(teamId, userId, etag string) ([]*Channel, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+c.GetTeamRoute(teamId)+"/channels", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelSliceFromJson(r.Body), BuildResponse(r)
	}
}

// SearchChannels returns the channels on a team matching the provided search term.
func (c *Client4) SearchChannels(teamId string, search *ChannelSearch) ([]*Channel, *Response) {
	if r, err := c.DoApiPost(c.GetChannelsForTeamRoute(teamId)+"/search", search.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelSliceFromJson(r.Body), BuildResponse(r)
	}
}

// DeleteChannel deletes channel based on the provided channel id string.
func (c *Client4) DeleteChannel(channelId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetChannelRoute(channelId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetChannelByName returns a channel based on the provided channel name and team id strings.
func (c *Client4) GetChannelByName(channelName, teamId string, etag string) (*Channel, *Response) {
	if r, err := c.DoApiGet(c.GetChannelByNameRoute(channelName, teamId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelByNameForTeamName returns a channel based on the provided channel name and team name strings.
func (c *Client4) GetChannelByNameForTeamName(channelName, teamName string, etag string) (*Channel, *Response) {
	if r, err := c.DoApiGet(c.GetChannelByNameForTeamNameRoute(channelName, teamName), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelMembers gets a page of channel members.
func (c *Client4) GetChannelMembers(channelId string, page, perPage int, etag string) (*ChannelMembers, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetChannelMembersRoute(channelId)+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelMembersFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelMembersByIds gets the channel members in a channel for a list of user ids.
func (c *Client4) GetChannelMembersByIds(channelId string, userIds []string) (*ChannelMembers, *Response) {
	if r, err := c.DoApiPost(c.GetChannelMembersRoute(channelId)+"/ids", ArrayToJson(userIds)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelMembersFromJson(r.Body), BuildResponse(r)

	}
}

// GetChannelMember gets a channel member.
func (c *Client4) GetChannelMember(channelId, userId, etag string) (*ChannelMember, *Response) {
	if r, err := c.DoApiGet(c.GetChannelMemberRoute(channelId, userId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelMemberFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelMembersForUser gets all the channel members for a user on a team.
func (c *Client4) GetChannelMembersForUser(userId, teamId, etag string) (*ChannelMembers, *Response) {
	if r, err := c.DoApiGet(fmt.Sprintf(c.GetUserRoute(userId)+"/teams/%v/channels/members", teamId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelMembersFromJson(r.Body), BuildResponse(r)
	}
}

// ViewChannel performs a view action for a user. Synonymous with switching channels or marking channels as read by a user.
func (c *Client4) ViewChannel(userId string, view *ChannelView) (*ChannelViewResponse, *Response) {
	url := fmt.Sprintf(c.GetChannelsRoute()+"/members/%v/view", userId)
	if r, err := c.DoApiPost(url, view.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelViewResponseFromJson(r.Body), BuildResponse(r)
	}
}

// GetChannelUnread will return a ChannelUnread object that contains the number of
// unread messages and mentions for a user.
func (c *Client4) GetChannelUnread(channelId, userId string) (*ChannelUnread, *Response) {
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+c.GetChannelRoute(channelId)+"/unread", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelUnreadFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateChannelRoles will update the roles on a channel for a user.
func (c *Client4) UpdateChannelRoles(channelId, userId, roles string) (bool, *Response) {
	requestBody := map[string]string{"roles": roles}
	if r, err := c.DoApiPut(c.GetChannelMemberRoute(channelId, userId)+"/roles", MapToJson(requestBody)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// UpdateChannelNotifyProps will update the notification properties on a channel for a user.
func (c *Client4) UpdateChannelNotifyProps(channelId, userId string, props map[string]string) (bool, *Response) {
	if r, err := c.DoApiPut(c.GetChannelMemberRoute(channelId, userId)+"/notify_props", MapToJson(props)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// AddChannelMember adds user to channel and return a channel member.
func (c *Client4) AddChannelMember(channelId, userId string) (*ChannelMember, *Response) {
	requestBody := map[string]string{"user_id": userId}
	if r, err := c.DoApiPost(c.GetChannelMembersRoute(channelId)+"", MapToJson(requestBody)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelMemberFromJson(r.Body), BuildResponse(r)
	}
}

// AddChannelMemberWithRootId adds user to channel and return a channel member. Post add to channel message has the postRootId.
func (c *Client4) AddChannelMemberWithRootId(channelId, userId, postRootId string) (*ChannelMember, *Response) {
	requestBody := map[string]string{"user_id": userId, "post_root_id": postRootId}
	if r, err := c.DoApiPost(c.GetChannelMembersRoute(channelId)+"", MapToJson(requestBody)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ChannelMemberFromJson(r.Body), BuildResponse(r)
	}
}

// RemoveUserFromChannel will delete the channel member object for a user, effectively removing the user from a channel.
func (c *Client4) RemoveUserFromChannel(channelId, userId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetChannelMemberRoute(channelId, userId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Post Section

// CreatePost creates a post based on the provided post struct.
func (c *Client4) CreatePost(post *Post) (*Post, *Response) {
	if r, err := c.DoApiPost(c.GetPostsRoute(), post.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostFromJson(r.Body), BuildResponse(r)
	}
}

// UpdatePost updates a post based on the provided post struct.
func (c *Client4) UpdatePost(postId string, post *Post) (*Post, *Response) {
	if r, err := c.DoApiPut(c.GetPostRoute(postId), post.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostFromJson(r.Body), BuildResponse(r)
	}
}

// PatchPost partially updates a post. Any missing fields are not updated.
func (c *Client4) PatchPost(postId string, patch *PostPatch) (*Post, *Response) {
	if r, err := c.DoApiPut(c.GetPostRoute(postId)+"/patch", patch.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostFromJson(r.Body), BuildResponse(r)
	}
}

// PinPost pin a post based on provided post id string.
func (c *Client4) PinPost(postId string) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetPostRoute(postId)+"/pin", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// UnpinPost unpin a post based on provided post id string.
func (c *Client4) UnpinPost(postId string) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetPostRoute(postId)+"/unpin", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetPost gets a single post.
func (c *Client4) GetPost(postId string, etag string) (*Post, *Response) {
	if r, err := c.DoApiGet(c.GetPostRoute(postId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostFromJson(r.Body), BuildResponse(r)
	}
}

// DeletePost deletes a post from the provided post id string.
func (c *Client4) DeletePost(postId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetPostRoute(postId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetPostThread gets a post with all the other posts in the same thread.
func (c *Client4) GetPostThread(postId string, etag string) (*PostList, *Response) {
	if r, err := c.DoApiGet(c.GetPostRoute(postId)+"/thread", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// GetPostsForChannel gets a page of posts with an array for ordering for a channel.
func (c *Client4) GetPostsForChannel(channelId string, page, perPage int, etag string) (*PostList, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/posts"+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// GetFlaggedPostsForUser returns flagged posts of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUser(userId string, page int, perPage int) (*PostList, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/posts/flagged"+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// GetFlaggedPostsForUserInTeam returns flagged posts in team of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUserInTeam(userId string, teamId string, page int, perPage int) (*PostList, *Response) {
	if len(teamId) == 0 || len(teamId) != 26 {
		return nil, &Response{StatusCode: http.StatusBadRequest, Error: NewAppError("GetFlaggedPostsForUserInTeam", "model.client.get_flagged_posts_in_team.missing_parameter.app_error", nil, "", http.StatusBadRequest)}
	}

	query := fmt.Sprintf("?team_id=%v&page=%v&per_page=%v", teamId, page, perPage)
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/posts/flagged"+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// GetFlaggedPostsForUserInChannel returns flagged posts in channel of a user based on user id string.
func (c *Client4) GetFlaggedPostsForUserInChannel(userId string, channelId string, page int, perPage int) (*PostList, *Response) {
	if len(channelId) == 0 || len(channelId) != 26 {
		return nil, &Response{StatusCode: http.StatusBadRequest, Error: NewAppError("GetFlaggedPostsForUserInChannel", "model.client.get_flagged_posts_in_channel.missing_parameter.app_error", nil, "", http.StatusBadRequest)}
	}

	query := fmt.Sprintf("?channel_id=%v&page=%v&per_page=%v", channelId, page, perPage)
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/posts/flagged"+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// GetPostsSince gets posts created after a specified time as Unix time in milliseconds.
func (c *Client4) GetPostsSince(channelId string, time int64) (*PostList, *Response) {
	query := fmt.Sprintf("?since=%v", time)
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/posts"+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// GetPostsAfter gets a page of posts that were posted after the post provided.
func (c *Client4) GetPostsAfter(channelId, postId string, page, perPage int, etag string) (*PostList, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v&after=%v", page, perPage, postId)
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/posts"+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// GetPostsBefore gets a page of posts that were posted before the post provided.
func (c *Client4) GetPostsBefore(channelId, postId string, page, perPage int, etag string) (*PostList, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v&before=%v", page, perPage, postId)
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/posts"+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// SearchPosts returns any posts with matching terms string.
func (c *Client4) SearchPosts(teamId string, terms string, isOrSearch bool) (*PostList, *Response) {
	requestBody := map[string]interface{}{"terms": terms, "is_or_search": isOrSearch}
	if r, err := c.DoApiPost(c.GetTeamRoute(teamId)+"/posts/search", StringInterfaceToJson(requestBody)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body), BuildResponse(r)
	}
}

// DoPostAction performs a post action.
func (c *Client4) DoPostAction(postId, actionId string) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetPostRoute(postId)+"/actions/"+actionId, ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// File Section

// UploadFile will upload a file to a channel, to be later attached to a post.
func (c *Client4) UploadFile(data []byte, channelId string, filename string) (*FileUploadResponse, *Response) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("files", filename); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.file.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.file.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if part, err := writer.CreateFormField("channel_id"); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.channel_id.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, strings.NewReader(channelId)); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.channel_id.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if err := writer.Close(); err != nil {
		return nil, &Response{Error: NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.writer.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	return c.DoUploadFile(c.GetFilesRoute(), body.Bytes(), writer.FormDataContentType())
}

// GetFile gets the bytes for a file by id.
func (c *Client4) GetFile(fileId string) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		if data, err := ioutil.ReadAll(r.Body); err != nil {
			return nil, BuildErrorResponse(r, NewAppError("GetFile", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode))
		} else {
			return data, BuildResponse(r)
		}
	}
}

// DownloadFile gets the bytes for a file by id, optionally adding headers to force the browser to download it
func (c *Client4) DownloadFile(fileId string, download bool) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+fmt.Sprintf("?download=%v", download), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		if data, err := ioutil.ReadAll(r.Body); err != nil {
			return nil, BuildErrorResponse(r, NewAppError("DownloadFile", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode))
		} else {
			return data, BuildResponse(r)
		}
	}
}

// GetFileThumbnail gets the bytes for a file by id.
func (c *Client4) GetFileThumbnail(fileId string) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/thumbnail", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		if data, err := ioutil.ReadAll(r.Body); err != nil {
			return nil, BuildErrorResponse(r, NewAppError("GetFileThumbnail", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode))
		} else {
			return data, BuildResponse(r)
		}
	}
}

// DownloadFileThumbnail gets the bytes for a file by id, optionally adding headers to force the browser to download it.
func (c *Client4) DownloadFileThumbnail(fileId string, download bool) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+fmt.Sprintf("/thumbnail?download=%v", download), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		if data, err := ioutil.ReadAll(r.Body); err != nil {
			return nil, BuildErrorResponse(r, NewAppError("DownloadFileThumbnail", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode))
		} else {
			return data, BuildResponse(r)
		}
	}
}

// GetFileLink gets the public link of a file by id.
func (c *Client4) GetFileLink(fileId string) (string, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/link", ""); err != nil {
		return "", BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		return MapFromJson(r.Body)["link"], BuildResponse(r)
	}
}

// GetFilePreview gets the bytes for a file by id.
func (c *Client4) GetFilePreview(fileId string) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/preview", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		if data, err := ioutil.ReadAll(r.Body); err != nil {
			return nil, BuildErrorResponse(r, NewAppError("GetFilePreview", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode))
		} else {
			return data, BuildResponse(r)
		}
	}
}

// DownloadFilePreview gets the bytes for a file by id.
func (c *Client4) DownloadFilePreview(fileId string, download bool) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+fmt.Sprintf("/preview?download=%v", download), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		if data, err := ioutil.ReadAll(r.Body); err != nil {
			return nil, BuildErrorResponse(r, NewAppError("DownloadFilePreview", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode))
		} else {
			return data, BuildResponse(r)
		}
	}
}

// GetFileInfo gets all the file info objects.
func (c *Client4) GetFileInfo(fileId string) (*FileInfo, *Response) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/info", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return FileInfoFromJson(r.Body), BuildResponse(r)
	}
}

// GetFileInfosForPost gets all the file info objects attached to a post.
func (c *Client4) GetFileInfosForPost(postId string, etag string) ([]*FileInfo, *Response) {
	if r, err := c.DoApiGet(c.GetPostRoute(postId)+"/files/info", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return FileInfosFromJson(r.Body), BuildResponse(r)
	}
}

// General/System Section

// GetPing will return ok if the running goRoutines are below the threshold and unhealthy for above.
func (c *Client4) GetPing() (string, *Response) {
	if r, err := c.DoApiGet(c.GetSystemRoute()+"/ping", ""); r != nil && r.StatusCode == 500 {
		defer r.Body.Close()
		return "unhealthy", BuildErrorResponse(r, err)
	} else if err != nil {
		return "", BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body)["status"], BuildResponse(r)
	}
}

// TestEmail will attempt to connect to the configured SMTP server.
func (c *Client4) TestEmail() (bool, *Response) {
	if r, err := c.DoApiPost(c.GetTestEmailRoute(), ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetConfig will retrieve the server config with some sanitized items.
func (c *Client4) GetConfig() (*Config, *Response) {
	if r, err := c.DoApiGet(c.GetConfigRoute(), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ConfigFromJson(r.Body), BuildResponse(r)
	}
}

// ReloadConfig will reload the server configuration.
func (c *Client4) ReloadConfig() (bool, *Response) {
	if r, err := c.DoApiPost(c.GetConfigRoute()+"/reload", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetOldClientConfig will retrieve the parts of the server configuration needed by the
// client, formatted in the old format.
func (c *Client4) GetOldClientConfig(etag string) (map[string]string, *Response) {
	if r, err := c.DoApiGet(c.GetConfigRoute()+"/client?format=old", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body), BuildResponse(r)
	}
}

// GetOldClientLicense will retrieve the parts of the server license needed by the
// client, formatted in the old format.
func (c *Client4) GetOldClientLicense(etag string) (map[string]string, *Response) {
	if r, err := c.DoApiGet(c.GetLicenseRoute()+"/client?format=old", etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body), BuildResponse(r)
	}
}

// DatabaseRecycle will recycle the connections. Discard current connection and get new one.
func (c *Client4) DatabaseRecycle() (bool, *Response) {
	if r, err := c.DoApiPost(c.GetDatabaseRoute()+"/recycle", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// InvalidateCaches will purge the cache and can affect the performance while is cleaning.
func (c *Client4) InvalidateCaches() (bool, *Response) {
	if r, err := c.DoApiPost(c.GetCacheRoute()+"/invalidate", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// UpdateConfig will update the server configuration.
func (c *Client4) UpdateConfig(config *Config) (*Config, *Response) {
	if r, err := c.DoApiPut(c.GetConfigRoute(), config.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ConfigFromJson(r.Body), BuildResponse(r)
	}
}

// UploadLicenseFile will add a license file to the system.
func (c *Client4) UploadLicenseFile(data []byte) (bool, *Response) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("license", "test-license.mattermost-license"); err != nil {
		return false, &Response{Error: NewAppError("UploadLicenseFile", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return false, &Response{Error: NewAppError("UploadLicenseFile", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if err := writer.Close(); err != nil {
		return false, &Response{Error: NewAppError("UploadLicenseFile", "model.client.set_profile_user.writer.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	rq, _ := http.NewRequest("POST", c.ApiUrl+c.GetLicenseRoute(), bytes.NewReader(body.Bytes()))
	rq.Header.Set("Content-Type", writer.FormDataContentType())
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil || rp == nil {
		return false, &Response{StatusCode: http.StatusForbidden, Error: NewAppError(c.GetLicenseRoute(), "model.client.connecting.app_error", nil, err.Error(), http.StatusForbidden)}
	} else {
		defer closeBody(rp)

		if rp.StatusCode >= 300 {
			return false, BuildErrorResponse(rp, AppErrorFromJson(rp.Body))
		} else {
			return CheckStatusOK(rp), BuildResponse(rp)
		}
	}
}

// RemoveLicenseFile will remove the server license it exists. Note that this will
// disable all enterprise features.
func (c *Client4) RemoveLicenseFile() (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetLicenseRoute()); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetAnalyticsOld will retrieve analytics using the old format. New format is not
// available but the "/analytics" endpoint is reserved for it. The "name" argument is optional
// and defaults to "standard". The "teamId" argument is optional and will limit results
// to a specific team.
func (c *Client4) GetAnalyticsOld(name, teamId string) (AnalyticsRows, *Response) {
	query := fmt.Sprintf("?name=%v&teamId=%v", name, teamId)
	if r, err := c.DoApiGet(c.GetAnalyticsRoute()+"/old"+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return AnalyticsRowsFromJson(r.Body), BuildResponse(r)
	}
}

// Webhooks Section

// CreateIncomingWebhook creates an incoming webhook for a channel.
func (c *Client4) CreateIncomingWebhook(hook *IncomingWebhook) (*IncomingWebhook, *Response) {
	if r, err := c.DoApiPost(c.GetIncomingWebhooksRoute(), hook.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return IncomingWebhookFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateIncomingWebhook updates an incoming webhook for a channel.
func (c *Client4) UpdateIncomingWebhook(hook *IncomingWebhook) (*IncomingWebhook, *Response) {
	if r, err := c.DoApiPut(c.GetIncomingWebhookRoute(hook.Id), hook.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return IncomingWebhookFromJson(r.Body), BuildResponse(r)
	}
}

// GetIncomingWebhooks returns a page of incoming webhooks on the system. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooks(page int, perPage int, etag string) ([]*IncomingWebhook, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetIncomingWebhooksRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return IncomingWebhookListFromJson(r.Body), BuildResponse(r)
	}
}

// GetIncomingWebhooksForTeam returns a page of incoming webhooks for a team. Page counting starts at 0.
func (c *Client4) GetIncomingWebhooksForTeam(teamId string, page int, perPage int, etag string) ([]*IncomingWebhook, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v&team_id=%v", page, perPage, teamId)
	if r, err := c.DoApiGet(c.GetIncomingWebhooksRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return IncomingWebhookListFromJson(r.Body), BuildResponse(r)
	}
}

// GetIncomingWebhook returns an Incoming webhook given the hook ID
func (c *Client4) GetIncomingWebhook(hookID string, etag string) (*IncomingWebhook, *Response) {
	if r, err := c.DoApiGet(c.GetIncomingWebhookRoute(hookID), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return IncomingWebhookFromJson(r.Body), BuildResponse(r)
	}
}

// DeleteIncomingWebhook deletes and Incoming Webhook given the hook ID
func (c *Client4) DeleteIncomingWebhook(hookID string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetIncomingWebhookRoute(hookID)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// CreateOutgoingWebhook creates an outgoing webhook for a team or channel.
func (c *Client4) CreateOutgoingWebhook(hook *OutgoingWebhook) (*OutgoingWebhook, *Response) {
	if r, err := c.DoApiPost(c.GetOutgoingWebhooksRoute(), hook.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OutgoingWebhookFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateOutgoingWebhook creates an outgoing webhook for a team or channel.
func (c *Client4) UpdateOutgoingWebhook(hook *OutgoingWebhook) (*OutgoingWebhook, *Response) {
	if r, err := c.DoApiPut(c.GetOutgoingWebhookRoute(hook.Id), hook.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OutgoingWebhookFromJson(r.Body), BuildResponse(r)
	}
}

// GetOutgoingWebhooks returns a page of outgoing webhooks on the system. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooks(page int, perPage int, etag string) ([]*OutgoingWebhook, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetOutgoingWebhooksRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OutgoingWebhookListFromJson(r.Body), BuildResponse(r)
	}
}

// GetOutgoingWebhook outgoing webhooks on the system requested by Hook Id.
func (c *Client4) GetOutgoingWebhook(hookId string) (*OutgoingWebhook, *Response) {
	if r, err := c.DoApiGet(c.GetOutgoingWebhookRoute(hookId), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OutgoingWebhookFromJson(r.Body), BuildResponse(r)
	}
}

// GetOutgoingWebhooksForChannel returns a page of outgoing webhooks for a channel. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooksForChannel(channelId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v&channel_id=%v", page, perPage, channelId)
	if r, err := c.DoApiGet(c.GetOutgoingWebhooksRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OutgoingWebhookListFromJson(r.Body), BuildResponse(r)
	}
}

// GetOutgoingWebhooksForTeam returns a page of outgoing webhooks for a team. Page counting starts at 0.
func (c *Client4) GetOutgoingWebhooksForTeam(teamId string, page int, perPage int, etag string) ([]*OutgoingWebhook, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v&team_id=%v", page, perPage, teamId)
	if r, err := c.DoApiGet(c.GetOutgoingWebhooksRoute()+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OutgoingWebhookListFromJson(r.Body), BuildResponse(r)
	}
}

// RegenOutgoingHookToken regenerate the outgoing webhook token.
func (c *Client4) RegenOutgoingHookToken(hookId string) (*OutgoingWebhook, *Response) {
	if r, err := c.DoApiPost(c.GetOutgoingWebhookRoute(hookId)+"/regen_token", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OutgoingWebhookFromJson(r.Body), BuildResponse(r)
	}
}

// DeleteOutgoingWebhook delete the outgoing webhook on the system requested by Hook Id.
func (c *Client4) DeleteOutgoingWebhook(hookId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetOutgoingWebhookRoute(hookId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Preferences Section

// GetPreferences returns the user's preferences.
func (c *Client4) GetPreferences(userId string) (Preferences, *Response) {
	if r, err := c.DoApiGet(c.GetPreferencesRoute(userId), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		preferences, _ := PreferencesFromJson(r.Body)
		defer closeBody(r)
		return preferences, BuildResponse(r)
	}
}

// UpdatePreferences saves the user's preferences.
func (c *Client4) UpdatePreferences(userId string, preferences *Preferences) (bool, *Response) {
	if r, err := c.DoApiPut(c.GetPreferencesRoute(userId), preferences.ToJson()); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return true, BuildResponse(r)
	}
}

// DeletePreferences deletes the user's preferences.
func (c *Client4) DeletePreferences(userId string, preferences *Preferences) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetPreferencesRoute(userId)+"/delete", preferences.ToJson()); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return true, BuildResponse(r)
	}
}

// GetPreferencesByCategory returns the user's preferences from the provided category string.
func (c *Client4) GetPreferencesByCategory(userId string, category string) (Preferences, *Response) {
	url := fmt.Sprintf(c.GetPreferencesRoute(userId)+"/%s", category)
	if r, err := c.DoApiGet(url, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		preferences, _ := PreferencesFromJson(r.Body)
		defer closeBody(r)
		return preferences, BuildResponse(r)
	}
}

// GetPreferenceByCategoryAndName returns the user's preferences from the provided category and preference name string.
func (c *Client4) GetPreferenceByCategoryAndName(userId string, category string, preferenceName string) (*Preference, *Response) {
	url := fmt.Sprintf(c.GetPreferencesRoute(userId)+"/%s/name/%v", category, preferenceName)
	if r, err := c.DoApiGet(url, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PreferenceFromJson(r.Body), BuildResponse(r)
	}
}

// SAML Section

// GetSamlMetadata returns metadata for the SAML configuration.
func (c *Client4) GetSamlMetadata() (string, *Response) {
	if r, err := c.DoApiGet(c.GetSamlRoute()+"/metadata", ""); err != nil {
		return "", BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		buf := new(bytes.Buffer)
		buf.ReadFrom(r.Body)
		return buf.String(), BuildResponse(r)
	}
}

func samlFileToMultipart(data []byte, filename string) ([]byte, *multipart.Writer, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("certificate", filename); err != nil {
		return nil, nil, err
	} else if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, nil, err
	}

	return body.Bytes(), writer, nil
}

// UploadSamlIdpCertificate will upload an IDP certificate for SAML and set the config to use it.
func (c *Client4) UploadSamlIdpCertificate(data []byte, filename string) (bool, *Response) {
	body, writer, err := samlFileToMultipart(data, filename)
	if err != nil {
		return false, &Response{Error: NewAppError("UploadSamlIdpCertificate", "model.client.upload_saml_cert.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	_, resp := c.DoUploadFile(c.GetSamlRoute()+"/certificate/idp", body, writer.FormDataContentType())
	return resp.Error == nil, resp
}

// UploadSamlPublicCertificate will upload a public certificate for SAML and set the config to use it.
func (c *Client4) UploadSamlPublicCertificate(data []byte, filename string) (bool, *Response) {
	body, writer, err := samlFileToMultipart(data, filename)
	if err != nil {
		return false, &Response{Error: NewAppError("UploadSamlPublicCertificate", "model.client.upload_saml_cert.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	_, resp := c.DoUploadFile(c.GetSamlRoute()+"/certificate/public", body, writer.FormDataContentType())
	return resp.Error == nil, resp
}

// UploadSamlPrivateCertificate will upload a private key for SAML and set the config to use it.
func (c *Client4) UploadSamlPrivateCertificate(data []byte, filename string) (bool, *Response) {
	body, writer, err := samlFileToMultipart(data, filename)
	if err != nil {
		return false, &Response{Error: NewAppError("UploadSamlPrivateCertificate", "model.client.upload_saml_cert.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	_, resp := c.DoUploadFile(c.GetSamlRoute()+"/certificate/private", body, writer.FormDataContentType())
	return resp.Error == nil, resp
}

// DeleteSamlIdpCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlIdpCertificate() (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetSamlRoute() + "/certificate/idp"); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// DeleteSamlPublicCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPublicCertificate() (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetSamlRoute() + "/certificate/public"); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// DeleteSamlPrivateCertificate deletes the SAML IDP certificate from the server and updates the config to not use it and disable SAML.
func (c *Client4) DeleteSamlPrivateCertificate() (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetSamlRoute() + "/certificate/private"); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetSamlCertificateStatus returns metadata for the SAML configuration.
func (c *Client4) GetSamlCertificateStatus() (*SamlCertificateStatus, *Response) {
	if r, err := c.DoApiGet(c.GetSamlRoute()+"/certificate/status", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return SamlCertificateStatusFromJson(r.Body), BuildResponse(r)
	}
}

// Compliance Section

// CreateComplianceReport creates an incoming webhook for a channel.
func (c *Client4) CreateComplianceReport(report *Compliance) (*Compliance, *Response) {
	if r, err := c.DoApiPost(c.GetComplianceReportsRoute(), report.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ComplianceFromJson(r.Body), BuildResponse(r)
	}
}

// GetComplianceReports returns list of compliance reports.
func (c *Client4) GetComplianceReports(page, perPage int) (Compliances, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetComplianceReportsRoute()+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CompliancesFromJson(r.Body), BuildResponse(r)
	}
}

// GetComplianceReport returns a compliance report.
func (c *Client4) GetComplianceReport(reportId string) (*Compliance, *Response) {
	if r, err := c.DoApiGet(c.GetComplianceReportRoute(reportId), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ComplianceFromJson(r.Body), BuildResponse(r)
	}
}

// DownloadComplianceReport returns a full compliance report as a file.
func (c *Client4) DownloadComplianceReport(reportId string) ([]byte, *Response) {
	var rq *http.Request
	rq, _ = http.NewRequest("GET", c.ApiUrl+c.GetComplianceReportRoute(reportId), nil)
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil || rp == nil {
		return nil, &Response{Error: NewAppError("DownloadComplianceReport", "model.client.connecting.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else {
		defer closeBody(rp)

		if rp.StatusCode >= 300 {
			return nil, BuildErrorResponse(rp, AppErrorFromJson(rp.Body))
		} else if data, err := ioutil.ReadAll(rp.Body); err != nil {
			return nil, BuildErrorResponse(rp, NewAppError("DownloadComplianceReport", "model.client.read_file.app_error", nil, err.Error(), rp.StatusCode))
		} else {
			return data, BuildResponse(rp)
		}
	}
}

// Cluster Section

// GetClusterStatus returns the status of all the configured cluster nodes.
func (c *Client4) GetClusterStatus() ([]*ClusterInfo, *Response) {
	if r, err := c.DoApiGet(c.GetClusterRoute()+"/status", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ClusterInfosFromJson(r.Body), BuildResponse(r)
	}
}

// LDAP Section

// SyncLdap will force a sync with the configured LDAP server.
func (c *Client4) SyncLdap() (bool, *Response) {
	if r, err := c.DoApiPost(c.GetLdapRoute()+"/sync", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// TestLdap will attempt to connect to the configured LDAP server and return OK if configured
// correctly.
func (c *Client4) TestLdap() (bool, *Response) {
	if r, err := c.DoApiPost(c.GetLdapRoute()+"/test", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Audits Section

// GetAudits returns a list of audits for the whole system.
func (c *Client4) GetAudits(page int, perPage int, etag string) (Audits, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet("/audits"+query, etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return AuditsFromJson(r.Body), BuildResponse(r)
	}
}

// Brand Section

// GetBrandImage retrieves the previously uploaded brand image.
func (c *Client4) GetBrandImage() ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetBrandRoute()+"/image", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		if r.StatusCode >= 300 {
			return nil, BuildErrorResponse(r, AppErrorFromJson(r.Body))
		} else if data, err := ioutil.ReadAll(r.Body); err != nil {
			return nil, BuildErrorResponse(r, NewAppError("GetBrandImage", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode))
		} else {
			return data, BuildResponse(r)
		}
	}
}

// UploadBrandImage sets the brand image for the system.
func (c *Client4) UploadBrandImage(data []byte) (bool, *Response) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("image", "brand.png"); err != nil {
		return false, &Response{Error: NewAppError("UploadBrandImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)}
	} else if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return false, &Response{Error: NewAppError("UploadBrandImage", "model.client.set_profile_user.no_file.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	if err := writer.Close(); err != nil {
		return false, &Response{Error: NewAppError("UploadBrandImage", "model.client.set_profile_user.writer.app_error", nil, err.Error(), http.StatusBadRequest)}
	}

	rq, _ := http.NewRequest("POST", c.ApiUrl+c.GetBrandRoute()+"/image", bytes.NewReader(body.Bytes()))
	rq.Header.Set("Content-Type", writer.FormDataContentType())
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil || rp == nil {
		return false, &Response{StatusCode: http.StatusForbidden, Error: NewAppError(c.GetBrandRoute()+"/image", "model.client.connecting.app_error", nil, err.Error(), http.StatusForbidden)}
	} else {
		defer closeBody(rp)

		if rp.StatusCode >= 300 {
			return false, BuildErrorResponse(rp, AppErrorFromJson(rp.Body))
		} else {
			return CheckStatusOK(rp), BuildResponse(rp)
		}
	}
}

// Logs Section

// GetLogs page of logs as a string array.
func (c *Client4) GetLogs(page, perPage int) ([]string, *Response) {
	query := fmt.Sprintf("?page=%v&logs_per_page=%v", page, perPage)
	if r, err := c.DoApiGet("/logs"+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ArrayFromJson(r.Body), BuildResponse(r)
	}
}

// PostLog is a convenience Web Service call so clients can log messages into
// the server-side logs.  For example we typically log javascript error messages
// into the server-side.  It returns the log message if the logging was successful.
func (c *Client4) PostLog(message map[string]string) (map[string]string, *Response) {
	if r, err := c.DoApiPost("/logs", MapToJson(message)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body), BuildResponse(r)
	}
}

// OAuth Section

// CreateOAuthApp will register a new OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) CreateOAuthApp(app *OAuthApp) (*OAuthApp, *Response) {
	if r, err := c.DoApiPost(c.GetOAuthAppsRoute(), app.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OAuthAppFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateOAuthApp
func (c *Client4) UpdateOAuthApp(app *OAuthApp) (*OAuthApp, *Response) {
	if r, err := c.DoApiPut(c.GetOAuthAppRoute(app.Id), app.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OAuthAppFromJson(r.Body), BuildResponse(r)
	}
}

// GetOAuthApps gets a page of registered OAuth 2.0 client applications with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthApps(page, perPage int) ([]*OAuthApp, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetOAuthAppsRoute()+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OAuthAppListFromJson(r.Body), BuildResponse(r)
	}
}

// GetOAuthApp gets a registered OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthApp(appId string) (*OAuthApp, *Response) {
	if r, err := c.DoApiGet(c.GetOAuthAppRoute(appId), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OAuthAppFromJson(r.Body), BuildResponse(r)
	}
}

// GetOAuthAppInfo gets a sanitized version of a registered OAuth 2.0 client application with Mattermost acting as an OAuth 2.0 service provider.
func (c *Client4) GetOAuthAppInfo(appId string) (*OAuthApp, *Response) {
	if r, err := c.DoApiGet(c.GetOAuthAppRoute(appId)+"/info", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OAuthAppFromJson(r.Body), BuildResponse(r)
	}
}

// DeleteOAuthApp deletes a registered OAuth 2.0 client application.
func (c *Client4) DeleteOAuthApp(appId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetOAuthAppRoute(appId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// RegenerateOAuthAppSecret regenerates the client secret for a registered OAuth 2.0 client application.
func (c *Client4) RegenerateOAuthAppSecret(appId string) (*OAuthApp, *Response) {
	if r, err := c.DoApiPost(c.GetOAuthAppRoute(appId)+"/regen_secret", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OAuthAppFromJson(r.Body), BuildResponse(r)
	}
}

// GetAuthorizedOAuthAppsForUser gets a page of OAuth 2.0 client applications the user has authorized to use access their account.
func (c *Client4) GetAuthorizedOAuthAppsForUser(userId string, page, perPage int) ([]*OAuthApp, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetUserRoute(userId)+"/oauth/apps/authorized"+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return OAuthAppListFromJson(r.Body), BuildResponse(r)
	}
}

// AuthorizeOAuthApp will authorize an OAuth 2.0 client application to access a user's account and provide a redirect link to follow.
func (c *Client4) AuthorizeOAuthApp(authRequest *AuthorizeRequest) (string, *Response) {
	if r, err := c.DoApiRequest(http.MethodPost, c.Url+"/oauth/authorize", authRequest.ToJson(), ""); err != nil {
		return "", BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body)["redirect"], BuildResponse(r)
	}
}

// DeauthorizeOAuthApp will deauthorize an OAuth 2.0 client application from accessing a user's account.
func (c *Client4) DeauthorizeOAuthApp(appId string) (bool, *Response) {
	requestData := map[string]string{"client_id": appId}
	if r, err := c.DoApiRequest(http.MethodPost, c.Url+"/oauth/deauthorize", MapToJson(requestData), ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Elasticsearch Section

// TestElasticsearch will attempt to connect to the configured Elasticsearch server and return OK if configured
// correctly.
func (c *Client4) TestElasticsearch() (bool, *Response) {
	if r, err := c.DoApiPost(c.GetElasticsearchRoute()+"/test", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// PurgeElasticsearchIndexes immediately deletes all Elasticsearch indexes.
func (c *Client4) PurgeElasticsearchIndexes() (bool, *Response) {
	if r, err := c.DoApiPost(c.GetElasticsearchRoute()+"/purge_indexes", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Data Retention Section

// GetDataRetentionPolicy will get the current server data retention policy details.
func (c *Client4) GetDataRetentionPolicy() (*DataRetentionPolicy, *Response) {
	if r, err := c.DoApiGet(c.GetDataRetentionRoute()+"/policy", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return DataRetentionPolicyFromJson(r.Body), BuildResponse(r)
	}
}

// Commands Section

// CreateCommand will create a new command if the user have the right permissions.
func (c *Client4) CreateCommand(cmd *Command) (*Command, *Response) {
	if r, err := c.DoApiPost(c.GetCommandsRoute(), cmd.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CommandFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateCommand updates a command based on the provided Command struct
func (c *Client4) UpdateCommand(cmd *Command) (*Command, *Response) {
	if r, err := c.DoApiPut(c.GetCommandRoute(cmd.Id), cmd.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CommandFromJson(r.Body), BuildResponse(r)
	}
}

// DeleteCommand deletes a command based on the provided command id string
func (c *Client4) DeleteCommand(commandId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetCommandRoute(commandId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// ListCommands will retrieve a list of commands available in the team.
func (c *Client4) ListCommands(teamId string, customOnly bool) ([]*Command, *Response) {
	query := fmt.Sprintf("?team_id=%v&custom_only=%v", teamId, customOnly)
	if r, err := c.DoApiGet(c.GetCommandsRoute()+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CommandListFromJson(r.Body), BuildResponse(r)
	}
}

// ExecuteCommand executes a given slash command.
func (c *Client4) ExecuteCommand(channelId, command string) (*CommandResponse, *Response) {
	commandArgs := &CommandArgs{
		ChannelId: channelId,
		Command:   command,
	}
	if r, err := c.DoApiPost(c.GetCommandsRoute()+"/execute", commandArgs.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CommandResponseFromJson(r.Body), BuildResponse(r)
	}
}

// ExecuteCommand executes a given slash command against the specified team
// Use this when executing slash commands in a DM/GM, since the team id cannot be inferred in that case
func (c *Client4) ExecuteCommandWithTeam(channelId, teamId, command string) (*CommandResponse, *Response) {
	commandArgs := &CommandArgs{
		ChannelId: channelId,
		TeamId:    teamId,
		Command:   command,
	}
	if r, err := c.DoApiPost(c.GetCommandsRoute()+"/execute", commandArgs.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CommandResponseFromJson(r.Body), BuildResponse(r)
	}
}

// ListCommands will retrieve a list of commands available in the team.
func (c *Client4) ListAutocompleteCommands(teamId string) ([]*Command, *Response) {
	if r, err := c.DoApiGet(c.GetTeamAutoCompleteCommandsRoute(teamId), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CommandListFromJson(r.Body), BuildResponse(r)
	}
}

// RegenCommandToken will create a new token if the user have the right permissions.
func (c *Client4) RegenCommandToken(commandId string) (string, *Response) {
	if r, err := c.DoApiPut(c.GetCommandRoute(commandId)+"/regen_token", ""); err != nil {
		return "", BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body)["token"], BuildResponse(r)
	}
}

// Status Section

// GetUserStatus returns a user based on the provided user id string.
func (c *Client4) GetUserStatus(userId, etag string) (*Status, *Response) {
	if r, err := c.DoApiGet(c.GetUserStatusRoute(userId), etag); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return StatusFromJson(r.Body), BuildResponse(r)
	}
}

// GetUsersStatusesByIds returns a list of users status based on the provided user ids.
func (c *Client4) GetUsersStatusesByIds(userIds []string) ([]*Status, *Response) {
	if r, err := c.DoApiPost(c.GetUserStatusesRoute()+"/ids", ArrayToJson(userIds)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return StatusListFromJson(r.Body), BuildResponse(r)
	}
}

// UpdateUserStatus sets a user's status based on the provided user id string.
func (c *Client4) UpdateUserStatus(userId string, userStatus *Status) (*Status, *Response) {
	if r, err := c.DoApiPut(c.GetUserStatusRoute(userId), userStatus.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return StatusFromJson(r.Body), BuildResponse(r)

	}
}

// Webrtc Section

// GetWebrtcToken returns a valid token, stun server and turn server with credentials to
// use with the Mattermost WebRTC service.
func (c *Client4) GetWebrtcToken() (*WebrtcInfoResponse, *Response) {
	if r, err := c.DoApiGet("/webrtc/token", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return WebrtcInfoResponseFromJson(r.Body), BuildResponse(r)
	}
}

// Emoji Section

// CreateEmoji will save an emoji to the server if the current user has permission
// to do so. If successful, the provided emoji will be returned with its Id field
// filled in. Otherwise, an error will be returned.
func (c *Client4) CreateEmoji(emoji *Emoji, image []byte, filename string) (*Emoji, *Response) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("image", filename); err != nil {
		return nil, &Response{StatusCode: http.StatusForbidden, Error: NewAppError("CreateEmoji", "model.client.create_emoji.image.app_error", nil, err.Error(), 0)}
	} else if _, err = io.Copy(part, bytes.NewBuffer(image)); err != nil {
		return nil, &Response{StatusCode: http.StatusForbidden, Error: NewAppError("CreateEmoji", "model.client.create_emoji.image.app_error", nil, err.Error(), 0)}
	}

	if err := writer.WriteField("emoji", emoji.ToJson()); err != nil {
		return nil, &Response{StatusCode: http.StatusForbidden, Error: NewAppError("CreateEmoji", "model.client.create_emoji.emoji.app_error", nil, err.Error(), 0)}
	}

	if err := writer.Close(); err != nil {
		return nil, &Response{StatusCode: http.StatusForbidden, Error: NewAppError("CreateEmoji", "model.client.create_emoji.writer.app_error", nil, err.Error(), 0)}
	}

	return c.DoEmojiUploadFile(c.GetEmojisRoute(), body.Bytes(), writer.FormDataContentType())
}

// GetEmojiList returns a page of custom emoji on the system.
func (c *Client4) GetEmojiList(page, perPage int) ([]*Emoji, *Response) {
	query := fmt.Sprintf("?page=%v&per_page=%v", page, perPage)
	if r, err := c.DoApiGet(c.GetEmojisRoute()+query, ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return EmojiListFromJson(r.Body), BuildResponse(r)
	}
}

// DeleteEmoji delete an custom emoji on the provided emoji id string.
func (c *Client4) DeleteEmoji(emojiId string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetEmojiRoute(emojiId)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetEmoji returns a custom emoji in the system on the provided emoji id string.
func (c *Client4) GetEmoji(emojiId string) (*Emoji, *Response) {
	if r, err := c.DoApiGet(c.GetEmojiRoute(emojiId), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return EmojiFromJson(r.Body), BuildResponse(r)
	}
}

// GetEmojiImage returns the emoji image.
func (c *Client4) GetEmojiImage(emojiId string) ([]byte, *Response) {
	if r, err := c.DoApiGet(c.GetEmojiRoute(emojiId)+"/image", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)

		if data, err := ioutil.ReadAll(r.Body); err != nil {
			return nil, BuildErrorResponse(r, NewAppError("GetEmojiImage", "model.client.read_file.app_error", nil, err.Error(), r.StatusCode))
		} else {
			return data, BuildResponse(r)
		}
	}
}

// Reaction Section

// SaveReaction saves an emoji reaction for a post. Returns the saved reaction if successful, otherwise an error will be returned.
func (c *Client4) SaveReaction(reaction *Reaction) (*Reaction, *Response) {
	if r, err := c.DoApiPost(c.GetReactionsRoute(), reaction.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ReactionFromJson(r.Body), BuildResponse(r)
	}
}

// GetReactions returns a list of reactions to a post.
func (c *Client4) GetReactions(postId string) ([]*Reaction, *Response) {
	if r, err := c.DoApiGet(c.GetPostRoute(postId)+"/reactions", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ReactionsFromJson(r.Body), BuildResponse(r)
	}
}

// DeleteReaction deletes reaction of a user in a post.
func (c *Client4) DeleteReaction(reaction *Reaction) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetUserRoute(reaction.UserId) + c.GetPostRoute(reaction.PostId) + fmt.Sprintf("/reactions/%v", reaction.EmojiName)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Open Graph Metadata Section

// OpenGraph return the open graph metadata for a particular url if the site have the metadata
func (c *Client4) OpenGraph(url string) (map[string]string, *Response) {
	requestBody := make(map[string]string)
	requestBody["url"] = url

	if r, err := c.DoApiPost(c.GetOpenGraphRoute(), MapToJson(requestBody)); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body), BuildResponse(r)
	}
}

// Jobs Section

// GetJob gets a single job.
func (c *Client4) GetJob(id string) (*Job, *Response) {
	if r, err := c.DoApiGet(c.GetJobsRoute()+fmt.Sprintf("/%v", id), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return JobFromJson(r.Body), BuildResponse(r)
	}
}

// Get all jobs, sorted with the job that was created most recently first.
func (c *Client4) GetJobs(page int, perPage int) ([]*Job, *Response) {
	if r, err := c.DoApiGet(c.GetJobsRoute()+fmt.Sprintf("?page=%v&per_page=%v", page, perPage), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return JobsFromJson(r.Body), BuildResponse(r)
	}
}

// GetJobsByType gets all jobs of a given type, sorted with the job that was created most recently first.
func (c *Client4) GetJobsByType(jobType string, page int, perPage int) ([]*Job, *Response) {
	if r, err := c.DoApiGet(c.GetJobsRoute()+fmt.Sprintf("/type/%v?page=%v&per_page=%v", jobType, page, perPage), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return JobsFromJson(r.Body), BuildResponse(r)
	}
}

// CreateJob creates a job based on the provided job struct.
func (c *Client4) CreateJob(job *Job) (*Job, *Response) {
	if r, err := c.DoApiPost(c.GetJobsRoute(), job.ToJson()); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return JobFromJson(r.Body), BuildResponse(r)
	}
}

// CancelJob requests the cancellation of the job with the provided Id.
func (c *Client4) CancelJob(jobId string) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetJobsRoute()+fmt.Sprintf("/%v/cancel", jobId), ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// Plugin Section

// UploadPlugin takes an io.Reader stream pointing to the contents of a .tar.gz plugin.
// WARNING: PLUGINS ARE STILL EXPERIMENTAL. THIS FUNCTION IS SUBJECT TO CHANGE.
func (c *Client4) UploadPlugin(file io.Reader) (*Manifest, *Response) {
	body := new(bytes.Buffer)
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("plugin", "plugin.tar.gz"); err != nil {
		return nil, &Response{Error: NewAppError("UploadPlugin", "model.client.writer.app_error", nil, err.Error(), 0)}
	} else if _, err = io.Copy(part, file); err != nil {
		return nil, &Response{Error: NewAppError("UploadPlugin", "model.client.writer.app_error", nil, err.Error(), 0)}
	}

	if err := writer.Close(); err != nil {
		return nil, &Response{Error: NewAppError("UploadPlugin", "model.client.writer.app_error", nil, err.Error(), 0)}
	}

	rq, _ := http.NewRequest("POST", c.ApiUrl+c.GetPluginsRoute(), body)
	rq.Header.Set("Content-Type", writer.FormDataContentType())
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil || rp == nil {
		return nil, BuildErrorResponse(rp, NewAppError("UploadPlugin", "model.client.connecting.app_error", nil, err.Error(), 0))
	} else {
		defer closeBody(rp)

		if rp.StatusCode >= 300 {
			return nil, BuildErrorResponse(rp, AppErrorFromJson(rp.Body))
		} else {
			return ManifestFromJson(rp.Body), BuildResponse(rp)
		}
	}
}

// GetPlugins will return a list of plugin manifests for currently active plugins.
// WARNING: PLUGINS ARE STILL EXPERIMENTAL. THIS FUNCTION IS SUBJECT TO CHANGE.
func (c *Client4) GetPlugins() (*PluginsResponse, *Response) {
	if r, err := c.DoApiGet(c.GetPluginsRoute(), ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return PluginsResponseFromJson(r.Body), BuildResponse(r)
	}
}

// RemovePlugin will deactivate and delete a plugin.
// WARNING: PLUGINS ARE STILL EXPERIMENTAL. THIS FUNCTION IS SUBJECT TO CHANGE.
func (c *Client4) RemovePlugin(id string) (bool, *Response) {
	if r, err := c.DoApiDelete(c.GetPluginRoute(id)); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// GetWebappPlugins will return a list of plugins that the webapp should download.
// WARNING: PLUGINS ARE STILL EXPERIMENTAL. THIS FUNCTION IS SUBJECT TO CHANGE.
func (c *Client4) GetWebappPlugins() ([]*Manifest, *Response) {
	if r, err := c.DoApiGet(c.GetPluginsRoute()+"/webapp", ""); err != nil {
		return nil, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return ManifestListFromJson(r.Body), BuildResponse(r)
	}
}

// ActivatePlugin will activate an plugin installed.
// WARNING: PLUGINS ARE STILL EXPERIMENTAL. THIS FUNCTION IS SUBJECT TO CHANGE.
func (c *Client4) ActivatePlugin(id string) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetPluginRoute(id)+"/activate", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}

// DeactivatePlugin will deactivate an active plugin.
// WARNING: PLUGINS ARE STILL EXPERIMENTAL. THIS FUNCTION IS SUBJECT TO CHANGE.
func (c *Client4) DeactivatePlugin(id string) (bool, *Response) {
	if r, err := c.DoApiPost(c.GetPluginRoute(id)+"/deactivate", ""); err != nil {
		return false, BuildErrorResponse(r, err)
	} else {
		defer closeBody(r)
		return CheckStatusOK(r), BuildResponse(r)
	}
}
