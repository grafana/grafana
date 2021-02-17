package sockjs

import (
	"encoding/json"
	"fmt"
)

func closeFrame(status uint32, reason string) string {
	bytes, _ := json.Marshal([]interface{}{status, reason})
	return fmt.Sprintf("c%s", string(bytes))
}
