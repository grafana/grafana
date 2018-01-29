// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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
	"time"

	l4g "github.com/alecthomas/log4go"
)

var UsedApiV3 *int32 = new(int32)

const (
	HEADER_REQUEST_ID         = "X-Request-ID"
	HEADER_VERSION_ID         = "X-Version-ID"
	HEADER_CLUSTER_ID         = "X-Cluster-ID"
	HEADER_ETAG_SERVER        = "ETag"
	HEADER_ETAG_CLIENT        = "If-None-Match"
	HEADER_FORWARDED          = "X-Forwarded-For"
	HEADER_REAL_IP            = "X-Real-IP"
	HEADER_FORWARDED_PROTO    = "X-Forwarded-Proto"
	HEADER_TOKEN              = "token"
	HEADER_BEARER             = "BEARER"
	HEADER_AUTH               = "Authorization"
	HEADER_REQUESTED_WITH     = "X-Requested-With"
	HEADER_REQUESTED_WITH_XML = "XMLHttpRequest"
	STATUS                    = "status"
	STATUS_OK                 = "OK"
	STATUS_FAIL               = "FAIL"
	STATUS_REMOVE             = "REMOVE"

	CLIENT_DIR = "client"

	API_URL_SUFFIX_V1 = "/api/v1"
	API_URL_SUFFIX_V3 = "/api/v3"
	API_URL_SUFFIX_V4 = "/api/v4"
	API_URL_SUFFIX    = API_URL_SUFFIX_V4
)

type Result struct {
	RequestId string
	Etag      string
	Data      interface{}
}

type ResponseMetadata struct {
	StatusCode int
	Error      *AppError
	RequestId  string
	Etag       string
}

type Client struct {
	Url           string       // The location of the server like "http://localhost:8065"
	ApiUrl        string       // The api location of the server like "http://localhost:8065/api/v3"
	HttpClient    *http.Client // The http client
	AuthToken     string
	AuthType      string
	TeamId        string
	RequestId     string
	Etag          string
	ServerVersion string
}

// NewClient constructs a new client with convienence methods for talking to
// the server.
func NewClient(url string) *Client {
	return &Client{url, url + API_URL_SUFFIX_V3, &http.Client{}, "", "", "", "", "", ""}
}

func closeBody(r *http.Response) {
	if r.Body != nil {
		ioutil.ReadAll(r.Body)
		r.Body.Close()
	}
}

func (c *Client) SetOAuthToken(token string) {
	c.AuthToken = token
	c.AuthType = HEADER_TOKEN
}

func (c *Client) ClearOAuthToken() {
	c.AuthToken = ""
	c.AuthType = HEADER_BEARER
}

func (c *Client) SetTeamId(teamId string) {
	c.TeamId = teamId
}

func (c *Client) GetTeamId() string {
	if len(c.TeamId) == 0 {
		println(`You are trying to use a route that requires a team_id, 
        	but you have not called SetTeamId() in client.go`)
	}

	return c.TeamId
}

func (c *Client) ClearTeamId() {
	c.TeamId = ""
}

func (c *Client) GetTeamRoute() string {
	return fmt.Sprintf("/teams/%v", c.GetTeamId())
}

func (c *Client) GetChannelRoute(channelId string) string {
	return fmt.Sprintf("/teams/%v/channels/%v", c.GetTeamId(), channelId)
}

func (c *Client) GetUserRequiredRoute(userId string) string {
	return fmt.Sprintf("/users/%v", userId)
}

func (c *Client) GetChannelNameRoute(channelName string) string {
	return fmt.Sprintf("/teams/%v/channels/name/%v", c.GetTeamId(), channelName)
}

func (c *Client) GetEmojiRoute() string {
	return "/emoji"
}

func (c *Client) GetGeneralRoute() string {
	return "/general"
}

func (c *Client) GetFileRoute(fileId string) string {
	return fmt.Sprintf("/files/%v", fileId)
}

func (c *Client) DoPost(url, data, contentType string) (*http.Response, *AppError) {
	rq, _ := http.NewRequest("POST", c.Url+url, strings.NewReader(data))
	rq.Header.Set("Content-Type", contentType)
	rq.Close = true

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	} else if rp.StatusCode >= 300 {
		defer closeBody(rp)
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

func (c *Client) DoApiPost(url string, data string) (*http.Response, *AppError) {
	rq, _ := http.NewRequest("POST", c.ApiUrl+url, strings.NewReader(data))
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	} else if rp.StatusCode >= 300 {
		defer closeBody(rp)
		return nil, AppErrorFromJson(rp.Body)
	} else {
		return rp, nil
	}
}

func (c *Client) DoApiGet(url string, data string, etag string) (*http.Response, *AppError) {
	rq, _ := http.NewRequest("GET", c.ApiUrl+url, strings.NewReader(data))
	rq.Close = true

	if len(etag) > 0 {
		rq.Header.Set(HEADER_ETAG_CLIENT, etag)
	}

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, c.AuthType+" "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
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

func getCookie(name string, resp *http.Response) *http.Cookie {
	for _, cookie := range resp.Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}

	return nil
}

// Must is a convenience function used for testing.
func (c *Client) Must(result *Result, err *AppError) *Result {
	if err != nil {
		l4g.Close()
		time.Sleep(time.Second)
		panic(err)
	}

	return result
}

// MustGeneric is a convenience function used for testing.
func (c *Client) MustGeneric(result interface{}, err *AppError) interface{} {
	if err != nil {
		l4g.Close()
		time.Sleep(time.Second)
		panic(err)
	}

	return result
}

// CheckStatusOK is a convenience function for checking the return of Web Service
// call that return the a map of status=OK.
func (c *Client) CheckStatusOK(r *http.Response) bool {
	m := MapFromJson(r.Body)
	defer closeBody(r)

	if m != nil && m[STATUS] == STATUS_OK {
		return true
	}

	return false
}

func (c *Client) fillInExtraProperties(r *http.Response) {
	c.RequestId = r.Header.Get(HEADER_REQUEST_ID)
	c.Etag = r.Header.Get(HEADER_ETAG_SERVER)
	c.ServerVersion = r.Header.Get(HEADER_VERSION_ID)
}

func (c *Client) clearExtraProperties() {
	c.RequestId = ""
	c.Etag = ""
	c.ServerVersion = ""
}

// General Routes Section

// GetClientProperties returns properties needed by the client to show/hide
// certian features.  It returns a map of strings.
func (c *Client) GetClientProperties() (map[string]string, *AppError) {
	c.clearExtraProperties()
	if r, err := c.DoApiGet(c.GetGeneralRoute()+"/client_props", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return MapFromJson(r.Body), nil
	}
}

