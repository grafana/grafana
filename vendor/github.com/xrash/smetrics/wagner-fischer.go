package smetrics

// The Wagner-Fischer algorithm for calculating the Levenshtein distance.
// The first two parameters are the two strings to be compared. The last three parameters are the insertion cost, the deletion cost and the substitution cost. These are normally defined as 1, 1 and 2 respectively.
func WagnerFischer(a, b string, icost, dcost, scost int) int {

	// Allocate both rows.
	row1 := make([]int, len(b)+1)
	row2 := make([]int, len(b)+1)
	var tmp []int

	// Initialize the first row.
	for i := 1; i <= len(b); i++ {
		row1[i] = i * icost
	}

	// For each row...
	for i := 1; i <= len(a); i++ {
		row2[0] = i * dcost

		// For each column...
		for j := 1; j <= len(b); j++ {
			if a[i-1] == b[j-1] {
				row2[j] = row1[j-1]
			} else {
				ins := row2[j-1] + icost
				del := row1[j] + dcost
				sub := row1[j-1] + scost

				if ins < del && ins < sub {
					row2[j] = ins
				} else if del < sub {
					row2[j] = del
				} else {
					row2[j] = sub
				}
			}
		}

		// Swap the rows at the end of each row.
		tmp = row1
		row1 = row2
		row2 = tmp
	}

	// Because we swapped the rows, the final result is in row1 instead of row2.
	return row1[len(row1)-1]
}
