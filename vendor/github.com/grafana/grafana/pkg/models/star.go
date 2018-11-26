package models

import "errors"

var ErrCommandValidationFailed = errors.New("Command missing required fields")

type Star struct {
	Id          int64
	UserId      int64
	DashboardId int64
}

// ----------------------
// COMMANDS

type StarDashboardCommand struct {
	UserId      int64
	DashboardId int64
}

type UnstarDashboardCommand struct {
	UserId      int64
	DashboardId int64
}

// ---------------------
// QUERIES

type GetUserStarsQuery struct {
	UserId int64

	Result map[int64]bool // dashboard ids
}

type IsStarredByUserQuery struct {
	UserId      int64
	DashboardId int64

	Result bool
}
