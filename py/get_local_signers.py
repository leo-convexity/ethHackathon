#!/usr/bin/env python3
'''
Iterates and print accounts on the Ethereum node.
For a local node (forked or otherwise) there should be 20 accounts with 10,000 ETH each.
'''
import json
import decimal
import web3
from common import D

w3 = web3.Web3(provider=web3.Web3.HTTPProvider('http://127.0.0.1:8545'))
assert w3.isConnected(), 'not connected'
assert not w3.eth.syncing, f'not synced: {w3.eth.syncing}'

block_number = w3.eth.block_number
default_account = w3.eth.default_account
accounts = w3.eth.accounts

print()
print('# Ethereum')
print(f'{"block_number":<24} {block_number:,d}')
print(f'{"default_account":<24} {default_account}')
print(f'{"accounts":<24} {len(accounts)}')
for account in accounts:
    balance = w3.eth.get_balance(account)
    print(f'{"":<24} {account}    {D(balance, 18):>24.18f}')
print()
