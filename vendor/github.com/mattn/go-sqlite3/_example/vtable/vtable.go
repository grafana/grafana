package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/mattn/go-sqlite3"
)

type githubRepo struct {
	ID          int    `json:"id"`
	FullName    string `json:"full_name"`
	Description string `json:"description"`
	HTMLURL     string `json:"html_url"`
}

type githubModule struct {
}

func (m *githubModule) Create(c *sqlite3.SQLiteConn, args []string) (sqlite3.VTab, error) {
	err := c.DeclareVTab(fmt.Sprintf(`
		CREATE TABLE %s (
			id INT,
			full_name TEXT,
			description TEXT,
			html_url TEXT
		)`, args[0]))
	if err != nil {
		return nil, err
	}
	return &ghRepoTable{}, nil
}

func (m *githubModule) Connect(c *sqlite3.SQLiteConn, args []string) (sqlite3.VTab, error) {
	return m.Create(c, args)
}

func (m *githubModule) DestroyModule() {}

type ghRepoTable struct {
	repos []githubRepo
}

func (v *ghRepoTable) Open() (sqlite3.VTabCursor, error) {
	resp, err := http.Get("https://api.github.com/repositories")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var repos []githubRepo
	if err := json.Unmarshal(body, &repos); err != nil {
		return nil, err
	}
	return &ghRepoCursor{0, repos}, nil
}

func (v *ghRepoTable) BestIndex(cst []sqlite3.InfoConstraint, ob []sqlite3.InfoOrderBy) (*sqlite3.IndexResult, error) {
	return &sqlite3.IndexResult{}, nil
}

func (v *ghRepoTable) Disconnect() error { return nil }
func (v *ghRepoTable) Destroy() error    { return nil }

type ghRepoCursor struct {
	index int
	repos []githubRepo
}

func (vc *ghRepoCursor) Column(c *sqlite3.SQLiteContext, col int) error {
	switch col {
	case 0:
		c.ResultInt(vc.repos[vc.index].ID)
	case 1:
		c.ResultText(vc.repos[vc.index].FullName)
	case 2:
		c.ResultText(vc.repos[vc.index].Description)
	case 3:
		c.ResultText(vc.repos[vc.index].HTMLURL)
	}
	return nil
}

func (vc *ghRepoCursor) Filter(idxNum int, idxStr string, vals []interface{}) error {
	vc.index = 0
	return nil
}

func (vc *ghRepoCursor) Next() error {
	vc.index++
	return nil
}

func (vc *ghRepoCursor) EOF() bool {
	return vc.index >= len(vc.repos)
}

func (vc *ghRepoCursor) Rowid() (int64, error) {
	return int64(vc.index), nil
}

func (vc *ghRepoCursor) Close() error {
	return nil
}
