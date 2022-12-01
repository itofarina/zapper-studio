import { Register } from '~app-toolkit/decorators';
import { DefaultAppTokenDataProps } from '~position/template/app-token.template.types';
import { Network } from '~types/network.interface';

import { EXACTLY_DEFINITION } from '../exactly.definition';
import { ExactlyTemplateTokenFetcher } from '../helpers/exactly.template.token-fetcher';

const appId = EXACTLY_DEFINITION.id;
const groupId = EXACTLY_DEFINITION.groups.deposit.id;
const network = Network.ETHEREUM_MAINNET;

export type ExactlyDepositTokenDataProps = DefaultAppTokenDataProps & {
  apr: number;
};

@Register.TokenPositionFetcher({ appId, groupId, network })
export class EthereumExactlyDepositTokenFetcher extends ExactlyTemplateTokenFetcher {
  groupLabel = 'Deposit';
}
