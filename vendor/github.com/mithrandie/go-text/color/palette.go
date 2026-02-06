package color

type PaletteConfig struct {
	Effectors map[string]EffectorConfig `json:"effectors"`
}

type Palette struct {
	effects    map[string]*Effector
	useEffects bool
}

func NewPalette() *Palette {
	return &Palette{
		effects:    make(map[string]*Effector),
		useEffects: true,
	}
}

func (p *Palette) Enable() {
	p.useEffects = true
}

func (p *Palette) Disable() {
	p.useEffects = false
}

func (p *Palette) SetEffector(key string, effector *Effector) {
	p.effects[key] = effector
}

func (p *Palette) Render(key string, text string) string {
	if p.useEffects {
		if e, ok := p.effects[key]; ok {
			return e.Render(text)
		}
	}
	return text
}

func (p *Palette) ExportConfig() PaletteConfig {
	effects := make(map[string]EffectorConfig, len(p.effects))
	for k, v := range p.effects {
		effects[k] = v.ExportConfig()
	}
	return PaletteConfig{
		Effectors: effects,
	}
}

func (p *Palette) Merge(p2 *Palette) {
	for k, v := range p2.effects {
		p.effects[k] = v
	}
}

func GeneratePalette(config PaletteConfig) (*Palette, error) {
	p := NewPalette()
	for k, ec := range config.Effectors {
		e, err := GenerateEffector(ec)
		if err != nil {
			return nil, err
		}
		p.effects[k] = e
	}
	return p, nil
}