// LogClient is a convenience Web Service call so clients can log messages into
// the server-side logs.  For example we typically log javascript error messages
// into the server-side.  It returns true if the logging was successful.
func (c *Client) LogClient(message string) (bool, *AppError) {
	c.clearExtraProperties()
	m := make(map[string]string)
	m["level"] = "ERROR"
	m["message"] = message

	if r, err := c.DoApiPost(c.GetGeneralRoute()+"/log_client", MapToJson(m)); err != nil {
		return false, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return c.CheckStatusOK(r), nil
	}
}

// GetPing returns a map of strings with server time, server version, and node Id.
// Systems that want to check on health status of the server should check the
// url /api/v3/ping for a 200 status response.
func (c *Client) GetPing() (map[string]string, *AppError) {
	c.clearExtraProperties()
	if r, err := c.DoApiGet(c.GetGeneralRoute()+"/ping", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return MapFromJson(r.Body), nil
	}
}

// Team Routes Section

// CreateTeam creates a team based on the provided Team struct. On success it returns
// the Team struct with the Id, CreateAt and other server-decided fields populated.
func (c *Client) CreateTeam(team *Team) (*Result, *AppError) {
	if r, err := c.DoApiPost("/teams/create", team.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamFromJson(r.Body)}, nil
	}
}

// GetAllTeams returns a map of all teams using team ids as the key.
func (c *Client) GetAllTeams() (*Result, *AppError) {
	if r, err := c.DoApiGet("/teams/all", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamMapFromJson(r.Body)}, nil
	}
}

// GetAllTeamListings returns a map of all teams that are available to join
// using team ids as the key. Must be authenticated.
func (c *Client) GetAllTeamListings() (*Result, *AppError) {
	if r, err := c.DoApiGet("/teams/all_team_listings", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamMapFromJson(r.Body)}, nil
	}
}

// FindTeamByName returns the strings "true" or "false" depending on if a team
// with the provided name was found.
func (c *Client) FindTeamByName(name string) (*Result, *AppError) {
	m := make(map[string]string)
	m["name"] = name
	if r, err := c.DoApiPost("/teams/find_team_by_name", MapToJson(m)); err != nil {
		return nil, err
	} else {
		val := false
		if body, _ := ioutil.ReadAll(r.Body); string(body) == "true" {
			val = true
		}
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), val}, nil
	}
}

//  Adds a user directly to the team without sending an invite.
//  The teamId and userId are required.  You must be a valid member of the team and/or
//  have the correct role to add new users to the team.  Returns a map of user_id=userId
//  if successful, otherwise returns an AppError.
func (c *Client) AddUserToTeam(teamId string, userId string) (*Result, *AppError) {
	if len(teamId) == 0 {
		teamId = c.GetTeamId()
	}

	data := make(map[string]string)
	data["user_id"] = userId
	if r, err := c.DoApiPost(fmt.Sprintf("/teams/%v", teamId)+"/add_user_to_team", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// AddUserToTeamFromInvite adds a user to a team based off data provided in an invite link.
// Either hash and dataToHash are required or inviteId is required.
func (c *Client) AddUserToTeamFromInvite(hash, dataToHash, inviteId string) (*Result, *AppError) {
	data := make(map[string]string)
	data["hash"] = hash
	data["data"] = dataToHash
	data["invite_id"] = inviteId
	if r, err := c.DoApiPost("/teams/add_user_to_team_from_invite", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamFromJson(r.Body)}, nil
	}
}

//  Removes a user directly from the team.
//  The teamId and userId are required.  You must be a valid member of the team and/or
//  have the correct role to remove a user from the team.  Returns a map of user_id=userId
//  if successful, otherwise returns an AppError.
func (c *Client) RemoveUserFromTeam(teamId string, userId string) (*Result, *AppError) {
	if len(teamId) == 0 {
		teamId = c.GetTeamId()
	}

	data := make(map[string]string)
	data["user_id"] = userId
	if r, err := c.DoApiPost(fmt.Sprintf("/teams/%v", teamId)+"/remove_user_from_team", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) InviteMembers(invites *Invites) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/invite_members", invites.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), InvitesFromJson(r.Body)}, nil
	}
}

// UpdateTeam updates a team based on the changes in the provided team struct. On success
// it returns a sanitized version of the updated team. Must be authenticated as a team admin
// for that team or a system admin.
func (c *Client) UpdateTeam(team *Team) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/update", team.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamFromJson(r.Body)}, nil
	}
}

// User Routes Section

// CreateUser creates a user in the system based on the provided user struct.
func (c *Client) CreateUser(user *User, hash string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/create", user.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

// CreateUserWithInvite creates a user based on the provided user struct. Either the hash and
// data strings or the inviteId is required from the invite.
func (c *Client) CreateUserWithInvite(user *User, hash string, data string, inviteId string) (*Result, *AppError) {

	url := "/users/create?d=" + url.QueryEscape(data) + "&h=" + url.QueryEscape(hash) + "&iid=" + url.QueryEscape(inviteId)

	if r, err := c.DoApiPost(url, user.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateUserFromSignup(user *User, data string, hash string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/create?d="+url.QueryEscape(data)+"&h="+hash, user.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

// GetUser returns a user based on a provided user id string. Must be authenticated.
func (c *Client) GetUser(id string, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/"+id+"/get", "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

// getByUsername returns a user based on a provided username string. Must be authenticated.
func (c *Client) GetByUsername(username string, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/users/name/%v", username), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

// getByEmail returns a user based on a provided username string. Must be authenticated.
func (c *Client) GetByEmail(email string, etag string) (*User, *ResponseMetadata) {
	if r, err := c.DoApiGet(fmt.Sprintf("/users/email/%v", email), "", etag); err != nil {
		return nil, &ResponseMetadata{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return UserFromJson(r.Body),
			&ResponseMetadata{
				StatusCode: r.StatusCode,
				RequestId:  r.Header.Get(HEADER_REQUEST_ID),
				Etag:       r.Header.Get(HEADER_ETAG_SERVER),
			}
	}
}

// GetMe returns the current user.
func (c *Client) GetMe(etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/me", "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

// GetProfiles returns a map of users using user id as the key. Must be authenticated.
func (c *Client) GetProfiles(offset int, limit int, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/users/%v/%v", offset, limit), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserMapFromJson(r.Body)}, nil
	}
}

// GetProfilesInTeam returns a map of users for a team using user id as the key. Must
// be authenticated.
func (c *Client) GetProfilesInTeam(teamId string, offset int, limit int, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/teams/%v/users/%v/%v", teamId, offset, limit), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserMapFromJson(r.Body)}, nil
	}
}

// GetProfilesInChannel returns a map of users for a channel using user id as the key. Must
// be authenticated.
func (c *Client) GetProfilesInChannel(channelId string, offset int, limit int, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf(c.GetChannelRoute(channelId)+"/users/%v/%v", offset, limit), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserMapFromJson(r.Body)}, nil
	}
}

// GetProfilesNotInChannel returns a map of users not in a channel but on the team using user id as the key. Must
// be authenticated.
func (c *Client) GetProfilesNotInChannel(channelId string, offset int, limit int, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf(c.GetChannelRoute(channelId)+"/users/not_in_channel/%v/%v", offset, limit), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserMapFromJson(r.Body)}, nil
	}
}

// GetProfilesByIds returns a map of users based on the user ids provided. Must
// be authenticated.
func (c *Client) GetProfilesByIds(userIds []string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/ids", ArrayToJson(userIds)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserMapFromJson(r.Body)}, nil
	}
}

// SearchUsers returns a list of users that have a username matching or similar to the search term. Must
// be authenticated.
func (c *Client) SearchUsers(params UserSearch) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/search", params.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserListFromJson(r.Body)}, nil
	}
}

