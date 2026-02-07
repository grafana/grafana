package sqlds

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// we could add more "tables" later
var mockTables = map[string]string{
	"users": users,
}

// MockDataFolder is the default folder that will contain data files
const MockDataFolder = "/mock-data"

// Create will create a "table" (csv file) in the data folder that can be queried with SQL
func CreateMockTable(table string, folder string) error {
	return CreateMockData(table, folder, mockTables[table])
}

// CreateData will create a "table" (csv file) in the data folder that can be queried with SQL
func CreateMockData(table string, folder string, csvData string) error {
	if folder == "" {
		folder = MockDataFolder
	}
	ex, err := os.Executable()
	if err != nil {
		backend.Logger.Error("failed getting to Hana Mock path: " + err.Error())
		return err
	}
	exPath := filepath.Dir(ex)
	if _, err := os.Stat(exPath + folder); errors.Is(err, fs.ErrNotExist) {
		if err := os.Mkdir(exPath+folder, 0700); err != nil {
			backend.Logger.Error("failed creating mock folder: " + err.Error())
			return err
		}
	}
	tablePath := exPath + folder + "/" + table
	_, err = os.Stat(tablePath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			if err := os.WriteFile(tablePath, []byte(csvData), 0700); err != nil {
				backend.Logger.Error("failed writing mock data: " + err.Error())
				return err
			}
			return nil
		}
		return err
	}

	return nil
}

const users = `id,first_name,last_name,gender,country_code
1,Louis,Washington,Male,PS
2,Sean,Burton,Male,SE
3,Mildred,Gonzales,Female,ID
4,Kathy,Dunn,Female,PE
5,Brian,Fernandez,Male,ID
6,Aaron,Alvarez,Male,TN
7,Theresa,King,Female,PH
8,Catherine,Greene,Female,ID
9,Barbara,Sanders,Female,US
10,John,Garrett,Male,MT
11,Jerry,Tucker,Male,GT
12,James,Marshall,Male,PL
13,Cheryl,Perry,Female,CN
14,Gregory,Jones,Male,CA
15,Julie,Olson,Female,JP
16,Raymond,King,Male,AZ
17,Christina,Wagner,Female,AR
18,Evelyn,Harvey,Female,RU
19,Earl,Stewart,Male,ID
20,Jerry,Kelley,Male,RU
21,Russell,Ruiz,Male,ID
22,Rachel,Reynolds,Female,FR
23,Anne,Richards,Female,PA
24,Jimmy,Hudson,Male,GR
25,Brandon,Ward,Male,BR
26,Ruby,Stevens,Female,TH
27,Paula,Jordan,Female,ID
28,Jessica,Hayes,Female,CN
29,Kimberly,Butler,Female,AD
30,Jacqueline,Lee,Female,CN
31,Heather,Lopez,Female,ID
32,Cheryl,Burke,Female,AR
33,Sarah,Ryan,Female,CN
34,Donna,Kelly,Female,ID
35,Norma,Davis,Female,ID
36,Jack,Anderson,Male,CN
37,Albert,Gibson,Male,PH
38,Victor,Hayes,Male,SN
39,Mary,Lynch,Female,MN
40,Elizabeth,Fernandez,Female,PL
41,Brenda,Shaw,Female,GR
42,Jacqueline,Hernandez,Female,RU
43,Sarah,King,Female,PT
44,Christine,Nguyen,Female,MC
45,Johnny,Woods,Male,CN
46,Dennis,Thompson,Male,RU
47,Diana,Brooks,Female,CO
48,Wayne,Morales,Male,CR
49,Arthur,Howard,Male,PE
50,Earl,Daniels,Male,ID
51,Martin,Gonzales,Male,PL
52,Annie,Palmer,Female,PK
53,Rose,Griffin,Female,MN
54,Ruth,Garza,Female,TH
55,Gerald,Marshall,Male,CZ
56,Julie,Mills,Female,FI
57,Julia,Fowler,Female,PS
58,Bonnie,Dixon,Female,CN
59,Adam,Mendoza,Male,FR
60,Brian,Bailey,Male,HR
61,Linda,Hansen,Female,PL
62,Edward,Gordon,Male,JP
63,Pamela,Hill,Female,LV
64,Ruth,Gibson,Female,YE
65,John,Reynolds,Male,CN
66,Nancy,Berry,Female,PH
67,Kevin,Kelly,Male,PL
68,Sean,Williamson,Male,PH
69,Jeremy,Rogers,Male,CN
70,Emily,Carroll,Female,ME
71,Antonio,Torres,Male,RU
72,Willie,Barnes,Male,ID
73,Margaret,Lewis,Female,PL
74,Douglas,Dunn,Male,IL
75,Lois,Cruz,Female,LY
76,Lori,Reynolds,Female,CG
77,Debra,Ray,Female,CZ
78,Brandon,Garza,Male,MN
79,Norma,Smith,Female,MX
80,Jennifer,Murray,Female,PT
81,Howard,Chapman,Male,CN
82,Diane,Cox,Female,IE
83,Victor,Martinez,Male,ID
84,Sara,Olson,Female,CN
85,Joyce,Snyder,Female,CA
86,Bruce,Price,Male,KI
87,Ryan,Lane,Male,IR
88,Jean,Richards,Female,RU
89,Nicholas,Carpenter,Male,CI
90,Richard,Burke,Male,AR
91,Harry,Young,Male,GT
92,Walter,Boyd,Male,PH
93,Roy,Cox,Male,BR
94,Judy,Myers,Female,CN
95,Jason,Alexander,Male,RU
96,Henry,James,Male,PT
97,George,Hawkins,Male,IR
98,Irene,Chavez,Female,FR
99,Willie,Alvarez,Male,ID
100,Evelyn,Kennedy,Female,HT`
