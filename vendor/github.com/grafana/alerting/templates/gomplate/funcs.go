package gomplate

import (
	tmpltext "text/template"
)

type Namespace struct {
	Name    string
	Context any
}

func (ns Namespace) AddToFuncMap(funcMap tmpltext.FuncMap) {
	funcMap[ns.Name] = func() any { return ns.Context }
}

func FuncMap(text *tmpltext.Template) tmpltext.FuncMap {
	// Functions in these namespaces are based on those from github.com/hairyhenderson/gomplate/v4 with some differences
	// noted in comments.
	// Currently gomplate does not allow modularized use of select functions or namespaces, so importing it directly
	// would require a significant increase in dependencies.
	// In addition, certain necessary functions have extended functionality in gomplate that makes them risky to use
	// here, such as the eJSON decryption capability of data.JSON which reads from environment variables.
	// That being said, none of this is insurmountable, and the plan should be to eventually incorporate the gomplate
	// library directly.
	funcMap := tmpltext.FuncMap{}
	CreateCollFuncs().AddToFuncMap(funcMap)
	CreateDataFuncs().AddToFuncMap(funcMap)
	CreateTemplateFuncs(text).AddToFuncMap(funcMap)
	CreateTimeFuncs().AddToFuncMap(funcMap)

	return funcMap
}