// AutocompleteUsersInChannel returns two lists for autocompletion of users in a channel. The first list "in_channel",
// specifies users in the channel. The second list "out_of_channel" specifies users outside of the
// channel. Term, the string to search against, is required, channel id is also required. Must be authenticated.
func (c *Client) AutocompleteUsersInChannel(term string, channelId string) (*Result, *AppError) {
	url := fmt.Sprintf("%s/users/autocomplete?term=%s", c.GetChannelRoute(channelId), url.QueryEscape(term))
	if r, err := c.DoApiGet(url, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserAutocompleteInChannelFromJson(r.Body)}, nil
	}
}

// AutocompleteUsersInTeam returns a list for autocompletion of users in a team. The list "in_team" specifies
// the users in the team that match the provided term, matching against username, full name and
// nickname. Must be authenticated.
func (c *Client) AutocompleteUsersInTeam(term string) (*Result, *AppError) {
	url := fmt.Sprintf("%s/users/autocomplete?term=%s", c.GetTeamRoute(), url.QueryEscape(term))
	if r, err := c.DoApiGet(url, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserAutocompleteInTeamFromJson(r.Body)}, nil
	}
}

// AutocompleteUsers returns a list for autocompletion of users on the system that match the provided term,
// matching against username, full name and nickname. Must be authenticated.
func (c *Client) AutocompleteUsers(term string) (*Result, *AppError) {
	url := fmt.Sprintf("/users/autocomplete?term=%s", url.QueryEscape(term))
	if r, err := c.DoApiGet(url, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserListFromJson(r.Body)}, nil
	}
}

// LoginById authenticates a user by user id and password.
func (c *Client) LoginById(id string, password string) (*Result, *AppError) {
	m := make(map[string]string)
	m["id"] = id
	m["password"] = password
	return c.login(m)
}

// Login authenticates a user by login id, which can be username, email or some sort
// of SSO identifier based on configuration, and a password.
func (c *Client) Login(loginId string, password string) (*Result, *AppError) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	return c.login(m)
}

// LoginByLdap authenticates a user by LDAP id and password.
func (c *Client) LoginByLdap(loginId string, password string) (*Result, *AppError) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["ldap_only"] = "true"
	return c.login(m)
}

// LoginWithDevice authenticates a user by login id (username, email or some sort
// of SSO identifier based on configuration), password and attaches a device id to
// the session.
func (c *Client) LoginWithDevice(loginId string, password string, deviceId string) (*Result, *AppError) {
	m := make(map[string]string)
	m["login_id"] = loginId
	m["password"] = password
	m["device_id"] = deviceId
	return c.login(m)
}

func (c *Client) login(m map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/login", MapToJson(m)); err != nil {
		return nil, err
	} else {
		c.AuthToken = r.Header.Get(HEADER_TOKEN)
		c.AuthType = HEADER_BEARER
		sessionToken := getCookie(SESSION_COOKIE_TOKEN, r)

		if c.AuthToken != sessionToken.Value {
			NewAppError("/users/login", "model.client.login.app_error", nil, "", 0)
		}

		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

// Logout terminates the current user's session.
func (c *Client) Logout() (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/logout", ""); err != nil {
		return nil, err
	} else {
		c.AuthToken = ""
		c.AuthType = HEADER_BEARER
		c.TeamId = ""

		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// CheckMfa returns a map with key "mfa_required" with the string value "true" or "false",
// indicating whether MFA is required to log the user in, based on a provided login id
// (username, email or some sort of SSO identifier based on configuration).
func (c *Client) CheckMfa(loginId string) (*Result, *AppError) {
	m := make(map[string]string)
	m["login_id"] = loginId

	if r, err := c.DoApiPost("/users/mfa", MapToJson(m)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// GenerateMfaSecret returns a QR code image containing the secret, to be scanned
// by a multi-factor authentication mobile application. It also returns the secret
// for manual entry. Must be authenticated.
func (c *Client) GenerateMfaSecret() (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/generate_mfa_secret", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// UpdateMfa activates multi-factor authenticates for the current user if activate
// is true and a valid token is provided. If activate is false, then token is not
// required and multi-factor authentication is disabled for the current user.
func (c *Client) UpdateMfa(activate bool, token string) (*Result, *AppError) {
	m := make(map[string]interface{})
	m["activate"] = activate
	m["token"] = token

	if r, err := c.DoApiPost("/users/update_mfa", StringInterfaceToJson(m)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) AdminResetMfa(userId string) (*Result, *AppError) {
	m := make(map[string]string)
	m["user_id"] = userId

	if r, err := c.DoApiPost("/admin/reset_mfa", MapToJson(m)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) RevokeSession(sessionAltId string) (*Result, *AppError) {
	m := make(map[string]string)
	m["id"] = sessionAltId

	if r, err := c.DoApiPost("/users/revoke_session", MapToJson(m)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetSessions(id string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/"+id+"/sessions", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), SessionsFromJson(r.Body)}, nil
	}
}

func (c *Client) EmailToOAuth(m map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/claim/email_to_oauth", MapToJson(m)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) OAuthToEmail(m map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/claim/oauth_to_email", MapToJson(m)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) LDAPToEmail(m map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/claim/ldap_to_email", MapToJson(m)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) EmailToLDAP(m map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/claim/ldap_to_email", MapToJson(m)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) Command(channelId string, command string) (*Result, *AppError) {
	args := &CommandArgs{ChannelId: channelId, Command: command}
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/commands/execute", args.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), CommandResponseFromJson(r.Body)}, nil
	}
}

func (c *Client) ListCommands() (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+"/commands/list", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), CommandListFromJson(r.Body)}, nil
	}
}

func (c *Client) ListTeamCommands() (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+"/commands/list_team_commands", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), CommandListFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateCommand(cmd *Command) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/commands/create", cmd.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), CommandFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateCommand(cmd *Command) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/commands/update", cmd.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), CommandFromJson(r.Body)}, nil
	}
}

func (c *Client) RegenCommandToken(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/commands/regen_token", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), CommandFromJson(r.Body)}, nil
	}
}

