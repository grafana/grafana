package data

// StatusCodes consists of commonly used HTTP status codes
var StatusCodes = map[string][]int{
	"simple":  {200, 301, 302, 400, 404, 500},
	"general": {100, 200, 201, 203, 204, 205, 301, 302, 304, 400, 401, 403, 404, 405, 406, 416, 500, 501, 502, 503, 504},
}
