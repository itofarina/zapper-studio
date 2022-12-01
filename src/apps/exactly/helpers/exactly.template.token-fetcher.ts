import { Inject } from '@nestjs/common';
import _ from 'lodash';

import { APP_TOOLKIT, IAppToolkit } from '~app-toolkit/app-toolkit.interface';
import { ZERO_ADDRESS } from '~app-toolkit/constants/address';
import { getImagesFromToken } from '~app-toolkit/helpers/presentation/image.present';
import { ContractType } from '~position/contract.interface';
import { AppTokenPosition } from '~position/position.interface';
import { AppTokenTemplatePositionFetcher } from '~position/template/app-token.template.position-fetcher';
import { DefaultAppTokenDataProps } from '~position/template/app-token.template.types';

import { ExactlyContractFactory, Market, Previewer } from '../contracts';

type ExactlyTokenDataProps = DefaultAppTokenDataProps;

const PREVIEWER_ADDRESS = '0xf6da0e129fdc6e8fda49d8b2b33a6d4ba43c677b';

export abstract class ExactlyTemplateTokenFetcher extends AppTokenTemplatePositionFetcher<
  Market,
  ExactlyTokenDataProps
> {
  constructor(
    @Inject(APP_TOOLKIT) protected readonly appToolkit: IAppToolkit,
    @Inject(ExactlyContractFactory) protected readonly exactlyContractFactory: ExactlyContractFactory,
  ) {
    super(appToolkit);
  }

  async getAddresses(): Promise<string[]> {
    const previewer = this.getPreviewer();
    const marketsData = await previewer.exactly(ZERO_ADDRESS);

    return marketsData.map(({ market }) => market);
  }

  getContract(address: string): Market {
    return this.exactlyContractFactory.market({
      address,
      network: this.network,
    });
  }

  getPositions = async (): Promise<AppTokenPosition<DefaultAppTokenDataProps>[]> => {
    const previewer = this.getPreviewer();

    const marketsData = await previewer.exactly(ZERO_ADDRESS);

    const multicall = this.appToolkit.getMulticall(this.network);
    const tokens = await Promise.all(
      marketsData.map(async marketData => {
        const { market: address } = marketData;
        const marketContract = this.exactlyContractFactory.market({
          address,
          network: this.network,
        });

        const [symbol, decimals, totalSupply, asset, pricePerShareRaw, totalAssets] = await Promise.all([
          multicall.wrap(marketContract).symbol(),
          multicall.wrap(marketContract).decimals(),
          multicall.wrap(marketContract).totalSupply(),
          multicall.wrap(marketContract).asset(),
          multicall.wrap(marketContract).convertToAssets(String(10 ** marketData.decimals)),
          multicall.wrap(marketContract).totalAssets(),
        ]);

        const underlyingToken = await this.appToolkit.getBaseTokenPrice({
          network: this.network,
          address: asset.toLowerCase(),
        });
        if (!underlyingToken) return null;

        const supply = Number(totalSupply) / 10 ** decimals;
        const liquidity = (Number(totalAssets) / 10 ** decimals) * underlyingToken.price;
        const pricePerShare = Number(pricePerShareRaw) / 10 ** decimals;

        const token: AppTokenPosition<ExactlyTokenDataProps> = {
          type: ContractType.APP_TOKEN,
          appId: this.appId,
          groupId: this.groupId,
          address,
          network: this.network,
          symbol,
          decimals,
          supply,
          price: underlyingToken.price,
          pricePerShare,
          dataProps: {
            liquidity,
            // TODO: omit these dataProps
            apy: 0,
            reserves: [0],
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
  };

  getPreviewer(): Previewer {
    return this.exactlyContractFactory.previewer({
      address: PREVIEWER_ADDRESS,
      network: this.network,
    });
  }
}