func (c *Client) DeleteCommand(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/commands/delete", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAudits(id string, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/"+id+"/audits", "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), AuditsFromJson(r.Body)}, nil
	}
}

func (c *Client) GetLogs() (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/logs", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ArrayFromJson(r.Body)}, nil
	}
}

func (c *Client) GetClusterStatus() ([]*ClusterInfo, *AppError) {
	if r, err := c.DoApiGet("/admin/cluster_status", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return ClusterInfosFromJson(r.Body), nil
	}
}

// GetRecentlyActiveUsers returns a map of users including lastActivityAt using user id as the key
func (c *Client) GetRecentlyActiveUsers(teamId string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/recently_active_users/"+teamId, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserMapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAllAudits() (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/audits", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), AuditsFromJson(r.Body)}, nil
	}
}

func (c *Client) GetConfig() (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/config", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ConfigFromJson(r.Body)}, nil
	}
}

// ReloadConfig will reload the config.json file from disk.  Properties
// requiring a server restart will still need a server restart.  You must
// have the system admin role to call this method.  It will return status=OK
// if it's successfully reloaded the config file, otherwise check the returned error.
func (c *Client) ReloadConfig() (bool, *AppError) {
	c.clearExtraProperties()
	if r, err := c.DoApiGet("/admin/reload_config", "", ""); err != nil {
		return false, err
	} else {
		c.fillInExtraProperties(r)
		return c.CheckStatusOK(r), nil
	}
}

func (c *Client) InvalidateAllCaches() (bool, *AppError) {
	c.clearExtraProperties()
	if r, err := c.DoApiGet("/admin/invalidate_all_caches", "", ""); err != nil {
		return false, err
	} else {
		c.fillInExtraProperties(r)
		return c.CheckStatusOK(r), nil
	}
}

func (c *Client) SaveConfig(config *Config) (*Result, *AppError) {
	if r, err := c.DoApiPost("/admin/save_config", config.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// RecycleDatabaseConnection will attempt to recycle the database connections.
// You must have the system admin role to call this method.  It will return status=OK
// if it's successfully recycled the connections, otherwise check the returned error.
func (c *Client) RecycleDatabaseConnection() (bool, *AppError) {
	c.clearExtraProperties()
	if r, err := c.DoApiGet("/admin/recycle_db_conn", "", ""); err != nil {
		return false, err
	} else {
		c.fillInExtraProperties(r)
		return c.CheckStatusOK(r), nil
	}
}

func (c *Client) TestEmail(config *Config) (*Result, *AppError) {
	if r, err := c.DoApiPost("/admin/test_email", config.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// TestLdap will run a connection test on the current LDAP settings.
// It will return the standard OK response if settings work. Otherwise
// it will return an appropriate error.
func (c *Client) TestLdap(config *Config) (*Result, *AppError) {
	if r, err := c.DoApiPost("/admin/ldap_test", config.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetComplianceReports() (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/compliance_reports", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), CompliancesFromJson(r.Body)}, nil
	}
}

func (c *Client) SaveComplianceReport(job *Compliance) (*Result, *AppError) {
	if r, err := c.DoApiPost("/admin/save_compliance_report", job.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ComplianceFromJson(r.Body)}, nil
	}
}

func (c *Client) DownloadComplianceReport(id string) (*Result, *AppError) {
	var rq *http.Request
	rq, _ = http.NewRequest("GET", c.ApiUrl+"/admin/download_compliance_report/"+id, nil)
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError("/admin/download_compliance_report", "model.client.connecting.app_error", nil, err.Error(), 0)
	} else if rp.StatusCode >= 300 {
		defer rp.Body.Close()
		return nil, AppErrorFromJson(rp.Body)
	} else {
		defer closeBody(rp)
		return &Result{rp.Header.Get(HEADER_REQUEST_ID),
			rp.Header.Get(HEADER_ETAG_SERVER), rp.Body}, nil
	}
}

func (c *Client) GetTeamAnalytics(teamId, name string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/analytics/"+teamId+"/"+name, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), AnalyticsRowsFromJson(r.Body)}, nil
	}
}

func (c *Client) GetSystemAnalytics(name string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/admin/analytics/"+name, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), AnalyticsRowsFromJson(r.Body)}, nil
	}
}

// Initiate immediate synchronization of LDAP users.
// The synchronization will be performed asynchronously and this function will
// always return OK unless you don't have permissions.
// You must be the system administrator to use this function.
func (c *Client) LdapSyncNow() (*Result, *AppError) {
	if r, err := c.DoApiPost("/admin/ldap_sync_now", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateChannel(channel *Channel) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/channels/create", channel.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateDirectChannel(userId string) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = userId
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/channels/create_direct", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateGroupChannel(userIds []string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/channels/create_group", ArrayToJson(userIds)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateChannel(channel *Channel) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/channels/update", channel.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateChannelHeader(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/channels/update_header", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateChannelPurpose(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/channels/update_purpose", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateNotifyProps(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/channels/update_notify_props", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetMyChannelMembers() (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+"/channels/members", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelMembersFromJson(r.Body)}, nil
	}
}

func (c *Client) GetChannel(id, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelRoute(id)+"/", "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelDataFromJson(r.Body)}, nil
	}
}

// GetMoreChannelsPage will return a page of open channels the user is not in based on
// the provided offset and limit. Must be authenticated.
func (c *Client) GetMoreChannelsPage(offset int, limit int) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf(c.GetTeamRoute()+"/channels/more/%v/%v", offset, limit), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelListFromJson(r.Body)}, nil
	}
}

// SearchMoreChannels will return a list of open channels the user is not in, that matches
// the search criteria provided. Must be authenticated.
func (c *Client) SearchMoreChannels(channelSearch ChannelSearch) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/channels/more/search", channelSearch.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelListFromJson(r.Body)}, nil
	}
}

// AutocompleteChannels will return a list of open channels that match the provided
// string. Must be authenticated.
func (c *Client) AutocompleteChannels(term string) (*Result, *AppError) {
	url := fmt.Sprintf("%s/channels/autocomplete?term=%s", c.GetTeamRoute(), url.QueryEscape(term))
	if r, err := c.DoApiGet(url, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetChannelCounts(etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+"/channels/counts", "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelCountsFromJson(r.Body)}, nil
	}
}

func (c *Client) GetChannels(etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+"/channels/", "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetChannelByName(channelName string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelNameRoute(channelName), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelFromJson(r.Body)}, nil
	}
}

