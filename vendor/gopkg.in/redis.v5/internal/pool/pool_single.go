package pool

type SingleConnPool struct {
	cn *Conn
}

var _ Pooler = (*SingleConnPool)(nil)

func NewSingleConnPool(cn *Conn) *SingleConnPool {
	return &SingleConnPool{
		cn: cn,
	}
}

func (p *SingleConnPool) Get() (*Conn, bool, error) {
	return p.cn, false, nil
}

func (p *SingleConnPool) Put(cn *Conn) error {
	if p.cn != cn {
		panic("p.cn != cn")
	}
	return nil
}

func (p *SingleConnPool) Remove(cn *Conn, _ error) error {
	if p.cn != cn {
		panic("p.cn != cn")
	}
	return nil
}

func (p *SingleConnPool) Len() int {
	return 1
}

func (p *SingleConnPool) FreeLen() int {
	return 0
}

func (p *SingleConnPool) Stats() *Stats {
	return nil
}

func (p *SingleConnPool) Close() error {
	return nil
}
