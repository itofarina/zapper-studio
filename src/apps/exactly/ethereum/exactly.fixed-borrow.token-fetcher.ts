import { Register } from '~app-toolkit/decorators';
import { Network } from '~types/network.interface';

import { EXACTLY_DEFINITION } from '../exactly.definition';
import { ExactlyTemplateTokenFetcher } from '../helpers/exactly.template.token-fetcher';

const appId = EXACTLY_DEFINITION.id;
const groupId = EXACTLY_DEFINITION.groups.fixedBorrow.id;
const network = Network.ETHEREUM_MAINNET;

@Register.TokenPositionFetcher({ appId, groupId, network })
export class EthereumExactlyFixedBorrowTokenFetcher extends ExactlyTemplateTokenFetcher {
  groupLabel = 'Fixed borrow';
  isDebt = true;
}
