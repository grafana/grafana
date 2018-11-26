package models

import "time"

type InsertSqlTestDataCommand struct {
}

type SqlTestData struct {
	Id           int64
	Metric1      string
	Metric2      string
	ValueBigInt  int64
	ValueDouble  float64
	ValueFloat   float32
	ValueInt     int
	TimeEpoch    int64
	TimeDateTime time.Time
}
