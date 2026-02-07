package ffcontext

import "time"

type GoffContextSpecifics struct {
	// CurrentDateTime is the current date time to use for the evaluation.
	CurrentDateTime *time.Time `json:"currentDateTime"`
	// FlagList is the list of flags to evaluate in a bulk evaluation.
	FlagList []string `json:"flagList"`
	// ExporterMetadata is the metadata to be used by the exporter.
	ExporterMetadata map[string]interface{} `json:"exporterMetadata"`
}

// addCurrentDateTime adds the current date time to the context.
// This function formats the current date time to RFC3339 format.
func (g *GoffContextSpecifics) addCurrentDateTime(currentDateTime any) {
	switch value := currentDateTime.(type) {
	case *time.Time:
		g.CurrentDateTime = value
	case time.Time:
		g.CurrentDateTime = &value
	case string:
		if currentDateTime, err := time.ParseInLocation(time.RFC3339, value, time.Local); err == nil {
			g.CurrentDateTime = &currentDateTime
		}
		return
	default:
		return
	}
}

// addListFlags adds the list of flags to evaluate in a bulk evaluation.
func (g *GoffContextSpecifics) addListFlags(flagList any) {
	if value, ok := flagList.([]string); ok {
		g.FlagList = value
	}
	if value, ok := flagList.([]interface{}); ok {
		for _, val := range value {
			if valAsString, ok := val.(string); ok {
				g.FlagList = append(g.FlagList, valAsString)
			}
		}
	}
}

func (g *GoffContextSpecifics) addExporterMetadata(exporterMetadata any) {
	if value, ok := exporterMetadata.(map[string]interface{}); ok {
		g.ExporterMetadata = value
	}
}
