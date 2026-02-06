package gapi

// NavLink represents a Grafana nav link.
type NavLink struct {
	ID     string `json:"id,omitempty"`
	Text   string `json:"text,omitempty"`
	URL    string `json:"url,omitempty"`
	Target string `json:"target,omitempty"`
}

// NavbarPreference represents a Grafana navbar preference.
type NavbarPreference struct {
	SavedItems []NavLink `json:"savedItems"`
}

// QueryHistoryPreference represents a Grafana query history preference.
type QueryHistoryPreference struct {
	HomeTab string `json:"homeTab"`
}

// Preferences represents Grafana preferences.
type Preferences struct {
	Theme            string                 `json:"theme,omitempty"`
	HomeDashboardID  int64                  `json:"homeDashboardId,omitempty"`
	HomeDashboardUID string                 `json:"homeDashboardUID,omitempty"`
	Timezone         string                 `json:"timezone,omitempty"`
	WeekStart        string                 `json:"weekStart,omitempty"`
	Locale           string                 `json:"locale,omitempty"`
	Navbar           NavbarPreference       `json:"navbar,omitempty"`
	QueryHistory     QueryHistoryPreference `json:"queryHistory,omitempty"`
}
