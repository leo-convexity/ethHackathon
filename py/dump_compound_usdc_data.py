#!/usr/bin/env python3
'''
dump_compound_usdc_data.py

Query local ethereum blockchain for Compound data

Requires web3 package to be installed.

To setup (only need to do this once):
    # Create python virtual environment (it can be outside of the git checkout tree)
    python3 -m venv ~/venv

    # Activate python virtual environment (shell prompt should change)
    . ~/venv/bin/activate

    # Install/update pip, wheel & web
    pip install --upgrade pip
    pip install --upgrade wheel
    pip install --upgrade web3

    # When finished using virtual environment, run deactive or just exit shell
    deactivate

To use virtual environment later again (web3 and other modules will already be there):
    # Activate python virtual environment (shell prompt should change)
    . ~/venv/bin/activate
'''
import json
import decimal
import web3

def D(x: int, decimals: int = 0):
    '''Convert integer to scaled decimal'''
    y = decimal.Decimal(x)
    y /= 10**decimals
    return y

w3 = web3.Web3(provider=web3.Web3.HTTPProvider('http://127.0.0.1:8545'))
assert w3.isConnected(), 'not connected'
assert not w3.eth.syncing, f'not synced: {w3.eth.syncing}'

cfgs = json.load(open('../compound-config/networks/mainnet.json'))
abis = json.load(open('../compound-config/networks/mainnet-abi.json'))

contract_cUSDC = w3.eth.contract(address=cfgs['cTokens']['cUSDC']['address'], abi=abis['cUSDC'])
contract_USDC = w3.eth.contract(address=cfgs['cTokens']['cUSDC']['underlying'], abi=abis['USDC'])

# sanity checks
assert contract_USDC.functions.symbol().call() == 'USDC'
assert contract_USDC.functions.decimals().call() == 6
assert cfgs['cTokens']['cUSDC']['decimals'] == 8
assert contract_cUSDC.functions.symbol().call() == 'cUSDC'
assert contract_cUSDC.functions.decimals().call() == 8

blockNumber = w3.eth.blockNumber
print()
print('# Ethereum')
print(f'{"blockNumber":<24} {blockNumber:>24,d}')
print()

f = lambda x, y: D(getattr(contract_cUSDC.functions, x)().call(block_identifier=blockNumber), y)
exchangeRateCurrent = f('exchangeRateCurrent', 16)
getCash = f('getCash', 6)
totalBorrows = f('totalBorrows', 6)
totalBorrowsCurrent = f('totalBorrowsCurrent', 6)
totalReserves = f('totalReserves', 6)
totalSupply = f('totalSupply', 8)
borrowRatePerBlock = f('borrowRatePerBlock', 18)
supplyRatePerBlock = f('supplyRatePerBlock', 18)
assert exchangeRateCurrent == (
        (getCash + totalBorrows - totalReserves) / totalSupply
    ).quantize(decimal.Decimal((0, (1,), -16)), rounding=decimal.ROUND_DOWN)
print('# cUSDC')
print(f'{"exchangeRateCurrent":<24} {exchangeRateCurrent:>24,.16f}')
print(f'{"getCash":<24} {getCash:>24,.6f}')
print(f'{"totalBorrows":<24} {totalBorrows:>24,.6f}')
print(f'{"totalBorrowsCurrent":<24} {totalBorrowsCurrent:>24,.6f}')
print(f'{"totalReserves":<24} {totalReserves:>24,.6f}')
print(f'{"totalSupply":<24} {totalSupply:>24,.8f}')
print(f'{"borrowRatePerBlock":<24} {borrowRatePerBlock:>24,.18f}')
print(f'{"supplyRatePerBlock":<24} {supplyRatePerBlock:>24,.18f}')
print()

f = lambda x, y: D(getattr(contract_USDC.functions, x)().call(block_identifier=blockNumber), y)
totalSupply = f('totalSupply', 6)
print('# USDC')
print(f'{"totalSupply":<24} {totalSupply:>24,.6f}')
print()
