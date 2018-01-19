#define BOOTSTRAP_CSS()                                                                            \
  "/*!\n"                                                                                          \
  " * Bootstrap v2.0.3\n"                                                                          \
  " *\n"                                                                                           \
  " * Copyright 2012 Twitter, Inc\n"                                                               \
  " * Licensed under the Apache License v2.0\n"                                                    \
  " * http://www.apache.org/licenses/LICENSE-2.0\n"                                                \
  " *\n"                                                                                           \
  " * Designed and built with all the love in the world @twitter by @mdo and @fat.\n"              \
  " */\n"                                                                                          \
  ".clearfix{*zoom:1;}.clearfix:before,.clearfix:after{display:table;content:\"\";}\n"             \
  ".clearfix:after{clear:both;}\n"                                                                 \
  ".hide-text{font:0/0 "                                                                           \
  "a;color:transparent;text-shadow:none;background-color:transparent;border:0;}\n"                 \
  ".input-block-level{display:block;width:100%;min-height:28px;-webkit-box-sizing:border-box;-"    \
  "moz-box-sizing:border-box;-ms-box-sizing:border-box;box-sizing:border-box;}\n"                  \
  "article,aside,details,figcaption,figure,footer,header,hgroup,nav,section{display:block;}\n"     \
  "audio,canvas,video{display:inline-block;*display:inline;*zoom:1;}\n"                            \
  "audio:not([controls]){display:none;}\n"                                                         \
  "html{font-size:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}\n"                \
  "a:focus{outline:thin dotted #333;outline:5px auto "                                             \
  "-webkit-focus-ring-color;outline-offset:-2px;}\n"                                               \
  "a:hover,a:active{outline:0;}\n"                                                                 \
  "sub,sup{position:relative;font-size:75%;line-height:0;vertical-align:baseline;}\n"              \
  "sup{top:-0.5em;}\n"                                                                             \
  "sub{bottom:-0.25em;}\n"                                                                         \
  "img{max-width:100%;vertical-align:middle;border:0;-ms-interpolation-mode:bicubic;}\n"           \
  "button,input,select,textarea{margin:0;font-size:100%;vertical-align:middle;}\n"                 \
  "button,input{*overflow:visible;line-height:normal;}\n"                                          \
  "button::-moz-focus-inner,input::-moz-focus-inner{padding:0;border:0;}\n"                        \
  "button,input[type=\"button\"],input[type=\"reset\"],input[type=\"submit\"]{cursor:pointer;-"    \
  "webkit-appearance:button;}\n"                                                                   \
  "input[type=\"search\"]{-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:"  \
  "content-box;-webkit-appearance:textfield;}\n"                                                   \
  "input[type=\"search\"]::-webkit-search-decoration,input[type=\"search\"]::-webkit-search-"      \
  "cancel-button{-webkit-appearance:none;}\n"                                                      \
  "textarea{overflow:auto;vertical-align:top;}\n"                                                  \
  "body{margin:0;font-family:\"Helvetica "                                                         \
  "Neue\",Helvetica,Arial,sans-serif;font-size:13px;line-height:18px;color:#333333;background-"    \
  "color:#ffffff;}\n"                                                                              \
  "a{color:#0088cc;text-decoration:none;}\n"                                                       \
  "a:hover{color:#005580;text-decoration:underline;}\n"                                            \
  ".row{margin-left:-20px;*zoom:1;}.row:before,.row:after{display:table;content:\"\";}\n"          \
  ".row:after{clear:both;}\n"                                                                      \
  "[class*=\"span\"]{float:left;margin-left:20px;}\n"                                              \
  ".container,.navbar-fixed-top .container,.navbar-fixed-bottom .container{width:940px;}\n"        \
  ".span12{width:940px;}\n"                                                                        \
  ".span11{width:860px;}\n"                                                                        \
  ".span10{width:780px;}\n"                                                                        \
  ".span9{width:700px;}\n"                                                                         \
  ".span8{width:620px;}\n"                                                                         \
  ".span7{width:540px;}\n"                                                                         \
  ".span6{width:460px;}\n"                                                                         \
  ".span5{width:380px;}\n"                                                                         \
  ".span4{width:300px;}\n"                                                                         \
  ".span3{width:220px;}\n"                                                                         \
  ".span2{width:140px;}\n"                                                                         \
  ".span1{width:60px;}\n"                                                                          \
  ".offset12{margin-left:980px;}\n"                                                                \
  ".offset11{margin-left:900px;}\n"                                                                \
  ".offset10{margin-left:820px;}\n"                                                                \
  ".offset9{margin-left:740px;}\n"                                                                 \
  ".offset8{margin-left:660px;}\n"                                                                 \
  ".offset7{margin-left:580px;}\n"                                                                 \
  ".offset6{margin-left:500px;}\n"                                                                 \
  ".offset5{margin-left:420px;}\n"                                                                 \
  ".offset4{margin-left:340px;}\n"                                                                 \
  ".offset3{margin-left:260px;}\n"                                                                 \
  ".offset2{margin-left:180px;}\n"                                                                 \
  ".offset1{margin-left:100px;}\n"                                                                 \
  ".row-fluid{width:100%;*zoom:1;}.row-fluid:before,.row-fluid:after{display:table;content:\"\";}" \
  "\n"                                                                                             \
  ".row-fluid:after{clear:both;}\n"                                                                \
  ".row-fluid "                                                                                    \
  "[class*=\"span\"]{display:block;width:100%;min-height:28px;-webkit-box-sizing:border-box;-moz-" \
  "box-sizing:border-box;-ms-box-sizing:border-box;box-sizing:border-box;float:left;margin-left:"  \
  "2.127659574%;*margin-left:2.0744680846382977%;}\n"                                              \
  ".row-fluid [class*=\"span\"]:first-child{margin-left:0;}\n"                                     \
  ".row-fluid .span12{width:99.99999998999999%;*width:99.94680850063828%;}\n"                      \
  ".row-fluid .span11{width:91.489361693%;*width:91.4361702036383%;}\n"                            \
  ".row-fluid .span10{width:82.97872339599999%;*width:82.92553190663828%;}\n"                      \
  ".row-fluid .span9{width:74.468085099%;*width:74.4148936096383%;}\n"                             \
  ".row-fluid .span8{width:65.95744680199999%;*width:65.90425531263828%;}\n"                       \
  ".row-fluid .span7{width:57.446808505%;*width:57.3936170156383%;}\n"                             \
  ".row-fluid .span6{width:48.93617020799999%;*width:48.88297871863829%;}\n"                       \
  ".row-fluid .span5{width:40.425531911%;*width:40.3723404216383%;}\n"                             \
  ".row-fluid .span4{width:31.914893614%;*width:31.8617021246383%;}\n"                             \
  ".row-fluid .span3{width:23.404255317%;*width:23.3510638276383%;}\n"                             \
  ".row-fluid .span2{width:14.89361702%;*width:14.8404255306383%;}\n"                              \
  ".row-fluid .span1{width:6.382978723%;*width:6.329787233638298%;}\n"                             \
  ".container{margin-right:auto;margin-left:auto;*zoom:1;}.container:before,.container:after{"     \
  "display:table;content:\"\";}\n"                                                                 \
  ".container:after{clear:both;}\n"                                                                \
  ".container-fluid{padding-right:20px;padding-left:20px;*zoom:1;}.container-fluid:before,."       \
  "container-fluid:after{display:table;content:\"\";}\n"                                           \
  ".container-fluid:after{clear:both;}\n"                                                          \
  "p{margin:0 0 9px;font-family:\"Helvetica "                                                      \
  "Neue\",Helvetica,Arial,sans-serif;font-size:13px;line-height:18px;}p "                          \
  "small{font-size:11px;color:#999999;}\n"                                                         \
  ".lead{margin-bottom:18px;font-size:20px;font-weight:200;line-height:27px;}\n"                   \
  "h1,h2,h3,h4,h5,h6{margin:0;font-family:inherit;font-weight:bold;color:inherit;text-rendering:"  \
  "optimizelegibility;}h1 small,h2 small,h3 small,h4 small,h5 small,h6 "                           \
  "small{font-weight:normal;color:#999999;}\n"                                                     \
  "h1{font-size:30px;line-height:36px;}h1 small{font-size:18px;}\n"                                \
  "h2{font-size:24px;line-height:36px;}h2 small{font-size:18px;}\n"                                \
  "h3{font-size:18px;line-height:27px;}h3 small{font-size:14px;}\n"                                \
  "h4,h5,h6{line-height:18px;}\n"                                                                  \
  "h4{font-size:14px;}h4 small{font-size:12px;}\n"                                                 \
  "h5{font-size:12px;}\n"                                                                          \
  "h6{font-size:11px;color:#999999;text-transform:uppercase;}\n"                                   \
  ".page-header{padding-bottom:17px;margin:18px 0;border-bottom:1px solid #eeeeee;}\n"             \
  ".page-header h1{line-height:1;}\n"                                                              \
  "ul,ol{padding:0;margin:0 0 9px 25px;}\n"                                                        \
  "ul ul,ul ol,ol ol,ol ul{margin-bottom:0;}\n"                                                    \
  "ul{list-style:disc;}\n"                                                                         \
  "ol{list-style:decimal;}\n"                                                                      \
  "li{line-height:18px;}\n"                                                                        \
  "ul.unstyled,ol.unstyled{margin-left:0;list-style:none;}\n"                                      \
  "dl{margin-bottom:18px;}\n"                                                                      \
  "dt,dd{line-height:18px;}\n"                                                                     \
  "dt{font-weight:bold;line-height:17px;}\n"                                                       \
  "dd{margin-left:9px;}\n"                                                                         \
  ".dl-horizontal "                                                                                \
  "dt{float:left;width:120px;clear:left;text-align:right;overflow:hidden;text-overflow:ellipsis;"  \
  "white-space:nowrap;}\n"                                                                         \
  ".dl-horizontal dd{margin-left:130px;}\n"                                                        \
  "hr{margin:18px 0;border:0;border-top:1px solid #eeeeee;border-bottom:1px solid #ffffff;}\n"     \
  "strong{font-weight:bold;}\n"                                                                    \
  "em{font-style:italic;}\n"                                                                       \
  ".muted{color:#999999;}\n"                                                                       \
  "abbr[title]{cursor:help;border-bottom:1px dotted #ddd;}\n"                                      \
  "abbr.initialism{font-size:90%;text-transform:uppercase;}\n"                                     \
  "blockquote{padding:0 0 0 15px;margin:0 0 18px;border-left:5px solid #eeeeee;}blockquote "       \
  "p{margin-bottom:0;font-size:16px;font-weight:300;line-height:22.5px;}\n"                        \
  "blockquote small{display:block;line-height:18px;color:#999999;}blockquote "                     \
  "small:before{content:'\\2014 \\00A0';}\n"                                                       \
  "blockquote.pull-right{float:right;padding-right:15px;padding-left:0;border-right:5px solid "    \
  "#eeeeee;border-left:0;}blockquote.pull-right p,blockquote.pull-right "                          \
  "small{text-align:right;}\n"                                                                     \
  "q:before,q:after,blockquote:before,blockquote:after{content:\"\";}\n"                           \
  "address{display:block;margin-bottom:18px;font-style:normal;line-height:18px;}\n"                \
  "small{font-size:100%;}\n"                                                                       \
  "cite{font-style:normal;}\n"                                                                     \
  "code,pre{padding:0 3px 2px;font-family:Menlo,Monaco,Consolas,\"Courier "                        \
  "New\",monospace;font-size:12px;color:#333333;-webkit-border-radius:3px;-moz-border-radius:3px;" \
  "border-radius:3px;}\n"                                                                          \
  "code{padding:2px 4px;color:#d14;background-color:#f7f7f9;border:1px solid #e1e1e8;}\n"          \
  "pre{display:block;padding:8.5px;margin:0 0 "                                                    \
  "9px;font-size:12.025px;line-height:18px;word-break:break-all;word-wrap:break-word;white-space:" \
  "pre;white-space:pre-wrap;background-color:#f5f5f5;border:1px solid #ccc;border:1px solid "      \
  "rgba(0, 0, 0, "                                                                                 \
  "0.15);-webkit-border-radius:4px;-moz-border-radius:4px;border-radius:4px;}pre.prettyprint{"     \
  "margin-bottom:18px;}\n"                                                                         \
  "pre code{padding:0;color:inherit;background-color:transparent;border:0;}\n"                     \
  ".pre-scrollable{max-height:340px;overflow-y:scroll;}\n"                                         \
  ".label,.badge{font-size:10.998px;font-weight:bold;line-height:14px;color:#ffffff;vertical-"     \
  "align:baseline;white-space:nowrap;text-shadow:0 -1px 0 rgba(0, 0, 0, "                          \
  "0.25);background-color:#999999;}\n"                                                             \
  ".label{padding:1px 4px "                                                                        \
  "2px;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;}\n"                     \
  ".badge{padding:1px 9px "                                                                        \
  "2px;-webkit-border-radius:9px;-moz-border-radius:9px;border-radius:9px;}\n"                     \
  "a.label:hover,a.badge:hover{color:#ffffff;text-decoration:none;cursor:pointer;}\n"              \
  ".label-important,.badge-important{background-color:#b94a48;}\n"                                 \
  ".label-important[href],.badge-important[href]{background-color:#953b39;}\n"                     \
  ".label-warning,.badge-warning{background-color:#f89406;}\n"                                     \
  ".label-warning[href],.badge-warning[href]{background-color:#c67605;}\n"                         \
  ".label-success,.badge-success{background-color:#468847;}\n"                                     \
  ".label-success[href],.badge-success[href]{background-color:#356635;}\n"                         \
  ".label-info,.badge-info{background-color:#3a87ad;}\n"                                           \
  ".label-info[href],.badge-info[href]{background-color:#2d6987;}\n"                               \
  ".label-inverse,.badge-inverse{background-color:#333333;}\n"                                     \
  ".label-inverse[href],.badge-inverse[href]{background-color:#1a1a1a;}\n"                         \
  "table{max-width:100%;background-color:transparent;border-collapse:collapse;border-spacing:0;}"  \
  "\n"                                                                                             \
  ".table{width:100%;margin-bottom:18px;}.table th,.table "                                        \
  "td{padding:8px;line-height:18px;text-align:left;vertical-align:top;border-top:1px solid "       \
  "#dddddd;}\n"                                                                                    \
  ".table th{font-weight:bold;}\n"                                                                 \
  ".table thead th{vertical-align:bottom;}\n"                                                      \
  ".table caption+thead tr:first-child th,.table caption+thead tr:first-child td,.table "          \
  "colgroup+thead tr:first-child th,.table colgroup+thead tr:first-child td,.table "               \
  "thead:first-child tr:first-child th,.table thead:first-child tr:first-child "                   \
  "td{border-top:0;}\n"                                                                            \
  ".table tbody+tbody{border-top:2px solid #dddddd;}\n"                                            \
  ".table-condensed th,.table-condensed td{padding:4px 5px;}\n"                                    \
  ".table-bordered{border:1px solid "                                                              \
  "#dddddd;border-collapse:separate;*border-collapse:collapsed;border-left:0;-webkit-border-"      \
  "radius:4px;-moz-border-radius:4px;border-radius:4px;}.table-bordered th,.table-bordered "       \
  "td{border-left:1px solid #dddddd;}\n"                                                           \
  ".table-bordered caption+thead tr:first-child th,.table-bordered caption+tbody tr:first-child "  \
  "th,.table-bordered caption+tbody tr:first-child td,.table-bordered colgroup+thead "             \
  "tr:first-child th,.table-bordered colgroup+tbody tr:first-child th,.table-bordered "            \
  "colgroup+tbody tr:first-child td,.table-bordered thead:first-child tr:first-child "             \
  "th,.table-bordered tbody:first-child tr:first-child th,.table-bordered tbody:first-child "      \
  "tr:first-child td{border-top:0;}\n"                                                             \
  ".table-bordered thead:first-child tr:first-child th:first-child,.table-bordered "               \
  "tbody:first-child tr:first-child "                                                              \
  "td:first-child{-webkit-border-top-left-radius:4px;border-top-left-radius:4px;-moz-border-"      \
  "radius-topleft:4px;}\n"                                                                         \
  ".table-bordered thead:first-child tr:first-child th:last-child,.table-bordered "                \
  "tbody:first-child tr:first-child "                                                              \
  "td:last-child{-webkit-border-top-right-radius:4px;border-top-right-radius:4px;-moz-border-"     \
  "radius-topright:4px;}\n"                                                                        \
  ".table-bordered thead:last-child tr:last-child th:first-child,.table-bordered "                 \
  "tbody:last-child tr:last-child td:first-child{-webkit-border-radius:0 0 0 "                     \
  "4px;-moz-border-radius:0 0 0 4px;border-radius:0 0 0 "                                          \
  "4px;-webkit-border-bottom-left-radius:4px;border-bottom-left-radius:4px;-moz-border-radius-"    \
  "bottomleft:4px;}\n"                                                                             \
  ".table-bordered thead:last-child tr:last-child th:last-child,.table-bordered tbody:last-child " \
  "tr:last-child "                                                                                 \
  "td:last-child{-webkit-border-bottom-right-radius:4px;border-bottom-right-radius:4px;-moz-"      \
  "border-radius-bottomright:4px;}\n"                                                              \
  ".table-striped tbody tr:nth-child(odd) td,.table-striped tbody tr:nth-child(odd) "              \
  "th{background-color:#f9f9f9;}\n"                                                                \
  ".table tbody tr:hover td,.table tbody tr:hover th{background-color:#f5f5f5;}\n"                 \
  "table .span1{float:none;width:44px;margin-left:0;}\n"                                           \
  "table .span2{float:none;width:124px;margin-left:0;}\n"                                          \
  "table .span3{float:none;width:204px;margin-left:0;}\n"                                          \
  "table .span4{float:none;width:284px;margin-left:0;}\n"                                          \
  "table .span5{float:none;width:364px;margin-left:0;}\n"                                          \
  "table .span6{float:none;width:444px;margin-left:0;}\n"                                          \
  "table .span7{float:none;width:524px;margin-left:0;}\n"                                          \
  "table .span8{float:none;width:604px;margin-left:0;}\n"                                          \
  "table .span9{float:none;width:684px;margin-left:0;}\n"                                          \
  "table .span10{float:none;width:764px;margin-left:0;}\n"                                         \
  "table .span11{float:none;width:844px;margin-left:0;}\n"                                         \
  "table .span12{float:none;width:924px;margin-left:0;}\n"                                         \
  "table .span13{float:none;width:1004px;margin-left:0;}\n"                                        \
  "table .span14{float:none;width:1084px;margin-left:0;}\n"                                        \
  "table .span15{float:none;width:1164px;margin-left:0;}\n"                                        \
  "table .span16{float:none;width:1244px;margin-left:0;}\n"                                        \
  "table .span17{float:none;width:1324px;margin-left:0;}\n"                                        \
  "table .span18{float:none;width:1404px;margin-left:0;}\n"                                        \
  "table .span19{float:none;width:1484px;margin-left:0;}\n"                                        \
  "table .span20{float:none;width:1564px;margin-left:0;}\n"                                        \
  "table .span21{float:none;width:1644px;margin-left:0;}\n"                                        \
  "table .span22{float:none;width:1724px;margin-left:0;}\n"                                        \
  "table .span23{float:none;width:1804px;margin-left:0;}\n"                                        \
  "table .span24{float:none;width:1884px;margin-left:0;}"
