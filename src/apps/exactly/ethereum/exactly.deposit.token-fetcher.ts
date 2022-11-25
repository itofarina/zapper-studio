import { Inject } from '@nestjs/common';
import { utils } from 'ethers';
import _ from 'lodash';

import { IAppToolkit, APP_TOOLKIT } from '~app-toolkit/app-toolkit.interface';
import { ZERO_ADDRESS } from '~app-toolkit/constants/address';
import { Register } from '~app-toolkit/decorators';
import { getImagesFromToken } from '~app-toolkit/helpers/presentation/image.present';
import { ContractType } from '~position/contract.interface';
import { AppTokenPosition } from '~position/position.interface';
import { AppTokenTemplatePositionFetcher } from '~position/template/app-token.template.position-fetcher';
import { Network } from '~types/network.interface';

import { ExactlyContractFactory } from '../contracts';
import { EXACTLY_DEFINITION } from '../exactly.definition';

const appId = EXACTLY_DEFINITION.id;
const groupId = EXACTLY_DEFINITION.groups.deposit.id;
const network = Network.ETHEREUM_MAINNET;

const PREVIEWER_ADDRESS = '0xf6da0e129fdc6e8fda49d8b2b33a6d4ba43c677b';

@Register.TokenPositionFetcher({ appId, groupId, network })
export class EthereumExactlyDepositTokenFetcher implements AppTokenTemplatePositionFetcher<AppTokenPosition> {
  constructor(
    @Inject(APP_TOOLKIT) private readonly appToolkit: IAppToolkit,
    @Inject(ExactlyContractFactory)
    private readonly exactlyContractFactory: ExactlyContractFactory,
  ) { }

  async getPositions() {
    const previewer = this.exactlyContractFactory.previewer({
      address: PREVIEWER_ADDRESS,
      network: Network.ETHEREUM_MAINNET,
    });

    const marketsData = await previewer.exactly(ZERO_ADDRESS);
    const multicall = this.appToolkit.getMulticall(network);

    const tokens = await Promise.all(
      marketsData.map(async marketData => {
        const { market: address } = marketData;
        const marketContract = this.exactlyContractFactory.market({
          address,
          network,
        });

        const [symbol, decimals, supplyRaw, underlyingAssetAddress, pricePerShareRaw] = await Promise.all([
          multicall.wrap(marketContract).symbol(),
          multicall.wrap(marketContract).decimals(),
          multicall.wrap(marketContract).totalSupply(),
          multicall.wrap(marketContract).asset(),
          multicall.wrap(marketContract).convertToAssets(utils.parseEther('1')),
        ]);

        const underlyingToken = await this.appToolkit.getBaseTokenPrice({
          network: Network.ETHEREUM_MAINNET,
          address: underlyingAssetAddress.toLowerCase(),
        });
        if (!underlyingToken) return null;

        const supply = Number(supplyRaw) / 10 ** decimals;
        const pricePerShare = Number(utils.formatEther(pricePerShareRaw));

        const token: AppTokenPosition = {
          type: ContractType.APP_TOKEN,
          appId,
          groupId,
          address,
          network,
          symbol,
          decimals,
          supply,
          price: underlyingToken.price, // also Number(utils.formatEther(marketData.usdPrice))
          pricePerShare,
          dataProps: {
            // TODO: add APY here -> consume TheGraph
            liquidity: supply * underlyingToken.price,
          },
          tokens: [underlyingToken],
          displayProps: {
            label: underlyingToken.symbol,
            labelDetailed: symbol,
            images: [...getImagesFromToken(underlyingToken)],
          },
        };

        return token;
      }),
    );
    return _.compact(tokens);
  }
}
