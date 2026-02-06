package cmds

func Put(cs *CommandSlice) {
	clear(cs.s)
	cs.s = cs.s[:0]
	cs.l = -1
	cs.r = 0
	pool.Put(cs)
}
