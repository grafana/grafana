package sqlmock

import "database/sql/driver"

// ValueConverterOption allows to create a sqlmock connection
// with a custom ValueConverter to support drivers with special data types.
func ValueConverterOption(converter driver.ValueConverter) func(*sqlmock) error {
	return func(s *sqlmock) error {
		s.converter = converter
		return nil
	}
}

// QueryMatcherOption allows to customize SQL query matcher
// and match SQL query strings in more sophisticated ways.
// The default QueryMatcher is QueryMatcherRegexp.
func QueryMatcherOption(queryMatcher QueryMatcher) func(*sqlmock) error {
	return func(s *sqlmock) error {
		s.queryMatcher = queryMatcher
		return nil
	}
}

// MonitorPingsOption determines whether calls to Ping on the driver should be
// observed and mocked.
//
// If true is passed, we will check these calls were expected. Expectations can
// be registered using the ExpectPing() method on the mock.
//
// If false is passed or this option is omitted, calls to Ping will not be
// considered when determining expectations and calls to ExpectPing will have
// no effect.
func MonitorPingsOption(monitorPings bool) func(*sqlmock) error {
	return func(s *sqlmock) error {
		s.monitorPings = monitorPings
		return nil
	}
}
