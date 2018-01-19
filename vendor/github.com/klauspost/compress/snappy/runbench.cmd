del old.txt
go test -bench=. >>old.txt && go test -bench=. >>old.txt && go test -bench=. >>old.txt && benchstat -delta-test=ttest old.txt new.txt
