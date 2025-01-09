import { sheet } from '@emotion/css';

// emotion runs differently (slower) in dev vs prod
// see https://github.com/emotion-js/emotion/issues/462#issuecomment-344089084
// or https://github.com/emotion-js/emotion/discussions/2903#discussioncomment-3737996
// let's configure emotion to use speedy mode, as it does in prod
sheet.speedy(true);
