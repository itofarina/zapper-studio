import { Inject } from '@nestjs/common';
import { BigNumber, constants } from 'ethers';
import _ from 'lodash';

import { drillBalance } from '~app-toolkit';
import { IAppToolkit, APP_TOOLKIT } from '~app-toolkit/app-toolkit.interface';
import { Register } from '~app-toolkit/decorators';
import { presentBalanceFetcherResponse } from '~app-toolkit/helpers/presentation/balance-fetcher-response.present';
import { BalanceFetcher } from '~balance/balance-fetcher.interface';
import { Network } from '~types/network.interface';

import { ExactlyContractFactory } from '../contracts';
import { EXACTLY_DEFINITION } from '../exactly.definition';

const network = Network.ETHEREUM_MAINNET;
const PREVIEWER_ADDRESS = '0xf6da0e129fdc6e8fda49d8b2b33a6d4ba43c677b';
const appId = EXACTLY_DEFINITION.id;

@Register.BalanceFetcher(appId, network)
export class EthereumExactlyBalanceFetcher implements BalanceFetcher {
  constructor(
    @Inject(APP_TOOLKIT) private readonly appToolkit: IAppToolkit,
    @Inject(ExactlyContractFactory) private readonly contractFactory: ExactlyContractFactory,
  ) {}

  async getMarketsData(address: string) {
    const previewer = this.contractFactory.previewer({
      address: PREVIEWER_ADDRESS,
      network,
    });

    return this.appToolkit.getMulticall(network).wrap(previewer).exactly(address);
  }

  async getFixedDepositBalances(address: string) {
    const marketsData = await this.getMarketsData(address);
    const balances = await Promise.all(
      marketsData.map(async ({ market, fixedDepositPositions }) => {
        const marketContract = this.contractFactory.market({
          address: market,
          network,
        });

        const asset = await this.appToolkit.getMulticall(network).wrap(marketContract).asset();
        const baseToken = await this.appToolkit.getBaseTokenPrice({ address: asset.toLowerCase(), network });

        if (!baseToken) return null;

        const total = fixedDepositPositions.reduce(
          (acc, { position: { principal, fee } }) => acc.add(principal).add(fee),
          BigNumber.from(0),
        );

        return drillBalance(baseToken, total.toString());
      }),
    );
    return _.compact(balances);
  }

  async getFixedBorrowBalances(address: string) {
    const marketsData = await this.getMarketsData(address);
    const balances = await Promise.all(
      marketsData.map(async ({ market, fixedBorrowPositions, penaltyRate }) => {
        const marketContract = this.contractFactory.market({
          address: market,
          network,
        });
        const asset = await marketContract.asset();
        const baseToken = await this.appToolkit.getBaseTokenPrice({ address: asset.toLowerCase(), network });
        if (!baseToken) return null;

        const totalPositions = fixedBorrowPositions.reduce((acc, { maturity, position: { principal, fee } }) => {
          const timeElapsed = Math.floor(Date.now() / 1000) - maturity.toNumber();
          const penalties =
            timeElapsed > 0
              ? principal.add(fee).mul(penaltyRate).mul(timeElapsed).div(constants.WeiPerEther)
              : BigNumber.from(0);

          return acc.add(principal).add(fee).add(penalties);
        }, BigNumber.from(0));

        return drillBalance(baseToken, totalPositions.toString(), { isDebt: true });
      }),
    );
    return _.compact(balances);
  }

  async getVariableBorrowBalances(address: string) {
    const marketsData = await this.getMarketsData(address);

    const balances = await Promise.all(
      marketsData.map(async ({ market, floatingBorrowAssets }) => {
        const marketContract = this.contractFactory.market({
          address: market,
          network,
        });
        const asset = await this.appToolkit.getMulticall(network).wrap(marketContract).asset();
        const baseToken = await this.appToolkit.getBaseTokenPrice({ address: asset.toLowerCase(), network });
        if (!baseToken) return null;
        return drillBalance(baseToken, floatingBorrowAssets.toString(), { isDebt: true });
      }),
    );
    return _.compact(balances);
  }

  async getDepositBalances(address: string) {
    return Promise.all([
      // VRP deposits
      this.appToolkit.helpers.tokenBalanceHelper.getTokenBalances({
        address,
        appId,
        groupId: EXACTLY_DEFINITION.groups.deposit.id,
        network: Network.ETHEREUM_MAINNET,
      }),
      this.getFixedDepositBalances(address),
    ]).then(v => v.flat());
  }

  async getBorrowBalances(address: string) {
    return Promise.all([this.getVariableBorrowBalances(address), this.getFixedBorrowBalances(address)]).then(v =>
      v.flat(),
    );
  }

  async getBalances(address: string) {
    const [deposits, borrows] = await Promise.all([this.getDepositBalances(address), this.getBorrowBalances(address)]);

    return presentBalanceFetcherResponse([
      {
        label: 'Deposited',
        assets: deposits,
      },
      {
        label: 'Borrowed',
        assets: borrows,
      },
    ]);
  }
}
