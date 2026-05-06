set -e
echo "See http://www.tpc.org/tpc_documents_current_versions/pdf/tpc-h_v2.17.1.pdf for details"
tmp=$(mktemp -d)
cd $tmp
echo "installing modernc.org/sqlite/tpch@latest into $tmp"
GOBIN=$tmp go install modernc.org/sqlite/tpch@latest
echo "generating pseudotext"
./tpch -pseudotext
for sf in 1 10 ; do
	for sut in sqlite3 sqlite ; do
		echo "$sut: generating a $sf GB test DB"
		time -p ./tpch -sut $sut -dbgen -sf $sf
		for q in 1 2 ; do
			echo -n "$sut: running query $q: "
			./tpch -sut $sut -q $q -sf $sf
		done
	done
done
cd -
rm -rf $tmp
