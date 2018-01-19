// Configure the GoConvey web UI client in here

convey.config = {

	// Install new themes by adding them here; the first one will be default
	themes: {
		"dark":         { name: "Dark", filename: "dark.css", coverage: "hsla({{hue}}, 75%, 30%, .5)" },
		"dark-bigtext": { name: "Dark-BigText", filename: "dark-bigtext.css", coverage: "hsla({{hue}}, 75%, 30%, .5)" },
		"light":        { name: "Light", filename: "light.css", coverage: "hsla({{hue}}, 62%, 75%, 1)" }
	},

	// Path to the themes (end with forward-slash)
	themePath: "/resources/css/themes/"

};
