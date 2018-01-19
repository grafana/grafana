package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/go-xorm/xorm"
	_ "github.com/mattn/go-sqlite3"
)

// Status describes a status
type Status struct {
	Name  string
	Color string
}

// defines some statuses
var (
	Registered = Status{"Registered", "white"}
	Approved   = Status{"Approved", "green"}
	Removed    = Status{"Removed", "red"}
	Statuses   = map[string]Status{
		Registered.Name: Registered,
		Approved.Name:   Approved,
		Removed.Name:    Removed,
	}
)

// FromDB implemented xorm.Conversion convent database data to self
func (s *Status) FromDB(bytes []byte) error {
	if r, ok := Statuses[string(bytes)]; ok {
		*s = r
		return nil
	}
	return errors.New("no this data")
}

// ToDB implemented xorm.Conversion convent to database data
func (s *Status) ToDB() ([]byte, error) {
	return []byte(s.Name), nil
}

// User describes a user
type User struct {
	Id     int64
	Name   string
	Status Status `xorm:"varchar(40)"`
}

func main() {
	f := "conversion.db"
	os.Remove(f)

	Orm, err := xorm.NewEngine("sqlite3", f)
	if err != nil {
		fmt.Println(err)
		return
	}
	Orm.ShowSQL(true)
	err = Orm.CreateTables(&User{})
	if err != nil {
		fmt.Println(err)
		return
	}

	_, err = Orm.Insert(&User{1, "xlw", Registered})
	if err != nil {
		fmt.Println(err)
		return
	}

	users := make([]User, 0)
	err = Orm.Find(&users)
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Println(users)
}
