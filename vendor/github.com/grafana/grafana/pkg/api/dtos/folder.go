package dtos

import "time"

type Folder struct {
	Id        int64     `json:"id"`
	Uid       string    `json:"uid"`
	Title     string    `json:"title"`
	Url       string    `json:"url"`
	HasAcl    bool      `json:"hasAcl"`
	CanSave   bool      `json:"canSave"`
	CanEdit   bool      `json:"canEdit"`
	CanAdmin  bool      `json:"canAdmin"`
	CreatedBy string    `json:"createdBy"`
	Created   time.Time `json:"created"`
	UpdatedBy string    `json:"updatedBy"`
	Updated   time.Time `json:"updated"`
	Version   int       `json:"version"`
}

type FolderSearchHit struct {
	Id    int64  `json:"id"`
	Uid   string `json:"uid"`
	Title string `json:"title"`
}
