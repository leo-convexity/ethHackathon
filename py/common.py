#!/usr/bin/env python3
<<<<<<< HEAD
=======
import json
>>>>>>> 50b609a22012bacc5472c40eeb7463fa8bb75513
import decimal
import web3
from collections import namedtuple
from typing import Optional, Tuple

def D(x: int, decimals: int = 0):
    '''Convert integer to scaled decimal'''
    y = decimal.Decimal(x)
    y /= 10**decimals
    return y

def new_web3(url: str) -> web3.Web3:
    w3 = web3.Web3(provider=web3.Web3.HTTPProvider('http://127.0.0.1:8545'))
    assert w3.isConnected(), 'not connected'
    assert not w3.eth.syncing, f'not synced: {w3.eth.syncing}'
    return w3

def get_contract_definitions(w3: web3.Web3, chain: str = 'mainnet'):
    cfgs = json.load(open(f'../compound-config/networks/{chain}.json'))
    abis = json.load(open(f'../compound-config/networks/{chain}-abi.json'))

    contract_cUSDC = w3.eth.contract(address=cfgs['cTokens']['cUSDC']['address'], abi=abis['cUSDC'])
    contract_USDC = w3.eth.contract(address=cfgs['cTokens']['cUSDC']['underlying'], abi=abis['USDC'])

    # sanity checks
    assert contract_USDC.functions.symbol().call() == 'USDC'
    assert contract_USDC.functions.decimals().call() == 6
    assert cfgs['cTokens']['cUSDC']['decimals'] == 8
    assert contract_cUSDC.functions.symbol().call() == 'cUSDC'
    assert contract_cUSDC.functions.decimals().call() == 8

    return {
        'USDC': contract_USDC,
        'cUSDC': contract_cUSDC,
    }

def get_token(w3: web3.Web3, token_name: str, contract_definitions: Optional[dict] = None) -> Tuple:
    if contract_definitions is None:
        contract_definitions = get_contract_definitions(w3)
    token_contract = contract_definitions[token_name]
    token_type = namedtuple(token_name, 'contract decimals balanceOf')
    token_decimals=token_contract.functions.decimals().call()
    token = token_type(
        contract=token_contract,
        decimals=token_decimals,
        balanceOf=lambda address: D(token_contract.functions.balanceOf(address).call(), token_decimals)
    )
    return token
