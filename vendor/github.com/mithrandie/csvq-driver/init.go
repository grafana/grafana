package csvq

import (
	"database/sql"
)

func init() {
	sql.Register("csvq", &Driver{})
}