func (c *Client) JoinChannel(id string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(id)+"/join", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) JoinChannelByName(name string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelNameRoute(name)+"/join", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) LeaveChannel(id string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(id)+"/leave", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) DeleteChannel(id string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(id)+"/delete", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) AddChannelMember(id, user_id string) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = user_id
	if r, err := c.DoApiPost(c.GetChannelRoute(id)+"/add", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) RemoveChannelMember(id, user_id string) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = user_id
	if r, err := c.DoApiPost(c.GetChannelRoute(id)+"/remove", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

// ViewChannel performs all the actions related to viewing a channel. This includes marking
// the channel and the previous one as read, and marking the channel as being actively viewed.
// ChannelId is required but may be blank to indicate no channel is being viewed.
// PrevChannelId is optional, populate to indicate a channel switch occurred.
func (c *Client) ViewChannel(params ChannelView) (bool, *ResponseMetadata) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/channels/view", params.ToJson()); err != nil {
		return false, &ResponseMetadata{StatusCode: r.StatusCode, Error: err}
	} else {
		return c.CheckStatusOK(r),
			&ResponseMetadata{
				StatusCode: r.StatusCode,
				RequestId:  r.Header.Get(HEADER_REQUEST_ID),
				Etag:       r.Header.Get(HEADER_ETAG_SERVER),
			}
	}
}

func (c *Client) GetChannelStats(id string, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelRoute(id)+"/stats", "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelStatsFromJson(r.Body)}, nil
	}
}

func (c *Client) GetChannelMember(channelId string, userId string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/members/"+userId, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelMemberFromJson(r.Body)}, nil
	}
}

// GetChannelMembersByIds will return channel member objects as an array based on the
// channel id and a list of user ids provided. Must be authenticated.
func (c *Client) GetChannelMembersByIds(channelId string, userIds []string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(channelId)+"/members/ids", ArrayToJson(userIds)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), ChannelMembersFromJson(r.Body)}, nil
	}
}

func (c *Client) CreatePost(post *Post) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(post.ChannelId)+"/posts/create", post.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdatePost(post *Post) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(post.ChannelId)+"/posts/update", post.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPosts(channelId string, offset int, limit int, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+fmt.Sprintf("/posts/page/%v/%v", offset, limit), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPostsSince(channelId string, time int64) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+fmt.Sprintf("/posts/since/%v", time), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPostsBefore(channelId string, postid string, offset int, limit int, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+fmt.Sprintf("/posts/%v/before/%v/%v", postid, offset, limit), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPostsAfter(channelId string, postid string, offset int, limit int, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf(c.GetChannelRoute(channelId)+"/posts/%v/after/%v/%v", postid, offset, limit), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPost(channelId string, postId string, etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+fmt.Sprintf("/posts/%v/get", postId), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

// GetPostById returns a post and any posts in the same thread by post id
func (c *Client) GetPostById(postId string, etag string) (*PostList, *ResponseMetadata) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+fmt.Sprintf("/posts/%v", postId), "", etag); err != nil {
		return nil, &ResponseMetadata{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body),
			&ResponseMetadata{
				StatusCode: r.StatusCode,
				RequestId:  r.Header.Get(HEADER_REQUEST_ID),
				Etag:       r.Header.Get(HEADER_ETAG_SERVER),
			}
	}
}

// GetPermalink returns a post list, based on the provided channel and post ID.
func (c *Client) GetPermalink(channelId string, postId string, etag string) (*PostList, *ResponseMetadata) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+fmt.Sprintf("/pltmp/%v", postId), "", etag); err != nil {
		return nil, &ResponseMetadata{StatusCode: r.StatusCode, Error: err}
	} else {
		defer closeBody(r)
		return PostListFromJson(r.Body),
			&ResponseMetadata{
				StatusCode: r.StatusCode,
				RequestId:  r.Header.Get(HEADER_REQUEST_ID),
				Etag:       r.Header.Get(HEADER_ETAG_SERVER),
			}
	}
}

func (c *Client) DeletePost(channelId string, postId string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(channelId)+fmt.Sprintf("/posts/%v/delete", postId), ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) SearchPosts(terms string, isOrSearch bool) (*Result, *AppError) {
	data := map[string]interface{}{}
	data["terms"] = terms
	data["is_or_search"] = isOrSearch
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/posts/search", StringInterfaceToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

// GetFlaggedPosts will return a post list of posts that have been flagged by the user.
// The page is set by the integer parameters offset and limit.
func (c *Client) GetFlaggedPosts(offset int, limit int) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+fmt.Sprintf("/posts/flagged/%v/%v", offset, limit), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPinnedPosts(channelId string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+"/pinned", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostListFromJson(r.Body)}, nil
	}
}

func (c *Client) UploadProfileFile(data []byte, contentType string) (*Result, *AppError) {
	return c.uploadFile(c.ApiUrl+"/users/newimage", data, contentType)
}

func (c *Client) UploadPostAttachment(data []byte, channelId string, filename string) (*FileUploadResponse, *AppError) {
	c.clearExtraProperties()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("files", filename); err != nil {
		return nil, NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.file.app_error", nil, err.Error(), 0)
	} else if _, err = io.Copy(part, bytes.NewBuffer(data)); err != nil {
		return nil, NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.file.app_error", nil, err.Error(), 0)
	}

	if part, err := writer.CreateFormField("channel_id"); err != nil {
		return nil, NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.channel_id.app_error", nil, err.Error(), 0)
	} else if _, err = io.Copy(part, strings.NewReader(channelId)); err != nil {
		return nil, NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.channel_id.app_error", nil, err.Error(), 0)
	}

	if err := writer.Close(); err != nil {
		return nil, NewAppError("UploadPostAttachment", "model.client.upload_post_attachment.writer.app_error", nil, err.Error(), 0)
	}

	if result, err := c.uploadFile(c.ApiUrl+c.GetTeamRoute()+"/files/upload", body.Bytes(), writer.FormDataContentType()); err != nil {
		return nil, err
	} else {
		return result.Data.(*FileUploadResponse), nil
	}
}

func (c *Client) uploadFile(url string, data []byte, contentType string) (*Result, *AppError) {
	rq, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	rq.Header.Set("Content-Type", contentType)
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	} else if rp.StatusCode >= 300 {
		return nil, AppErrorFromJson(rp.Body)
	} else {
		defer closeBody(rp)
		return &Result{rp.Header.Get(HEADER_REQUEST_ID),
			rp.Header.Get(HEADER_ETAG_SERVER), FileUploadResponseFromJson(rp.Body)}, nil
	}
}

func (c *Client) GetFile(fileId string) (io.ReadCloser, *AppError) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/get", "", ""); err != nil {
		return nil, err
	} else {
		c.fillInExtraProperties(r)
		return r.Body, nil
	}
}

func (c *Client) GetFileThumbnail(fileId string) (io.ReadCloser, *AppError) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/get_thumbnail", "", ""); err != nil {
		return nil, err
	} else {
		c.fillInExtraProperties(r)
		return r.Body, nil
	}
}

func (c *Client) GetFilePreview(fileId string) (io.ReadCloser, *AppError) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/get_preview", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return r.Body, nil
	}
}

