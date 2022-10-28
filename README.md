# wrapped-tokens

Wrapped tokens representing staked and generic assets.

## Setup

Requirements:

- Node >= v12
- Yarn

```
$ cd wrapped-tokens
$ npm i -g yarn       # Install yarn if you don't already have it
$ yarn install        # Install dependencies
$ yarn setup          # Setup Git hooks
```

## TypeScript type definition files for the contracts

To generate type definitions:

```
$ yarn compile && yarn typechain
```

## Linting and Formatting

To check code for problems:

```
$ yarn typecheck      # Type-check TypeScript code
$ yarn lint           # Check JavaScript and TypeScript code
$ yarn lint --fix     # Fix problems where possible
$ yarn solhint        # Check Solidity code
$ yarn slither        # Run Slither
```

To auto-format code:

```
$ yarn fmt
```

## Testing

Run all tests:

```
$ yarn test
```

To run tests in a specific file, run:

```
$ yarn test [path/to/file]
```

To run tests and generate test coverage, run:

```
$ yarn coverage
```

## Contracts

[High Level Flow](./doc/weth2SmartContractsHighLevel.png)

The implementation consists of 4 separate contracts, reusing
[centre-tokens](https://github.com/centrehq/centre-tokens) audited and battle
tested code whenever possible.

- A
  [proxy contract](https://github.com/centrehq/centre-tokens/blob/v2.1.0/contracts/v1/FiatTokenProxy.sol)
  which is an exact duplicate of the proxy contract used be centre-tokens.
- A token contract which for generic wrapped assets will be an exact duplicate
  of centre-tokens
  [fiat token](https://github.com/centrehq/centre-tokens/blob/v2.1.0/contracts/v2/FiatTokenV2_1.sol)
  or for wrapped staked assets will be a staked token (`StakedTokenV1.sol`)
  which inherits directly from centre-token's fiat tokens and adds exchange rate
  functionality.
- A mint forwarder contract (`MinterForwarder.sol`) which contains rate limited
  minting functionality for our wrapped tokens.
- An exchange rate updater contract (`ExchangeRateUpdater.sol`) which will only
  be used for wrapped staked assets and contains rate limited exchange rate
  updating functionality.

### ERC20 compatible

All wrapped tokens implement the ERC20 interface.

### Staked Token Differences from FiatToken

Wrapped staked tokens will be used to wrap staked assets. The wrapped staked
tokens inherit from Centre's fiat token contract and add an oracle role that can
set an exchangeRate. Both the `oracle` and the `exchangeRate` are stored in
unstructured storage to maximize forward compatibility with future centre fiat
token upgrades.

### Rate Limited Minting

The fiat token contract's built in minting has fixed minting allowances that
when depleted require the `masterMinter` cold key to restore the mint allowance.
We've introduced a
minting forwarder contract that'll allow us to continously mint up to N tokens
over M time, with the mint allowance replenishing programmatically.

### Rate Limited Exchange Rate Updates

Wrapped staked tokens will have a floating exchange rate that is set off-chain.
Given the high frequency with which we'll have to update wrapped
staked tokens exchange rates we'll utilize a seperate rate limited exchange rate
updater contract to minimize operational load.

### Ownable

The contract has an Owner, who can change the `owner`, `pauser`, `blacklister`,
`masterMinter`, or `oracle` addresses. The `owner` can not change the
`proxyOwner` address.
