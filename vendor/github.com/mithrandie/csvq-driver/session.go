package csvq

import (
	"context"
	"io"
	"sync"

	"github.com/mithrandie/csvq/lib/query"
)

var session *query.Session
var getSessionOnce sync.Once

func getSession() *query.Session {
	getSessionOnce.Do(func() {
		session = query.NewSession()
		session.SetStdout(&query.Discard{})
		session.SetStderr(&query.Discard{})
	})
	return session
}

func SetStdin(r io.ReadCloser) error {
	return SetStdinContext(context.Background(), r)
}

func SetStdinContext(ctx context.Context, r io.ReadCloser) error {
	return getSession().SetStdinContext(ctx, r)
}

func SetStdout(w io.WriteCloser) {
	getSession().SetStdout(w)
}

func SetOutFile(w io.Writer) {
	getSession().SetOutFile(w)
}
