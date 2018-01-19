package main

import (
	"fmt"
	"os"
	"time"

	"github.com/go-xorm/xorm"
)

// User describes a user
type User struct {
	Id      int64
	Name    string
	Created time.Time `xorm:"created"`
	Updated time.Time `xorm:"updated"`
}

func main() {
	f := "conversion.db"
	os.Remove(f)

	orm, err := xorm.NewEngine("sqlite3", f)
	if err != nil {
		fmt.Println(err)
		return
	}
	orm.ShowSQL(true)

	err = orm.CreateTables(&User{})
	if err != nil {
		fmt.Println(err)
		return
	}

	_, err = orm.Insert(&User{Id: 1, Name: "xlw"})
	if err != nil {
		fmt.Println(err)
		return
	}

	users := make([]User, 0)
	err = orm.Find(&users)
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Println(users)
}
