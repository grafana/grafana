package config

import "strings"

func toAuthSchemePreferenceList(cfg string) []string {
	if len(cfg) == 0 {
		return nil
	}
	parts := strings.Split(cfg, ",")
	ids := make([]string, 0, len(parts))

	for _, p := range parts {
		if id := strings.TrimSpace(p); len(id) > 0 {
			ids = append(ids, id)
		}
	}

	return ids
}
