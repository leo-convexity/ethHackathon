#!/usr/bin/env python3
'''
Sends a number of dummy transctions to advance the local blockchain.
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

parser = argparse.ArgumentParser(description='Sends do nothing transactions.')
parser.add_argument('-yes', dest='yes', action='store_true', help='do not confirm and always proceed')
parser.add_argument('-quiet', dest='quiet', action='store_true', help='do not output transaction receipts')
parser.add_argument('account', metavar='ACCOUNT', nargs=None, type=int, help='local account index')
parser.add_argument('operation', metavar='OPERATION', nargs='?', type=str, help="operation - must be 'noop'")
parser.add_argument('quantity', metavar='QUANTITY', nargs='?', type=int, help='number of transactions to send', default=1)
args = parser.parse_args()

w3 = new_web3()

try:
    index = int(args.account)
    account = w3.eth.accounts[index]
    quantity = int(args.quantity)
    assert quantity >= 0
    if args.operation.lower() != 'noop':
        raise ValueError(f'invalid operation: {args.operation}')
except Exception as exc:
    print(exc, file=sys.stderr)
    exit(1)

block_number = w3.eth.block_number

print()
print('# Ethereum')
print(f'{"block_number":<24} {block_number:,d}')
print()

transaction_template = {'from': account, 'to': account, 'value': 0}
result = w3.eth.call(transaction_template)
print(f'transaction call result: {result}')

proceed = args.yes

if not proceed:
    print('proceed (y/n) ?')
    reply = input()
    proceed = reply.strip().lower() == 'y'

if proceed:
    for _ in range(quantity):
        transaction_hash = w3.eth.send_transaction(transaction_template)

        print(f'transaction hash: {to_hex(transaction_hash)}')
        result = w3.eth.wait_for_transaction_receipt(transaction_hash, timeout=120, poll_latency=0.1)

        if not args.quiet:
            # This sort of makes the transaction receipt more readable
            adj_result = dict(result)
            adj_result['logs'] = list(map(dict, adj_result['logs']))
            pprint(adj_result)
