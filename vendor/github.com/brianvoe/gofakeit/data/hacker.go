package data

// Hacker consists of random hacker phrases
var Hacker = map[string][]string{
	"abbreviation": {"TCP", "HTTP", "SDD", "RAM", "GB", "CSS", "SSL", "AGP", "SQL", "FTP", "PCI", "AI", "ADP", "RSS", "XML", "EXE", "COM", "HDD", "THX", "SMTP", "SMS", "USB", "PNG", "SAS", "IB", "SCSI", "JSON", "XSS", "JBOD"},
	"adjective":    {"auxiliary", "primary", "back-end", "digital", "open-source", "virtual", "cross-platform", "redundant", "online", "haptic", "multi-byte", "bluetooth", "wireless", "1080p", "neural", "optical", "solid state", "mobile"},
	"noun":         {"driver", "protocol", "bandwidth", "panel", "microchip", "program", "port", "card", "array", "interface", "system", "sensor", "firewall", "hard drive", "pixel", "alarm", "feed", "monitor", "application", "transmitter", "bus", "circuit", "capacitor", "matrix"},
	"verb":         {"back up", "bypass", "hack", "override", "compress", "copy", "navigate", "index", "connect", "generate", "quantify", "calculate", "synthesize", "input", "transmit", "program", "reboot", "parse"},
	"ingverb":      {"backing up", "bypassing", "hacking", "overriding", "compressing", "copying", "navigating", "indexing", "connecting", "generating", "quantifying", "calculating", "synthesizing", "transmitting", "programming", "parsing"},
	"phrase": {
		"If we {hacker.verb} the {hacker.noun}, we can get to the {hacker.abbreviation} {hacker.noun} through the {hacker.adjective} {hacker.abbreviation} {hacker.noun}!",
		"We need to {hacker.verb} the {hacker.adjective} {hacker.abbreviation} {hacker.noun}!",
		"Try to {hacker.verb} the {hacker.abbreviation} {hacker.noun}, maybe it will {hacker.verb} the {hacker.adjective} {hacker.noun}!",
		"You can't {hacker.verb} the {hacker.noun} without {hacker.ingverb} the {hacker.adjective} {hacker.abbreviation} {hacker.noun}!",
		"Use the {hacker.adjective} {hacker.abbreviation} {hacker.noun}, then you can {hacker.verb} the {hacker.adjective} {hacker.noun}!",
		"The {hacker.abbreviation} {hacker.noun} is down, {hacker.verb} the {hacker.adjective} {hacker.noun} so we can {hacker.verb} the {hacker.abbreviation} {hacker.noun}!",
		"{hacker.ingverb} the {hacker.noun} won't do anything, we need to {hacker.verb} the {hacker.adjective} {hacker.abbreviation} {hacker.noun}!",
		"I'll {hacker.verb} the {hacker.adjective} {hacker.abbreviation} {hacker.noun}, that should {hacker.verb} the {hacker.abbreviation} {hacker.noun}!",
	},
}
