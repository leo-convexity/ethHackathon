#!/usr/bin/env python3
import json
import decimal
import web3
from collections import namedtuple
from typing import Optional, Tuple

# These Uniswap deployment addresses are the same for mainnet, ropsten, rinkeby, goerli and kovan
UNIVERSAL_UNISWAP_FACTORY_ADDRESS = web3.main.to_checksum_address('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f')
UNIVERSAL_UNISWAP_ROUTER_ADDRESS = web3.main.to_checksum_address('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D')
IRS_AGENT_CONTRACT_ADDRESS_FILENAME = 'deployed_irs_agent.json'

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
    assert chain in ('mainnet', 'ropsten', 'rinkeby', 'goerli', 'kovan'), f'unsupported chain: {chain}'

    cfgs = json.load(open(f'../compound-config/networks/{chain}.json'))
    abis = json.load(open(f'../compound-config/networks/{chain}-abi.json'))

    contract_cUSDC = w3.eth.contract(address=cfgs['cTokens']['cUSDC']['address'], abi=abis['cUSDC'])
    contract_USDC = w3.eth.contract(address=cfgs['cTokens']['cUSDC']['underlying'], abi=abis['USDC'])

    # uniswap factory
    abi = json.load(open('../uniswap-v2-core-1.0.1-abi/UniswapV2Factory.json'))['abi']
    contract_uniswap_v2_factory = w3.eth.contract(address=UNIVERSAL_UNISWAP_FACTORY_ADDRESS, abi=abi)

    # uniswap router
    abi = json.load(open('../uniswap-v2-periphery@1.1.0-beta.0-abi/UniswapV2Router02.json'))['abi']
    contract_uniswap_v2_router = w3.eth.contract(address=UNIVERSAL_UNISWAP_ROUTER_ADDRESS, abi=abi)

    # WETH (from uniswap router)
    abi = json.load(open('../uniswap-v2-periphery@1.1.0-beta.0-abi/WETH9.json'))['abi']
    address = contract_uniswap_v2_router.functions.WETH().call()
    contract_WETH = w3.eth.contract(address=address, abi=abi)

    # sanity checks
    assert contract_USDC.functions.symbol().call() == 'USDC'
    assert contract_USDC.functions.decimals().call() == 6
    assert cfgs['cTokens']['cUSDC']['decimals'] == 8
    assert contract_cUSDC.functions.symbol().call() == 'cUSDC'
    assert contract_cUSDC.functions.decimals().call() == 8
    assert contract_WETH.functions.symbol().call() == 'WETH'
    assert contract_WETH.functions.decimals().call() == 18

    return {
        'USDC': contract_USDC,
        'cUSDC': contract_cUSDC,
        'WETH': contract_WETH,
        'UniswapV2Factory': contract_uniswap_v2_factory,
        'UniswapV2Router02': contract_uniswap_v2_router,
    }

def get_token(w3: web3.Web3, token_name: str, contract_definitions: Optional[dict] = None) -> Tuple:
    if contract_definitions is None:
        contract_definitions = get_contract_definitions(w3)
    token_contract = contract_definitions[token_name]
    token_type = namedtuple(token_name, 'contract symbol decimals balanceOf')
    token_symbol = token_contract.functions.symbol().call()
    token_decimals = token_contract.functions.decimals().call()
    token = token_type(
        contract=token_contract,
        symbol=token_symbol,
        decimals=token_decimals,
        balanceOf=lambda address: D(token_contract.functions.balanceOf(address).call(), token_decimals),
    )
    return token

def get_uniswap_factory(w3: web3.Web3, contract_definitions: Optional[dict] = None) -> Tuple:
    if contract_definitions is None:
        contract_definitions = get_contract_definitions(w3)
    name = 'UniswapV2Factory'
    contract_definition = contract_definitions[name]
    contract_type = namedtuple(name, 'contract')
    contract = contract_type(
        contract=contract_definition,
    )
    return contract

def get_uniswap_router(w3: web3.Web3, contract_definitions: Optional[dict] = None) -> Tuple:
    if contract_definitions is None:
        contract_definitions = get_contract_definitions(w3)
    name = 'UniswapV2Router02'
    contract_definition = contract_definitions[name]
    contract_type = namedtuple(name, 'contract WETH')
    contract = contract_type(
        contract=contract_definition,
        WETH=lambda: contract_definition.functions.WETH().call(),
    )
    return contract