func (c *Client) GetFileInfo(fileId string) (*FileInfo, *AppError) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/get_info", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return FileInfoFromJson(r.Body), nil
	}
}

func (c *Client) GetPublicLink(fileId string) (string, *AppError) {
	if r, err := c.DoApiGet(c.GetFileRoute(fileId)+"/get_public_link", "", ""); err != nil {
		return "", err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return StringFromJson(r.Body), nil
	}
}

func (c *Client) UpdateUser(user *User) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/update", user.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUserRoles(userId string, roles string) (*Result, *AppError) {
	data := make(map[string]string)
	data["new_roles"] = roles

	if r, err := c.DoApiPost(c.GetUserRequiredRoute(userId)+"/update_roles", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateTeamRoles(userId string, roles string) (*Result, *AppError) {
	data := make(map[string]string)
	data["new_roles"] = roles
	data["user_id"] = userId

	if r, err := c.DoApiPost(c.GetTeamRoute()+"/update_member_roles", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) AttachDeviceId(deviceId string) (*Result, *AppError) {
	data := make(map[string]string)
	data["device_id"] = deviceId
	if r, err := c.DoApiPost("/users/attach_device", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateActive(userId string, active bool) (*Result, *AppError) {
	data := make(map[string]string)
	data["user_id"] = userId
	data["active"] = strconv.FormatBool(active)
	if r, err := c.DoApiPost("/users/update_active", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUserNotify(data map[string]string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/update_notify", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), UserFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateUserPassword(userId, currentPassword, newPassword string) (*Result, *AppError) {
	data := make(map[string]string)
	data["current_password"] = currentPassword
	data["new_password"] = newPassword
	data["user_id"] = userId

	if r, err := c.DoApiPost("/users/newpassword", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) SendPasswordReset(email string) (*Result, *AppError) {
	data := map[string]string{}
	data["email"] = email
	if r, err := c.DoApiPost("/users/send_password_reset", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) ResetPassword(code, newPassword string) (*Result, *AppError) {
	data := map[string]string{}
	data["code"] = code
	data["new_password"] = newPassword
	if r, err := c.DoApiPost("/users/reset_password", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) AdminResetPassword(userId, newPassword string) (*Result, *AppError) {
	data := map[string]string{}
	data["user_id"] = userId
	data["new_password"] = newPassword
	if r, err := c.DoApiPost("/admin/reset_password", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// GetStatuses returns a map of string statuses using user id as the key
func (c *Client) GetStatuses() (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/status", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// GetStatusesByIds returns a map of string statuses using user id as the key,
// based on the provided user ids
func (c *Client) GetStatusesByIds(userIds []string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/users/status/ids", ArrayToJson(userIds)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetMyTeam(etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+"/me", "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamFromJson(r.Body)}, nil
	}
}

// GetTeamMembers will return a page of team member objects as an array paged based on the
// team id, offset and limit provided. Must be authenticated.
func (c *Client) GetTeamMembers(teamId string, offset int, limit int) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/teams/%v/members/%v/%v", teamId, offset, limit), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamMembersFromJson(r.Body)}, nil
	}
}

// GetMyTeamMembers will return an array with team member objects that the current user
// is a member of. Must be authenticated.
func (c *Client) GetMyTeamMembers() (*Result, *AppError) {
	if r, err := c.DoApiGet("/teams/members", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamMembersFromJson(r.Body)}, nil
	}
}

// GetMyTeamsUnread will return an array with TeamUnread objects that contain the amount of
// unread messages and mentions the current user has for the teams it belongs to.
// An optional team ID can be set to exclude that team from the results. Must be authenticated.
func (c *Client) GetMyTeamsUnread(teamId string) (*Result, *AppError) {
	endpoint := "/teams/unread"

	if teamId != "" {
		endpoint += fmt.Sprintf("?id=%s", url.QueryEscape(teamId))
	}
	if r, err := c.DoApiGet(endpoint, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamsUnreadFromJson(r.Body)}, nil
	}
}

// GetTeamMember will return a team member object based on the team id and user id provided.
// Must be authenticated.
func (c *Client) GetTeamMember(teamId string, userId string) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/teams/%v/members/%v", teamId, userId), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamMemberFromJson(r.Body)}, nil
	}
}

// GetTeamStats will return a team stats object containing the number of users on the team
// based on the team id provided. Must be authenticated.
func (c *Client) GetTeamStats(teamId string) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/teams/%v/stats", teamId), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamStatsFromJson(r.Body)}, nil
	}
}

// GetTeamByName will return a team object based on the team name provided. Must be authenticated.
func (c *Client) GetTeamByName(teamName string) (*Result, *AppError) {
	if r, err := c.DoApiGet(fmt.Sprintf("/teams/name/%v", teamName), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamFromJson(r.Body)}, nil
	}
}

// GetTeamMembersByIds will return team member objects as an array based on the
// team id and a list of user ids provided. Must be authenticated.
func (c *Client) GetTeamMembersByIds(teamId string, userIds []string) (*Result, *AppError) {
	if r, err := c.DoApiPost(fmt.Sprintf("/teams/%v/members/ids", teamId), ArrayToJson(userIds)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), TeamMembersFromJson(r.Body)}, nil
	}
}

// RegisterApp creates a new OAuth2 app to be used with the OAuth2 Provider. On success
// it returns the created app. Must be authenticated as a user.
func (c *Client) RegisterApp(app *OAuthApp) (*Result, *AppError) {
	if r, err := c.DoApiPost("/oauth/register", app.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OAuthAppFromJson(r.Body)}, nil
	}
}

// AllowOAuth allows a new session by an OAuth2 App. On success
// it returns the url to be redirected back to the app which initiated the oauth2 flow.
// Must be authenticated as a user.
func (c *Client) AllowOAuth(rspType, clientId, redirect, scope, state string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/oauth/allow?response_type="+rspType+"&client_id="+clientId+"&redirect_uri="+url.QueryEscape(redirect)+"&scope="+scope+"&state="+url.QueryEscape(state), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// GetOAuthAppsByUser returns the OAuth2 Apps registered by the user. On success
// it returns a list of OAuth2 Apps from the same user or all the registered apps if the user
// is a System Administrator. Must be authenticated as a user.
func (c *Client) GetOAuthAppsByUser() (*Result, *AppError) {
	if r, err := c.DoApiGet("/oauth/list", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OAuthAppListFromJson(r.Body)}, nil
	}
}

// GetOAuthAppInfo lookup an OAuth2 App using the client_id. On success
// it returns a Sanitized OAuth2 App. Must be authenticated as a user.
func (c *Client) GetOAuthAppInfo(clientId string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/oauth/app/"+clientId, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OAuthAppFromJson(r.Body)}, nil
	}
}

