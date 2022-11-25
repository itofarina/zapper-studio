import { Register } from '~app-toolkit/decorators';
import { AbstractApp } from '~app/app.dynamic-module';

import { ExactlyContractFactory } from './contracts';
import { EthereumExactlyDepositTokenFetcher } from './ethereum/exactly.deposit.token-fetcher';
import { ExactlyAppDefinition, EXACTLY_DEFINITION } from './exactly.definition';

@Register.AppModule({
  appId: EXACTLY_DEFINITION.id,
  providers: [EthereumExactlyDepositTokenFetcher, ExactlyAppDefinition, ExactlyContractFactory],
})
export class ExactlyAppModule extends AbstractApp() { }
