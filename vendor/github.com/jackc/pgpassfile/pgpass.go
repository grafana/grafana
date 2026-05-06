// Package pgpassfile is a parser PostgreSQL .pgpass files.
package pgpassfile

import (
	"bufio"
	"io"
	"os"
	"regexp"
	"strings"
)

// Entry represents a line in a PG passfile.
type Entry struct {
	Hostname string
	Port     string
	Database string
	Username string
	Password string
}

// Passfile is the in memory data structure representing a PG passfile.
type Passfile struct {
	Entries []*Entry
}

// ReadPassfile reads the file at path and parses it into a Passfile.
func ReadPassfile(path string) (*Passfile, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return ParsePassfile(f)
}

// ParsePassfile reads r and parses it into a Passfile.
func ParsePassfile(r io.Reader) (*Passfile, error) {
	passfile := &Passfile{}

	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		entry := parseLine(scanner.Text())
		if entry != nil {
			passfile.Entries = append(passfile.Entries, entry)
		}
	}

	return passfile, scanner.Err()
}

// Match (not colons or escaped colon or escaped backslash)+. Essentially gives a split on unescaped
// colon.
var colonSplitterRegexp = regexp.MustCompile("(([^:]|(\\:)))+")

// var colonSplitterRegexp = regexp.MustCompile("((?:[^:]|(?:\\:)|(?:\\\\))+)")

// parseLine parses a line into an *Entry. It returns nil on comment lines or any other unparsable
// line.
func parseLine(line string) *Entry {
	const (
		tmpBackslash = "\r"
		tmpColon     = "\n"
	)

	line = strings.TrimSpace(line)

	if strings.HasPrefix(line, "#") {
		return nil
	}

	line = strings.Replace(line, `\\`, tmpBackslash, -1)
	line = strings.Replace(line, `\:`, tmpColon, -1)

	parts := strings.Split(line, ":")
	if len(parts) != 5 {
		return nil
	}

	// Unescape escaped colons and backslashes
	for i := range parts {
		parts[i] = strings.Replace(parts[i], tmpBackslash, `\`, -1)
		parts[i] = strings.Replace(parts[i], tmpColon, `:`, -1)
	}

	return &Entry{
		Hostname: parts[0],
		Port:     parts[1],
		Database: parts[2],
		Username: parts[3],
		Password: parts[4],
	}
}

// FindPassword finds the password for the provided hostname, port, database, and username. For a
// Unix domain socket hostname must be set to "localhost". An empty string will be returned if no
// match is found.
//
// See https://www.postgresql.org/docs/current/libpq-pgpass.html for more password file information.
func (pf *Passfile) FindPassword(hostname, port, database, username string) (password string) {
	for _, e := range pf.Entries {
		if (e.Hostname == "*" || e.Hostname == hostname) &&
			(e.Port == "*" || e.Port == port) &&
			(e.Database == "*" || e.Database == database) &&
			(e.Username == "*" || e.Username == username) {
			return e.Password
		}
	}
	return ""
}