// DeleteOAuthApp deletes an OAuth2 app, the app must be deleted by the same user who created it or
// a System Administrator. On success returs Status OK. Must be authenticated as a user.
func (c *Client) DeleteOAuthApp(id string) (*Result, *AppError) {
	data := make(map[string]string)
	data["id"] = id
	if r, err := c.DoApiPost("/oauth/delete", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

// GetOAuthAuthorizedApps returns the OAuth2 Apps authorized by the user. On success
// it returns a list of sanitized OAuth2 Authorized Apps by the user.
func (c *Client) GetOAuthAuthorizedApps() (*Result, *AppError) {
	if r, err := c.DoApiGet("/oauth/authorized", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OAuthAppListFromJson(r.Body)}, nil
	}
}

// OAuthDeauthorizeApp deauthorize a user an OAuth 2.0 app. On success
// it returns status OK or an AppError on fail.
func (c *Client) OAuthDeauthorizeApp(clientId string) *AppError {
	if r, err := c.DoApiPost("/oauth/"+clientId+"/deauthorize", ""); err != nil {
		return err
	} else {
		defer closeBody(r)
		return nil
	}
}

// RegenerateOAuthAppSecret generates a new OAuth App Client Secret. On success
// it returns an OAuth2 App. Must be authenticated as a user and the same user who
// registered the app or a System Admin.
func (c *Client) RegenerateOAuthAppSecret(clientId string) (*Result, *AppError) {
	if r, err := c.DoApiPost("/oauth/"+clientId+"/regen_secret", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OAuthAppFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAccessToken(data url.Values) (*Result, *AppError) {
	if r, err := c.DoPost("/oauth/access_token", data.Encode(), "application/x-www-form-urlencoded"); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), AccessResponseFromJson(r.Body)}, nil
	}
}

func (c *Client) CreateIncomingWebhook(hook *IncomingWebhook) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/hooks/incoming/create", hook.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), IncomingWebhookFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateIncomingWebhook(hook *IncomingWebhook) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/hooks/incoming/update", hook.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), IncomingWebhookFromJson(r.Body)}, nil
	}
}

func (c *Client) PostToWebhook(id, payload string) (*Result, *AppError) {
	if r, err := c.DoPost("/hooks/"+id, payload, "application/x-www-form-urlencoded"); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), nil}, nil
	}
}

func (c *Client) DeleteIncomingWebhook(id string) (*Result, *AppError) {
	data := make(map[string]string)
	data["id"] = id
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/hooks/incoming/delete", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) ListIncomingWebhooks() (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+"/hooks/incoming/list", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), IncomingWebhookListFromJson(r.Body)}, nil
	}
}

func (c *Client) GetAllPreferences() (*Result, *AppError) {
	if r, err := c.DoApiGet("/preferences/", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		preferences, _ := PreferencesFromJson(r.Body)
		return &Result{r.Header.Get(HEADER_REQUEST_ID), r.Header.Get(HEADER_ETAG_SERVER), preferences}, nil
	}
}

func (c *Client) SetPreferences(preferences *Preferences) (*Result, *AppError) {
	if r, err := c.DoApiPost("/preferences/save", preferences.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), preferences}, nil
	}
}

func (c *Client) GetPreference(category string, name string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/preferences/"+category+"/"+name, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID), r.Header.Get(HEADER_ETAG_SERVER), PreferenceFromJson(r.Body)}, nil
	}
}

func (c *Client) GetPreferenceCategory(category string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/preferences/"+category, "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		preferences, _ := PreferencesFromJson(r.Body)
		return &Result{r.Header.Get(HEADER_REQUEST_ID), r.Header.Get(HEADER_ETAG_SERVER), preferences}, nil
	}
}

// DeletePreferences deletes a list of preferences owned by the current user. If successful,
// it will return status=ok. Otherwise, an error will be returned.
func (c *Client) DeletePreferences(preferences *Preferences) (bool, *AppError) {
	if r, err := c.DoApiPost("/preferences/delete", preferences.ToJson()); err != nil {
		return false, err
	} else {
		return c.CheckStatusOK(r), nil
	}
}

func (c *Client) CreateOutgoingWebhook(hook *OutgoingWebhook) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/hooks/outgoing/create", hook.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OutgoingWebhookFromJson(r.Body)}, nil
	}
}

func (c *Client) UpdateOutgoingWebhook(hook *OutgoingWebhook) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/hooks/outgoing/update", hook.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OutgoingWebhookFromJson(r.Body)}, nil
	}
}

func (c *Client) DeleteOutgoingWebhook(id string) (*Result, *AppError) {
	data := make(map[string]string)
	data["id"] = id
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/hooks/outgoing/delete", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) ListOutgoingWebhooks() (*Result, *AppError) {
	if r, err := c.DoApiGet(c.GetTeamRoute()+"/hooks/outgoing/list", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OutgoingWebhookListFromJson(r.Body)}, nil
	}
}

func (c *Client) RegenOutgoingWebhookToken(id string) (*Result, *AppError) {
	data := make(map[string]string)
	data["id"] = id
	if r, err := c.DoApiPost(c.GetTeamRoute()+"/hooks/outgoing/regen_token", MapToJson(data)); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), OutgoingWebhookFromJson(r.Body)}, nil
	}
}

func (c *Client) MockSession(sessionToken string) {
	c.AuthToken = sessionToken
	c.AuthType = HEADER_BEARER
}

func (c *Client) GetClientLicenceConfig(etag string) (*Result, *AppError) {
	if r, err := c.DoApiGet("/license/client_config", "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), MapFromJson(r.Body)}, nil
	}
}

func (c *Client) GetInitialLoad() (*Result, *AppError) {
	if r, err := c.DoApiGet("/users/initial_load", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), InitialLoadFromJson(r.Body)}, nil
	}
}

// ListEmoji returns a list of all user-created emoji for the server.
func (c *Client) ListEmoji() ([]*Emoji, *AppError) {
	if r, err := c.DoApiGet(c.GetEmojiRoute()+"/list", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return EmojiListFromJson(r.Body), nil
	}
}

// CreateEmoji will save an emoji to the server if the current user has permission
// to do so. If successful, the provided emoji will be returned with its Id field
// filled in. Otherwise, an error will be returned.
func (c *Client) CreateEmoji(emoji *Emoji, image []byte, filename string) (*Emoji, *AppError) {
	c.clearExtraProperties()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	if part, err := writer.CreateFormFile("image", filename); err != nil {
		return nil, NewAppError("CreateEmoji", "model.client.create_emoji.image.app_error", nil, err.Error(), 0)
	} else if _, err = io.Copy(part, bytes.NewBuffer(image)); err != nil {
		return nil, NewAppError("CreateEmoji", "model.client.create_emoji.image.app_error", nil, err.Error(), 0)
	}

	if err := writer.WriteField("emoji", emoji.ToJson()); err != nil {
		return nil, NewAppError("CreateEmoji", "model.client.create_emoji.emoji.app_error", nil, err.Error(), 0)
	}

	if err := writer.Close(); err != nil {
		return nil, NewAppError("CreateEmoji", "model.client.create_emoji.writer.app_error", nil, err.Error(), 0)
	}

	rq, _ := http.NewRequest("POST", c.ApiUrl+c.GetEmojiRoute()+"/create", body)
	rq.Header.Set("Content-Type", writer.FormDataContentType())
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if r, err := c.HttpClient.Do(rq); err != nil {
		return nil, NewAppError("CreateEmoji", "model.client.connecting.app_error", nil, err.Error(), 0)
	} else if r.StatusCode >= 300 {
		return nil, AppErrorFromJson(r.Body)
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return EmojiFromJson(r.Body), nil
	}
}

