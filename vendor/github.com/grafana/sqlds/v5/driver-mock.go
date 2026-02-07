package sqlds

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	_ "github.com/mithrandie/csvq-driver"
)

// SQLMock connects to a local folder with csv files
type SQLMock struct {
	folder              string
	ShouldFailToConnect bool
}

func (h *SQLMock) Settings(_ context.Context, _ backend.DataSourceInstanceSettings) DriverSettings {
	return DriverSettings{
		FillMode: &data.FillMissing{
			Mode: data.FillModeNull,
		},
		Timeout: time.Second * time.Duration(30),
	}
}

// Connect opens a sql.DB connection using datasource settings
func (h *SQLMock) Connect(_ context.Context, _ backend.DataSourceInstanceSettings, msg json.RawMessage) (*sql.DB, error) {
	if h.ShouldFailToConnect {
		return nil, errors.New("failed to create mock")
	}
	backend.Logger.Debug("connecting to mock data")
	folder := h.folder
	if folder == "" {
		folder = MockDataFolder
	}
	if !strings.HasPrefix(folder, "/") {
		folder = "/" + folder
	}
	err := CreateMockTable("users", folder)
	if err != nil {
		backend.Logger.Error("failed creating mock data: " + err.Error())
		return nil, err
	}
	ex, err := os.Executable()
	if err != nil {
		backend.Logger.Error("failed accessing Mock path: " + err.Error())
	}
	exPath := filepath.Dir(ex)
	db, err := sql.Open("csvq", exPath+folder)
	if err != nil {
		backend.Logger.Error("failed opening Mock sql: " + err.Error())
		return nil, err
	}
	err = db.Ping()
	if err != nil {
		backend.Logger.Error("failed connecting to Mock: " + err.Error())
	}
	return db, nil
}

// Converters defines list of string convertors
func (h *SQLMock) Converters() []sqlutil.Converter {
	return []sqlutil.Converter{}
}

// Macros returns list of macro functions convert the macros of raw query
func (h *SQLMock) Macros() Macros {
	return Macros{}
}
