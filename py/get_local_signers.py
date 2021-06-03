#!/usr/bin/env python3
'''
Iterates and print accounts on the Ethereum node.
For a local node (forked or otherwise) there should be 20 accounts with 10,000 ETH each.
'''
import json
import decimal
import web3
from collections import namedtuple
from common import D, new_web3, get_contract_definitions, get_token

w3 = new_web3()

contract_definitions = get_contract_definitions(w3, 'mainnet')
USDC = get_token(w3, 'USDC', contract_definitions)
cUSDC = get_token(w3, 'cUSDC', contract_definitions)

block_number = w3.eth.block_number
accounts = w3.eth.accounts

print()
print('# Ethereum')
print(f'{"block_number":<24} {block_number:,d}')
print(f'{"accounts":<24} {len(accounts)}')
print()
print(f'{"Account":<42}    {"ETH":>24}    {"USDC":>24}    {"cUSDC":>24}')
for i, account in enumerate(accounts):
    eth_balance = w3.eth.get_balance(account)
    usdc_balance = USDC.balanceOf(account)
    cusdc_balance = cUSDC.balanceOf(account)
    print(f'{account:<42}    {D(eth_balance, 18):>24.18f}    {D(usdc_balance, 18):>24.18f}    {D(cusdc_balance, 18):>24.18f}')
print()
