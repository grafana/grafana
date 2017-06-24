package govaluate

import (
	"bytes"
)

/*
	Holds a series of "transactions" which represent each token as it is output by an outputter (such as ToSQLQuery()).
	Some outputs (such as SQL) require a function call or non-c-like syntax to represent an expression.
	To accomplish this, this struct keeps track of each translated token as it is output, and can return and rollback those transactions.
*/
type expressionOutputStream struct {
	transactions []string
}

func (this *expressionOutputStream) add(transaction string) {
	this.transactions = append(this.transactions, transaction)
}

func (this *expressionOutputStream) rollback() string {

	index := len(this.transactions) - 1
	ret := this.transactions[index]

	this.transactions = this.transactions[:index]
	return ret
}

func (this *expressionOutputStream) createString(delimiter string) string {

	var retBuffer bytes.Buffer
	var transaction string

	penultimate := len(this.transactions) - 1

	for i := 0; i < penultimate; i++ {

		transaction = this.transactions[i]

		retBuffer.WriteString(transaction)
		retBuffer.WriteString(delimiter)
	}
	retBuffer.WriteString(this.transactions[penultimate])

	return retBuffer.String()
}
