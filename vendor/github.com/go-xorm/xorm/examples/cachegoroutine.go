package main

import (
	"fmt"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/go-xorm/xorm"
	_ "github.com/mattn/go-sqlite3"
)

type User struct {
	Id   int64
	Name string
}

func sqliteEngine() (*xorm.Engine, error) {
	os.Remove("./test.db")
	return xorm.NewEngine("sqlite3", "./goroutine.db")
}

func mysqlEngine() (*xorm.Engine, error) {
	return xorm.NewEngine("mysql", "root:@/test?charset=utf8")
}

var u *User = &User{}

func test(engine *xorm.Engine) {
	err := engine.CreateTables(u)
	if err != nil {
		fmt.Println(err)
		return
	}

	size := 500
	queue := make(chan int, size)

	for i := 0; i < size; i++ {
		go func(x int) {
			//x := i
			err := engine.Ping()
			if err != nil {
				fmt.Println(err)
			} else {
				for j := 0; j < 10; j++ {
					if x+j < 2 {
						_, err = engine.Get(u)
					} else if x+j < 4 {
						users := make([]User, 0)
						err = engine.Find(&users)
					} else if x+j < 8 {
						_, err = engine.Count(u)
					} else if x+j < 16 {
						_, err = engine.Insert(&User{Name: "xlw"})
					} else if x+j < 32 {
						//_, err = engine.Id(1).Delete(u)
						_, err = engine.Delete(u)
					}
					if err != nil {
						fmt.Println(err)
						queue <- x
						return
					}
				}
				fmt.Printf("%v success!\n", x)
			}
			queue <- x
		}(i)
	}

	for i := 0; i < size; i++ {
		<-queue
	}

	//conns := atomic.LoadInt32(&xorm.ConnectionNum)
	//fmt.Println("connection number:", conns)
	fmt.Println("end")
}

func main() {
	fmt.Println("-----start sqlite go routines-----")
	engine, err := sqliteEngine()
	if err != nil {
		fmt.Println(err)
		return
	}
	engine.ShowSQL = true
	cacher := xorm.NewLRUCacher2(xorm.NewMemoryStore(), time.Hour, 1000)
	engine.SetDefaultCacher(cacher)
	fmt.Println(engine)
	test(engine)
	fmt.Println("test end")
	engine.Close()

	fmt.Println("-----start mysql go routines-----")
	engine, err = mysqlEngine()
	engine.ShowSQL = true
	cacher = xorm.NewLRUCacher2(xorm.NewMemoryStore(), time.Hour, 1000)
	engine.SetDefaultCacher(cacher)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer engine.Close()
	test(engine)
}
