package data

// Data consists of the main set of fake information
var Data = map[string]map[string][]string{
	"person":    Person,
	"contact":   Contact,
	"address":   Address,
	"company":   Company,
	"job":       Job,
	"lorem":     Lorem,
	"internet":  Internet,
	"file":      Files,
	"color":     Colors,
	"computer":  Computer,
	"payment":   Payment,
	"hipster":   Hipster,
	"beer":      Beer,
	"hacker":    Hacker,
	"currency":  Currency,
	"log_level": LogLevels,
	"timezone":  TimeZone,
	"vehicle":   Vehicle,
}

// IntData consists of the main set of fake information (integer only)
var IntData = map[string]map[string][]int{
	"status_code": StatusCodes,
}
