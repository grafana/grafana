# Making changes to textparse lexers
In the rare case that you need to update the textparse lexers, edit promlex.l or openmetricslex.l and then run the following command: 
`golex -o=promlex.l.go promlex.l`

Note that you need golex installed: 
`go get -u modernc.org/golex`