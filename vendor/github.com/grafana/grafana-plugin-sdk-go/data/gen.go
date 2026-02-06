package data

//go:generate genny -in=generic_nullable_vector.go -out=nullable_vector.gen.go gen "gen=uint8,uint16,uint32,uint64,int8,int16,int32,int64,float32,float64,string,bool,time.Time,json.RawMessage"

//go:generate genny -in=generic_vector.go -out=vector.gen.go gen "gen=uint8,uint16,uint32,uint64,int8,int16,int32,int64,float32,float64,string,bool,time.Time,json.RawMessage"
