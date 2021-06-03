#!/usr/bin/env python3
'''
Iterates and print accounts on the Ethereum node.
For a local node (forked or otherwise) there should be 20 accounts with 10,000 ETH each.
'''
import json
import decimal
import web3
import time
import sys
from collections import namedtuple
from pprint import pprint
from common import D, new_web3, get_contract_definitions, get_token, get_uniswap_router

def usage():
    print(f'usage: {sys.argv[0]} [account] [send] [quantity] [token] [recipient]')
    exit(1)

try:
    arg_act, arg_op, arg_qty, arg_token, arg_rcpt = sys.argv[1:]
except:
    usage()

w3 = new_web3()

contract_definitions = get_contract_definitions(w3, 'mainnet')
USDC = get_token(w3, 'USDC', contract_definitions)
cUSDC = get_token(w3, 'cUSDC', contract_definitions)
WETH = get_token(w3, 'WETH', contract_definitions)
UNISWAP = get_uniswap_router(w3, contract_definitions)

try:
    index = int(arg_act)
    account = w3.eth.accounts[index]
    token = {'eth': None, 'usdc': USDC, 'cusdc': cUSDC, 'weth': WETH}[arg_token.lower()]
    quantity = decimal.Decimal(arg_qty)
    recipient = web3.main.to_checksum_address(arg_rcpt)
    assert quantity > 0
    if arg_op.lower() != 'send':
        raise ValueError(f'invalid operation: {arg_op}')
except Exception as exc:
    print(exc)
    usage()

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

print('proceed (y/n) ?')
reply = input()
if reply.strip().lower() == 'y':

    if token is None:
        transaction_hash = w3.eth.send_transaction(transaction_template)
    else:
        transaction_hash = function.transact(transaction_template)

    print(f'transaction hash: {transaction_hash}')
    result = w3.eth.wait_for_transaction_receipt(transaction_hash, timeout=120, poll_latency=0.1)

    # This sort of makes the transaction receipt more readable
    adj_result = dict(result)
    adj_result['logs'] = list(map(dict, adj_result['logs']))
    pprint(adj_result)
