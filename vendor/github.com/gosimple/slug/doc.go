// Copyright 2013 by Dobrosław Żybort. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/*
Package slug generate slug from unicode string, URL-friendly slugify with
multiple languages support.

Example:

	package main

	import(
		"github.com/gosimple/slug"
		"fmt"
	)

	func main () {
		text := slug.Make("Hellö Wörld хелло ворлд")
		fmt.Println(text) // Will print hello-world-khello-vorld

		someText := slug.Make("影師")
		fmt.Println(someText) // Will print: ying-shi

		enText := slug.MakeLang("This & that", "en")
		fmt.Println(enText) // Will print 'this-and-that'

		deText := slug.MakeLang("Diese & Dass", "de")
		fmt.Println(deText) // Will print 'diese-und-dass'

		slug.CustomSub = map[string]string{
			"water": "sand",
		}
		textSub := slug.Make("water is hot")
		fmt.Println(textSub) // Will print 'sand-is-hot'
	}

Requests or bugs?

https://github.com/gosimple/slug/issues
*/
package slug
