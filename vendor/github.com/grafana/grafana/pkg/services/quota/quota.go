package quota

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

var ErrInvalidQuotaTarget = errors.New("invalid quota target")

func init() {
	registry.RegisterService(&QuotaService{})
}

type QuotaService struct {
	AuthTokenService models.UserTokenService `inject:""`
	Cfg              *setting.Cfg            `inject:""`
}

func (qs *QuotaService) Init() error {
	return nil
}

func (qs *QuotaService) QuotaReached(c *models.ReqContext, target string) (bool, error) {
	if !qs.Cfg.Quota.Enabled {
		return false, nil
	}
	// No request context means this is a background service, like LDAP Background Sync.
	// TODO: we should replace the req context with a more limited interface or struct,
	//       something that we could easily provide from background jobs.
	if c == nil {
		return false, nil
	}

	// get the list of scopes that this target is valid for. Org, User, Global
	scopes, err := qs.getQuotaScopes(target)
	if err != nil {
		return false, err
	}

	for _, scope := range scopes {
		c.Logger.Debug("Checking quota", "target", target, "scope", scope)

		switch scope.Name {
		case "global":
			if scope.DefaultLimit < 0 {
				continue
			}
			if scope.DefaultLimit == 0 {
				return true, nil
			}
			if target == "session" {
				usedSessions, err := qs.AuthTokenService.ActiveTokenCount(c.Req.Context())
				if err != nil {
					return false, err
				}

				if usedSessions > scope.DefaultLimit {
					c.Logger.Debug("Sessions limit reached", "active", usedSessions, "limit", scope.DefaultLimit)
					return true, nil
				}
				continue
			}
			query := models.GetGlobalQuotaByTargetQuery{Target: scope.Target}
			if err := bus.Dispatch(&query); err != nil {
				return true, err
			}
			if query.Result.Used >= scope.DefaultLimit {
				return true, nil
			}
		case "org":
			if !c.IsSignedIn {
				continue
			}
			query := models.GetOrgQuotaByTargetQuery{OrgId: c.OrgId, Target: scope.Target, Default: scope.DefaultLimit}
			if err := bus.Dispatch(&query); err != nil {
				return true, err
			}
			if query.Result.Limit < 0 {
				continue
			}
			if query.Result.Limit == 0 {
				return true, nil
			}

			if query.Result.Used >= query.Result.Limit {
				return true, nil
			}
		case "user":
			if !c.IsSignedIn || c.UserId == 0 {
				continue
			}
			query := models.GetUserQuotaByTargetQuery{UserId: c.UserId, Target: scope.Target, Default: scope.DefaultLimit}
			if err := bus.Dispatch(&query); err != nil {
				return true, err
			}
			if query.Result.Limit < 0 {
				continue
			}
			if query.Result.Limit == 0 {
				return true, nil
			}

			if query.Result.Used >= query.Result.Limit {
				return true, nil
			}
		}
	}

	return false, nil
}

func (qs *QuotaService) getQuotaScopes(target string) ([]models.QuotaScope, error) {
	scopes := make([]models.QuotaScope, 0)
	switch target {
	case "user":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.User},
			models.QuotaScope{Name: "org", Target: "org_user", DefaultLimit: qs.Cfg.Quota.Org.User},
		)
		return scopes, nil
	case "org":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.Org},
			models.QuotaScope{Name: "user", Target: "org_user", DefaultLimit: qs.Cfg.Quota.User.Org},
		)
		return scopes, nil
	case "dashboard":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.Dashboard},
			models.QuotaScope{Name: "org", Target: target, DefaultLimit: qs.Cfg.Quota.Org.Dashboard},
		)
		return scopes, nil
	case "data_source":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.DataSource},
			models.QuotaScope{Name: "org", Target: target, DefaultLimit: qs.Cfg.Quota.Org.DataSource},
		)
		return scopes, nil
	case "api_key":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.ApiKey},
			models.QuotaScope{Name: "org", Target: target, DefaultLimit: qs.Cfg.Quota.Org.ApiKey},
		)
		return scopes, nil
	case "session":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.Session},
		)
		return scopes, nil
	default:
		return scopes, ErrInvalidQuotaTarget
	}
}
