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
from web3.main import to_checksum_address, to_hex
from common import D, new_web3, get_contract_definitions, get_token, get_uniswap_router

parser = argparse.ArgumentParser(description='Transfer ETH or tokens.')
parser.add_argument('-yes', dest='yes', action='store_true', help='do not confirm and always proceed')
parser.add_argument('account', metavar='ACCOUNT', nargs=None, type=int, help='local account index')
parser.add_argument('operation', metavar='OPERATION', nargs=None, type=str, help="operation - must be 'send'")
parser.add_argument('quantity', metavar='QUANTITY', nargs=None, type=decimal.Decimal, help='quantity of ETH or tokens')
parser.add_argument('token', metavar='TOKEN', nargs=None, type=str, help='ETH or token to send')
parser.add_argument('recipient', metavar='RECIPIENT', nargs=None, type=str, help='ETH address of recipient')
args = parser.parse_args()

w3 = new_web3()

contract_definitions = get_contract_definitions(w3, 'mainnet')
USDC = get_token(w3, 'USDC', contract_definitions)
cUSDC = get_token(w3, 'cUSDC', contract_definitions)
WETH = get_token(w3, 'WETH', contract_definitions)

try:
    index = int(args.account)
    account = w3.eth.accounts[index]
    token = {'eth': None, 'usdc': USDC, 'cusdc': cUSDC, 'weth': WETH}[args.token.lower()]
    quantity = decimal.Decimal(args.quantity)
    recipient = to_checksum_address(args.recipient)
    assert quantity > 0
    if args.operation.lower() != 'send':
        raise ValueError(f'invalid operation: {args.operation}')
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

eth_balance2 = w3.eth.get_balance(recipient)
weth_balance2 = WETH.balanceOf(recipient)
usdc_balance2 = USDC.balanceOf(recipient)
cusdc_balance2 = cUSDC.balanceOf(recipient)
print(f'{"Recvr":<5} {recipient:<42}    {D(eth_balance2, 18):>24.18f}    {weth_balance2:>24.18f}    {usdc_balance2:>24.6f}    {cusdc_balance2:>24.8f}')
print()

if token is None:
    # This is a plain ETH transfer
    token_symbol = 'ETH'
    token_decimals = 18
else:
    token_symbol = token.symbol
    token_decimals = token.decimals
    
# Scale quantity for token's expected number of decimals
quantity *= 10**token_decimals
adj_quantity = int(quantity)
assert adj_quantity == quantity, f'token {token_symbol} has only {token_decimals} decimal(s)'

transaction_template = {'from': account}

if token is None:
    transaction_template.update({'to': recipient, 'value': adj_quantity})
    result = w3.eth.call(transaction_template)
else:
    function = token.contract.functions.transfer(recipient, adj_quantity)
    result = function.call(transaction_template)
print(f'transaction call result: {result}')

proceed = args.yes

if not proceed:
    print('proceed (y/n) ?')
    reply = input()
    proceed = reply.strip().lower() == 'y'

if proceed:
    if token is None:
        transaction_hash = w3.eth.send_transaction(transaction_template)
    else:
        transaction_hash = function.transact(transaction_template)

    print(f'transaction hash: {to_hex(transaction_hash)}')
    result = w3.eth.wait_for_transaction_receipt(transaction_hash, timeout=120, poll_latency=0.1)

    # This sort of makes the transaction receipt more readable
    adj_result = dict(result)
    adj_result['logs'] = list(map(dict, adj_result['logs']))
    pprint(adj_result)
