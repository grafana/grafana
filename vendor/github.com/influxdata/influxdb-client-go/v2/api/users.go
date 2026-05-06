// Copyright 2020-2021 InfluxData, Inc. All rights reserved.
// Use of this source code is governed by MIT
// license that can be found in the LICENSE file.

package api

import (
	"context"
	"encoding/base64"
	"fmt"
	nethttp "net/http"
	"net/http/cookiejar"
	"sync"

	"github.com/influxdata/influxdb-client-go/v2/api/http"
	"github.com/influxdata/influxdb-client-go/v2/domain"
	"golang.org/x/net/publicsuffix"
)

// UsersAPI provides methods for managing users in a InfluxDB server
type UsersAPI interface {
	// GetUsers returns all users
	GetUsers(ctx context.Context) (*[]domain.User, error)
	// FindUserByID returns user with userID
	FindUserByID(ctx context.Context, userID string) (*domain.User, error)
	// FindUserByName returns user with name userName
	FindUserByName(ctx context.Context, userName string) (*domain.User, error)
	// CreateUser creates new user
	CreateUser(ctx context.Context, user *domain.User) (*domain.User, error)
	// CreateUserWithName creates new user with userName
	CreateUserWithName(ctx context.Context, userName string) (*domain.User, error)
	// UpdateUser updates user
	UpdateUser(ctx context.Context, user *domain.User) (*domain.User, error)
	// UpdateUserPassword sets password for a user
	UpdateUserPassword(ctx context.Context, user *domain.User, password string) error
	// UpdateUserPasswordWithID sets password for a user with userID
	UpdateUserPasswordWithID(ctx context.Context, userID string, password string) error
	// DeleteUserWithID deletes an user with userID
	DeleteUserWithID(ctx context.Context, userID string) error
	// DeleteUser deletes an user
	DeleteUser(ctx context.Context, user *domain.User) error
	// Me returns actual user
	Me(ctx context.Context) (*domain.User, error)
	// MeUpdatePassword set password of actual user
	MeUpdatePassword(ctx context.Context, oldPassword, newPassword string) error
	// SignIn exchanges username and password credentials to establish an authenticated session with the InfluxDB server. The Client's authentication token is then ignored, it can be empty.
	SignIn(ctx context.Context, username, password string) error
	// SignOut signs out previously signed-in user
	SignOut(ctx context.Context) error
}

// usersAPI implements UsersAPI
type usersAPI struct {
	apiClient       *domain.Client
	httpService     http.Service
	httpClient      *nethttp.Client
	deleteCookieJar bool
	lock            sync.Mutex
}

// NewUsersAPI creates new instance of UsersAPI
func NewUsersAPI(apiClient *domain.Client, httpService http.Service, httpClient *nethttp.Client) UsersAPI {
	return &usersAPI{
		apiClient:   apiClient,
		httpService: httpService,
		httpClient:  httpClient,
	}
}

func (u *usersAPI) GetUsers(ctx context.Context) (*[]domain.User, error) {
	params := &domain.GetUsersParams{}
	response, err := u.apiClient.GetUsers(ctx, params)
	if err != nil {
		return nil, err
	}
	return userResponsesToUsers(response.Users), nil
}

func (u *usersAPI) FindUserByID(ctx context.Context, userID string) (*domain.User, error) {
	params := &domain.GetUsersIDAllParams{
		UserID: userID,
	}
	response, err := u.apiClient.GetUsersID(ctx, params)
	if err != nil {
		return nil, err
	}
	return userResponseToUser(response), nil
}

func (u *usersAPI) FindUserByName(ctx context.Context, userName string) (*domain.User, error) {
	users, err := u.GetUsers(ctx)
	if err != nil {
		return nil, err
	}
	var user *domain.User
	for _, u := range *users {
		if u.Name == userName {
			user = &u
			break
		}
	}
	if user == nil {
		return nil, fmt.Errorf("user '%s' not found", userName)
	}
	return user, nil
}

func (u *usersAPI) CreateUserWithName(ctx context.Context, userName string) (*domain.User, error) {
	user := &domain.User{Name: userName}
	return u.CreateUser(ctx, user)
}

