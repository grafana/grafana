require("./date.js")
var rwc = require('random-weighted-choice');
_ = require("./underscore.min.js")
fs = require('fs')
complete = 0;

fs.readFile('shakespeare.json', 'utf8', function (err,data) {
  i = 0;
  if (err) {
    return console.log(err);
  }
  var obj = JSON.parse(data);
  var lines = obj.length
  console.error("Generating " + lines + " events");
  _.each(obj, function (o) {
    setTimeout(print_obj(o), 10000) //wait ten seconds before continuing
  });

  function getRandomInRange(from, to, fixed) {
    return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
  }

  function print_obj(o) {
    var randomnumber=Math.floor(Math.random()*28800000)
    var command = {index:{_index: "shakespeare", _type: "line", _id: i}};
    o['@timestamp'] = new Date((new Date()).getTime() -9000000 + randomnumber);
    o.geo = [getRandomInRange(-90, 90, 3),getRandomInRange(-180, 180, 3)]
    o.country = get_country();
    if(o.country == 'US')
      o.state = get_state()
    console.log(JSON.stringify(command))
    console.log(JSON.stringify(o));
    var percent = Math.floor((i/lines)*100)
    if (percent%10 == 0 && percent > complete) {
      console.error(percent+"% complete")
      complete = percent;
    }
    i = i + 1;
  }

  function get_state() {
    var states = ['AL','AK','AZ','AR','CA','CO','CT','DE',
    'FL','GA','HI','ID','IL','IN','IA','KS',
    'KY','LA','ME','MD','MA','MI','MN','MS',
    'MO','MT','NE','NV','NH','NJ','NM','NY',
    'NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV',
    'WI','WY'];
    return states[Math.floor(Math.random()*50)];
  }

  function get_country() {
    var countries = [
      {id:"CN",weight:1330044000},{id:"IN",weight:1173108018},
      {id:"US",weight:610232863},{id:"ID",weight:242968342},
      {id:"BR",weight:201103330},{id:"PK",weight:184404791},
      {id:"BD",weight:156118464},{id:"NG",weight:154000000},
      {id:"RU",weight:140702000},{id:"JP",weight:127288000},
      {id:"MX",weight:112468855},{id:"PH",weight:99900177},
      {id:"VN",weight:89571130},{id:"ET",weight:88013491},
      {id:"DE",weight:81802257},{id:"EG",weight:80471869},
      {id:"TR",weight:77804122},{id:"IR",weight:76923300},
      {id:"CD",weight:70916439},{id:"TH",weight:67089500},
      {id:"FR",weight:64768389},{id:"GB",weight:62348447},
      {id:"IT",weight:60340328},{id:"MM",weight:53414374},
      {id:"ZA",weight:49000000},{id:"KR",weight:48422644},
      {id:"ES",weight:46505963},{id:"UA",weight:45415596},
      {id:"CO",weight:44205293},{id:"TZ",weight:41892895},
      {id:"AR",weight:41343201},{id:"KE",weight:40046566},
      {id:"PL",weight:38500000},{id:"SD",weight:35000000},
      {id:"DZ",weight:34586184},{id:"CA",weight:33679000},
      {id:"UG",weight:33398682},{id:"MA",weight:31627428},
      {id:"PE",weight:29907003},{id:"IQ",weight:29671605},
      {id:"AF",weight:29121286},{id:"NP",weight:28951852},
      {id:"MY",weight:28274729},{id:"UZ",weight:27865738},
      {id:"VE",weight:27223228},{id:"SA",weight:25731776},
      {id:"GH",weight:24339838},{id:"YE",weight:23495361},
      {id:"KP",weight:22912177},{id:"TW",weight:22894384},
      {id:"SY",weight:22198110},{id:"MZ",weight:22061451},
      {id:"RO",weight:21959278},{id:"AU",weight:21515754},
      {id:"LK",weight:21513990},{id:"MG",weight:21281844},
      {id:"CI",weight:21058798},{id:"CM",weight:19294149},
      {id:"CL",weight:16746491},{id:"NL",weight:16645000},
      {id:"BF",weight:16241811},{id:"NE",weight:15878271},
      {id:"MW",weight:15447500},{id:"KZ",weight:15340000},
      {id:"EC",weight:14790608},{id:"KH",weight:14453680},
      {id:"ML",weight:13796354},{id:"GT",weight:13550440},
      {id:"ZM",weight:13460305},{id:"AO",weight:13068161},
      {id:"SN",weight:12323252},{id:"ZW",weight:11651858},
      {id:"CU",weight:11423000},{id:"RW",weight:11055976},
      {id:"GR",weight:11000000},{id:"CS",weight:10829175},
      {id:"PT",weight:10676000},{id:"TN",weight:10589025},
      {id:"TD",weight:10543464},{id:"CZ",weight:10476000},
      {id:"BE",weight:10403000},{id:"GN",weight:10324025},
      {id:"SO",weight:10112453},{id:"BO",weight:9947418},
      {id:"HU",weight:9930000},{id:"BI",weight:9863117},
      {id:"DO",weight:9823821},{id:"BY",weight:9685000},
      {id:"HT",weight:9648924},{id:"BJ",weight:9056010},
      {id:"SE",weight:9045000},{id:"AZ",weight:8303512},
      {id:"SS",weight:8260490},{id:"AT",weight:8205000},
      {id:"HN",weight:7989415},{id:"CH",weight:7581000},
      {id:"TJ",weight:7487489},{id:"IL",weight:7353985},
      {id:"RS",weight:7344847},{id:"BG",weight:7148785},
      {id:"HK",weight:6898686},{id:"TG",weight:6587239},
      {id:"LY",weight:6461454},{id:"JO",weight:6407085},
      {id:"PY",weight:6375830},{id:"LA",weight:6368162},
      {id:"PG",weight:6064515},{id:"SV",weight:6052064},
      {id:"NI",weight:5995928},{id:"ER",weight:5792984},
      {id:"KG",weight:5508626},{id:"DK",weight:5484000},
      {id:"SK",weight:5455000},{id:"SL",weight:5245695},
      {id:"FI",weight:5244000},{id:"NO",weight:5009150},
      {id:"AE",weight:4975593},{id:"TM",weight:4940916},
      {id:"CF",weight:4844927},{id:"SG",weight:4701069},
      {id:"GE",weight:4630000},{id:"IE",weight:4622917},
      {id:"BA",weight:4590000},{id:"CR",weight:4516220},
      {id:"HR",weight:4491000},{id:"MD",weight:4324000},
      {id:"NZ",weight:4252277},{id:"LB",weight:4125247},
      {id:"PR",weight:3916632},{id:"PS",weight:3800000},
      {id:"LR",weight:3685076},{id:"LT",weight:3565000},
      {id:"UY",weight:3477000},{id:"PA",weight:3410676},
      {id:"MR",weight:3205060},{id:"MN",weight:3086918},
      {id:"CG",weight:3039126},{id:"AL",weight:2986952},
      {id:"AM",weight:2968000},{id:"OM",weight:2967717},
      {id:"JM",weight:2847232},{id:"KW",weight:2789132},
      {id:"LV",weight:2217969},{id:"NA",weight:2128471},
      {id:"MK",weight:2061000},{id:"BW",weight:2029307},
      {id:"SI",weight:2007000},{id:"LS",weight:1919552},
      {id:"XK",weight:1800000},{id:"GM",weight:1593256},
      {id:"GW",weight:1565126},{id:"GA",weight:1545255},
      {id:"SZ",weight:1354051},{id:"MU",weight:1294104},
      {id:"EE",weight:1291170},{id:"TT",weight:1228691},
      {id:"TL",weight:1154625},{id:"CY",weight:1102677},
      {id:"GQ",weight:1014999},{id:"FJ",weight:875983},
      {id:"QA",weight:840926},{id:"RE",weight:776948},
      {id:"KM",weight:773407},{id:"GY",weight:748486},
      {id:"DJ",weight:740528},{id:"BH",weight:738004},
      {id:"BT",weight:699847},{id:"ME",weight:666730},
      {id:"SB",weight:559198},{id:"CV",weight:508659},
      {id:"LU",weight:497538},{id:"SR",weight:492829},
      {id:"MO",weight:449198},{id:"GP",weight:443000},
      {id:"MQ",weight:432900},{id:"MT",weight:403000},
      {id:"MV",weight:395650},{id:"BN",weight:395027},
      {id:"BZ",weight:314522},{id:"IS",weight:308910},
      {id:"BS",weight:301790},{id:"BB",weight:285653},
      {id:"EH",weight:273008},{id:"PF",weight:270485},
      {id:"VU",weight:221552},{id:"NC",weight:216494},
      {id:"GF",weight:195506},{id:"WS",weight:192001},
      {id:"ST",weight:175808},{id:"LC",weight:160922},
      {id:"GU",weight:159358},{id:"YT",weight:159042},
      {id:"CW",weight:141766},{id:"AN",weight:136197},
      {id:"TO",weight:122580},{id:"VI",weight:108708},
      {id:"GD",weight:107818},{id:"FM",weight:107708},
      {id:"VC",weight:104217},{id:"KI",weight:92533},
      {id:"JE",weight:90812},{id:"SC",weight:88340},
      {id:"AG",weight:86754},{id:"AD",weight:84000},
      {id:"IM",weight:75049},{id:"DM",weight:72813},
      {id:"AW",weight:71566},{id:"MH",weight:65859},
      {id:"BM",weight:65365},{id:"GG",weight:65228},
      {id:"AS",weight:57881},{id:"GL",weight:56375},
      {id:"MP",weight:53883},{id:"KN",weight:49898},
      {id:"FO",weight:48228},{id:"KY",weight:44270},
      {id:"SX",weight:37429},{id:"MF",weight:35925},
      {id:"LI",weight:35000},{id:"MC",weight:32965},
      {id:"SM",weight:31477},{id:"GI",weight:27884},
      {id:"AX",weight:26711},{id:"VG",weight:21730},
      {id:"CK",weight:21388},{id:"TC",weight:20556},
      {id:"PW",weight:19907},{id:"BQ",weight:18012},
      {id:"WF",weight:16025},{id:"AI",weight:13254},
      {id:"TV",weight:10472},{id:"NR",weight:10065},
      {id:"MS",weight:9341},{id:"BL",weight:8450},
      {id:"SH",weight:7460},{id:"PM",weight:7012},
      {id:"IO",weight:4000},{id:"FK",weight:2638},
      {id:"SJ",weight:2550},{id:"NU",weight:2166},
      {id:"NF",weight:1828},{id:"CX",weight:1500},
      {id:"TK",weight:1466},{id:"VA",weight:921},
      {id:"CC",weight:628},{id:"TF",weight:140},
      {id:"PN",weight:46},{id:"GS",weight:30}
    ];
    return rwc(countries);
  }
});
