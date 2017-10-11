package redis

func (c *baseClient) Pool() pool {
	return c.connPool
}
