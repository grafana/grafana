//go:build !windows
// +build !windows

package pgconn

import (
	"os"
	"os/user"
	"path/filepath"
)

func defaultSettings() map[string]string {
	settings := make(map[string]string)

	settings["host"] = defaultHost()
	settings["port"] = "5432"

	// Default to the OS user name. Purposely ignoring err getting user name from
	// OS. The client application will simply have to specify the user in that
	// case (which they typically will be doing anyway).
	user, err := user.Current()
	if err == nil {
		settings["user"] = user.Username
		settings["passfile"] = filepath.Join(user.HomeDir, ".pgpass")
		settings["servicefile"] = filepath.Join(user.HomeDir, ".pg_service.conf")
		sslcert := filepath.Join(user.HomeDir, ".postgresql", "postgresql.crt")
		sslkey := filepath.Join(user.HomeDir, ".postgresql", "postgresql.key")
		if _, err := os.Stat(sslcert); err == nil {
			if _, err := os.Stat(sslkey); err == nil {
				// Both the cert and key must be present to use them, or do not use either
				settings["sslcert"] = sslcert
				settings["sslkey"] = sslkey
			}
		}
		sslrootcert := filepath.Join(user.HomeDir, ".postgresql", "root.crt")
		if _, err := os.Stat(sslrootcert); err == nil {
			settings["sslrootcert"] = sslrootcert
		}
	}

	settings["target_session_attrs"] = "any"

	return settings
}

// defaultHost attempts to mimic libpq's default host. libpq uses the default unix socket location on *nix and localhost
// on Windows. The default socket location is compiled into libpq. Since pgx does not have access to that default it
// checks the existence of common locations.
func defaultHost() string {
	candidatePaths := []string{
		"/var/run/postgresql", // Debian
		"/private/tmp",        // OSX - homebrew
		"/tmp",                // standard PostgreSQL
	}

	for _, path := range candidatePaths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}

	return "localhost"
}
