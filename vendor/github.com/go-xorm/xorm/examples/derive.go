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
}

// LoginInfo1 describes a login information
type LoginInfo1 struct {
	LoginInfo `xorm:"extends"`
	UserName  string
}

func main() {
	f := "derive.db"
	os.Remove(f)

	orm, err := xorm.NewEngine("sqlite3", f)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer orm.Close()
	orm.ShowSQL(true)
	err = orm.CreateTables(&User{}, &LoginInfo{})
	if err != nil {
		fmt.Println(err)
		return
	}

	_, err = orm.Insert(&User{1, "xlw"}, &LoginInfo{1, "127.0.0.1", 1})
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

	infos := make([]LoginInfo1, 0)
	err = orm.Sql(`select *, (select name from user where id = login_info.user_id) as user_name from
             login_info limit 10`).Find(&infos)
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Println(infos)
}
