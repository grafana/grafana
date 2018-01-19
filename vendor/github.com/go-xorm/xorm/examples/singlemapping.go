package main

import (
	"fmt"
	"os"

	"github.com/go-xorm/xorm"
	_ "github.com/mattn/go-sqlite3"
)

// User describes a user
type User struct {
	Id   int64
	Name string
}

// LoginInfo describes a login information
type LoginInfo struct {
	Id     int64
	IP     string
	UserId int64
	// timestamp should be updated by database, so only allow get from db
	TimeStamp string `xorm:"<-"`
	// assume
	Nonuse int `xorm:"->"`
}

func main() {
	f := "singleMapping.db"
	os.Remove(f)

	orm, err := xorm.NewEngine("sqlite3", f)
	if err != nil {
		fmt.Println(err)
		return
	}
	orm.ShowSQL(true)
	err = orm.CreateTables(&User{}, &LoginInfo{})
	if err != nil {
		fmt.Println(err)
		return
	}

	_, err = orm.Insert(&User{1, "xlw"}, &LoginInfo{1, "127.0.0.1", 1, "", 23})
	if err != nil {
		fmt.Println(err)
		return
	}

	info := LoginInfo{}
	_, err = orm.Id(1).Get(&info)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Println(info)
}