// DeleteEmoji will delete an emoji from the server if the current user has permission
// to do so. If successful, it will return status=ok. Otherwise, an error will be returned.
func (c *Client) DeleteEmoji(id string) (bool, *AppError) {
	data := map[string]string{"id": id}

	if r, err := c.DoApiPost(c.GetEmojiRoute()+"/delete", MapToJson(data)); err != nil {
		return false, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return c.CheckStatusOK(r), nil
	}
}

// GetCustomEmojiImageUrl returns the API route that can be used to get the image used by
// the given emoji.
func (c *Client) GetCustomEmojiImageUrl(id string) string {
	return c.GetEmojiRoute() + "/" + id
}

// Uploads a x509 base64 Certificate or Private Key file to be used with SAML.
// data byte array is required and needs to be a Multi-Part with 'certificate' as the field name
// contentType is also required. Returns nil if succesful, otherwise returns an AppError
func (c *Client) UploadCertificateFile(data []byte, contentType string) *AppError {
	url := c.ApiUrl + "/admin/add_certificate"
	rq, _ := http.NewRequest("POST", url, bytes.NewReader(data))
	rq.Header.Set("Content-Type", contentType)
	rq.Close = true

	if len(c.AuthToken) > 0 {
		rq.Header.Set(HEADER_AUTH, "BEARER "+c.AuthToken)
	}

	if rp, err := c.HttpClient.Do(rq); err != nil {
		return NewAppError(url, "model.client.connecting.app_error", nil, err.Error(), 0)
	} else if rp.StatusCode >= 300 {
		return AppErrorFromJson(rp.Body)
	} else {
		defer closeBody(rp)
		c.fillInExtraProperties(rp)
		return nil
	}
}

// Removes a x509 base64 Certificate or Private Key file used with SAML.
// filename is required. Returns nil if successful, otherwise returns an AppError
func (c *Client) RemoveCertificateFile(filename string) *AppError {
	if r, err := c.DoApiPost("/admin/remove_certificate", MapToJson(map[string]string{"filename": filename})); err != nil {
		return err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return nil
	}
}

// Checks if the x509 base64 Certificates and Private Key files used with SAML exists on the file system.
// Returns a map[string]interface{} if successful, otherwise returns an AppError. Must be System Admin authenticated.
func (c *Client) SamlCertificateStatus(filename string) (map[string]interface{}, *AppError) {
	if r, err := c.DoApiGet("/admin/remove_certificate", "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return StringInterfaceFromJson(r.Body), nil
	}
}

// GetWebrtcToken if Successful returns a map with a valid token, stun server and turn server with credentials to use with
// the Mattermost WebRTC service, otherwise returns an AppError. Must be authenticated user.
func (c *Client) GetWebrtcToken() (map[string]string, *AppError) {
	if r, err := c.DoApiPost("/webrtc/token", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body), nil
	}
}

// GetFileInfosForPost returns a list of FileInfo objects for a given post id, if successful.
// Otherwise, it returns an error.
func (c *Client) GetFileInfosForPost(channelId string, postId string, etag string) ([]*FileInfo, *AppError) {
	c.clearExtraProperties()

	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+fmt.Sprintf("/posts/%v/get_file_infos", postId), "", etag); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return FileInfosFromJson(r.Body), nil
	}
}

// Saves an emoji reaction for a post in the given channel. Returns the saved reaction if successful, otherwise returns an AppError.
func (c *Client) SaveReaction(channelId string, reaction *Reaction) (*Reaction, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(channelId)+fmt.Sprintf("/posts/%v/reactions/save", reaction.PostId), reaction.ToJson()); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return ReactionFromJson(r.Body), nil
	}
}

// Removes an emoji reaction for a post in the given channel. Returns nil if successful, otherwise returns an AppError.
func (c *Client) DeleteReaction(channelId string, reaction *Reaction) *AppError {
	if r, err := c.DoApiPost(c.GetChannelRoute(channelId)+fmt.Sprintf("/posts/%v/reactions/delete", reaction.PostId), reaction.ToJson()); err != nil {
		return err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return nil
	}
}

// Lists all emoji reactions made for the given post in the given channel. Returns a list of Reactions if successful, otherwise returns an AppError.
func (c *Client) ListReactions(channelId string, postId string) ([]*Reaction, *AppError) {
	if r, err := c.DoApiGet(c.GetChannelRoute(channelId)+fmt.Sprintf("/posts/%v/reactions", postId), "", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		c.fillInExtraProperties(r)
		return ReactionsFromJson(r.Body), nil
	}
}

// Updates the user's roles in the channel by replacing them with the roles provided.
func (c *Client) UpdateChannelRoles(channelId string, userId string, roles string) (map[string]string, *ResponseMetadata) {
	data := make(map[string]string)
	data["new_roles"] = roles
	data["user_id"] = userId

	if r, err := c.DoApiPost(c.GetChannelRoute(channelId)+"/update_member_roles", MapToJson(data)); err != nil {
		metadata := ResponseMetadata{Error: err}
		if r != nil {
			metadata.StatusCode = r.StatusCode
		}
		return nil, &metadata
	} else {
		defer closeBody(r)
		return MapFromJson(r.Body),
			&ResponseMetadata{
				StatusCode: r.StatusCode,
				RequestId:  r.Header.Get(HEADER_REQUEST_ID),
				Etag:       r.Header.Get(HEADER_ETAG_SERVER),
			}
	}
}

func (c *Client) PinPost(channelId string, postId string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(channelId)+"/posts/"+postId+"/pin", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostFromJson(r.Body)}, nil
	}
}

func (c *Client) UnpinPost(channelId string, postId string) (*Result, *AppError) {
	if r, err := c.DoApiPost(c.GetChannelRoute(channelId)+"/posts/"+postId+"/unpin", ""); err != nil {
		return nil, err
	} else {
		defer closeBody(r)
		return &Result{r.Header.Get(HEADER_REQUEST_ID),
			r.Header.Get(HEADER_ETAG_SERVER), PostFromJson(r.Body)}, nil
	}
}