func (u *usersAPI) CreateUser(ctx context.Context, user *domain.User) (*domain.User, error) {
	params := &domain.PostUsersAllParams{
		Body: domain.PostUsersJSONRequestBody(*user),
	}
	response, err := u.apiClient.PostUsers(ctx, params)
	if err != nil {
		return nil, err
	}
	return userResponseToUser(response), nil
}

func (u *usersAPI) UpdateUser(ctx context.Context, user *domain.User) (*domain.User, error) {
	params := &domain.PatchUsersIDAllParams{
		Body:   domain.PatchUsersIDJSONRequestBody(*user),
		UserID: *user.Id,
	}
	response, err := u.apiClient.PatchUsersID(ctx, params)
	if err != nil {
		return nil, err
	}
	return userResponseToUser(response), nil
}

func (u *usersAPI) UpdateUserPassword(ctx context.Context, user *domain.User, password string) error {
	return u.UpdateUserPasswordWithID(ctx, *user.Id, password)
}

func (u *usersAPI) UpdateUserPasswordWithID(ctx context.Context, userID string, password string) error {
	params := &domain.PostUsersIDPasswordAllParams{
		UserID: userID,
		Body:   domain.PostUsersIDPasswordJSONRequestBody(domain.PasswordResetBody{Password: password}),
	}
	return u.apiClient.PostUsersIDPassword(ctx, params)
}

func (u *usersAPI) DeleteUser(ctx context.Context, user *domain.User) error {
	return u.DeleteUserWithID(ctx, *user.Id)
}

func (u *usersAPI) DeleteUserWithID(ctx context.Context, userID string) error {
	params := &domain.DeleteUsersIDAllParams{
		UserID: userID,
	}
	return u.apiClient.DeleteUsersID(ctx, params)
}

func (u *usersAPI) Me(ctx context.Context) (*domain.User, error) {
	params := &domain.GetMeParams{}
	response, err := u.apiClient.GetMe(ctx, params)
	if err != nil {
		return nil, err
	}
	return userResponseToUser(response), nil
}

func (u *usersAPI) MeUpdatePassword(ctx context.Context, oldPassword, newPassword string) error {
	u.lock.Lock()
	defer u.lock.Unlock()
	me, err := u.Me(ctx)
	if err != nil {
		return err
	}
	creds := base64.StdEncoding.EncodeToString([]byte(me.Name + ":" + oldPassword))
	auth := u.httpService.Authorization()
	defer u.httpService.SetAuthorization(auth)
	u.httpService.SetAuthorization("Basic " + creds)
	params := &domain.PutMePasswordAllParams{
		Body: domain.PutMePasswordJSONRequestBody(domain.PasswordResetBody{Password: newPassword}),
	}
	return u.apiClient.PutMePassword(ctx, params)
}

func (u *usersAPI) SignIn(ctx context.Context, username, password string) error {
	u.lock.Lock()
	defer u.lock.Unlock()
	if u.httpClient.Jar == nil {
		jar, err := cookiejar.New(&cookiejar.Options{PublicSuffixList: publicsuffix.List})
		if err != nil {
			return err
		}
		u.httpClient.Jar = jar
		u.deleteCookieJar = true
	}
	creds := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	u.httpService.SetAuthorization("Basic " + creds)
	defer u.httpService.SetAuthorization("")
	return u.apiClient.PostSignin(ctx, &domain.PostSigninParams{})
}

func (u *usersAPI) SignOut(ctx context.Context) error {
	u.lock.Lock()
	defer u.lock.Unlock()
	err := u.apiClient.PostSignout(ctx, &domain.PostSignoutParams{})
	if u.deleteCookieJar {
		u.httpClient.Jar = nil
	}
	return err
}

func userResponseToUser(ur *domain.UserResponse) *domain.User {
	if ur == nil {
		return nil
	}
	user := &domain.User{
		Id:     ur.Id,
		Name:   ur.Name,
		Status: userResponseStatusToUserStatus(ur.Status),
	}
	return user
}

func userResponseStatusToUserStatus(urs *domain.UserResponseStatus) *domain.UserStatus {
	if urs == nil {
		return nil
	}
	us := domain.UserStatus(*urs)
	return &us
}

func userResponsesToUsers(urs *[]domain.UserResponse) *[]domain.User {
	if urs == nil {
		return nil
	}
	us := make([]domain.User, len(*urs))
	for i, ur := range *urs {
		us[i] = *userResponseToUser(&ur)
	}
	return &us
}
