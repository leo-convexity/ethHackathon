#!/usr/bin/env python3
'''
Iterates and print accounts on the Ethereum node.
For a local node (forked or otherwise) there should be 20 accounts with 10,000 ETH each.
'''
import json
import decimal
import time
import sys
import argparse
from collections import namedtuple
from pprint import pprint
from web3.main import to_hex
from common import D, new_web3, get_contract_definitions, get_token, get_uniswap_router

parser = argparse.ArgumentParser(description='Buy or sell from Uniswap.')
parser.add_argument('-yes', dest='yes', action='store_true', help='do not confirm and always proceed')
parser.add_argument('account', metavar='ACCOUNT', nargs=None, type=int, help='local account index')
parser.add_argument('operation', metavar='OPERATION', nargs=None, type=str, help="operation - must be 'buy' or 'sell'")
parser.add_argument('quantity', metavar='QUANTITY', nargs=None, type=decimal.Decimal, help='quantity of ETH or tokens')
parser.add_argument('token', metavar='TOKEN', nargs=None, type=str, help='ETH or token to send')
args = parser.parse_args()

w3 = new_web3()

contract_definitions = get_contract_definitions(w3, 'mainnet')
USDC = get_token(w3, 'USDC', contract_definitions)
cUSDC = get_token(w3, 'cUSDC', contract_definitions)
WETH = get_token(w3, 'WETH', contract_definitions)
UNISWAP = get_uniswap_router(w3, contract_definitions)

try:
    index = int(args.account)
    account = w3.eth.accounts[index]
    quantity = decimal.Decimal(args.quantity)
    assert quantity > 0

    if args.operation.lower() == 'sell':
        side = -1
    elif args.operation.lower() == 'buy':
        side = +1
    else:
        raise ValueError(f'invalid operation: {args.operation}')

    token = {'usdc': USDC, 'cusdc': cUSDC, 'weth': WETH}[args.token.lower()]
except Exception as exc:
    print(exc, file=sys.stderr)
    exit(1)

block_number = w3.eth.block_number

print()
print('# Ethereum')
print(f'{"block_number":<24} {block_number:,d}')
print()
print(f'{"#":<2}    {"Account":<42}    {"ETH":>24}    {"WETH":>24}    {"USDC":>24}    {"cUSDC":>24}')
eth_balance = w3.eth.get_balance(account)
weth_balance = WETH.balanceOf(account)
usdc_balance = USDC.balanceOf(account)
cusdc_balance = cUSDC.balanceOf(account)
print(f'{index:<2}    {account:<42}    {D(eth_balance, 18):>24.18f}    {weth_balance:>24.18f}    {usdc_balance:>24.6f}    {cusdc_balance:>24.8f}')
print()

# Scale quantity for token's expected number of decimals
quantity *= 10**token.decimals
adj_quantity = int(quantity)
assert adj_quantity == quantity, f'token {token.symbol} has only {token.decimals} decimal(s)'

# Deadline for uniswap transaction completion or else it will revert when committed
deadline = int(time.time()) + 30

if side > 0:
    max_spend = max(0, eth_balance - 10**18) # Save 1 ETH
    value = max_spend
    function = UNISWAP.contract.functions.swapETHForExactTokens(adj_quantity, [WETH.contract.address, token.contract.address], account, deadline)
elif side < 0:
    min_receive = 0
    value = 0
    function = UNISWAP.contract.functions.swapExactTokensForETH(adj_quantity, min_receive, [token.contract.address, WETH.contract.address], account, deadline)

transaction_template = {'from': account, 'value': value}

# Check token approval if selling tokens
if side < 0:
    adj_allowance = token.contract.functions.allowance(account, UNISWAP.contract.address).call()
    if adj_allowance < adj_quantity:
        print(f'{token.symbol} token allowance for {account} is {adj_allowance} which is too low, increase (y/n) ?')
        reply = input()
        if reply.strip().lower() == 'y':
            transaction_hash = token.contract.functions.approve(UNISWAP.contract.address, adj_quantity).transact({'from': account})
            print(f'transaction hash: {to_hex(transaction_hash)}')
            result = w3.eth.wait_for_transaction_receipt(transaction_hash, timeout=120, poll_latency=0.1)
            # This sort of makes the transaction receipt more readable
            adj_result = dict(result)
            adj_result['logs'] = list(map(dict, adj_result['logs']))
            pprint(adj_result)
        else:
            exit()

result = function.call(transaction_template)
print(f'transaction call result: {result}')

proceed = args.yes

if not proceed:
    print('proceed (y/n) ?')
    reply = input()
    proceed = reply.strip().lower() == 'y'

if proceed:
    transaction_hash = function.transact(transaction_template)
    print(f'transaction hash: {to_hex(transaction_hash)}')
    result = w3.eth.wait_for_transaction_receipt(transaction_hash, timeout=120, poll_latency=0.1)

    # This sort of makes the transaction receipt more readable
    adj_result = dict(result)
    adj_result['logs'] = list(map(dict, adj_result['logs']))
    pprint(adj_result)
