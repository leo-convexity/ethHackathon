#!/usr/bin/env python3
'''
Iterates and print accounts on the Ethereum node.
For a local node (forked or otherwise) there should be 20 accounts with 10,000 ETH each.
'''
import json
import time
import sys
import enum
import decimal
import argparse
from collections import namedtuple
from pprint import pprint
from web3.main import to_checksum_address, to_hex
from common import D, IRS_AGENT_CONTRACT_ADDRESS_FILENAME, new_web3, get_contract_definitions, get_token, get_uniswap_router, get_irs_agent

class Operation(enum.Enum):
    DEPOSIT = 1
    WITHDRAW = 2
    BALANCE = 3

parser = argparse.ArgumentParser(description='Transfer ETH or tokens.')
parser.add_argument('-yes', dest='yes', action='store_true', help='do not confirm and always proceed')
parser.add_argument('account', metavar='ACCOUNT', nargs=None, type=str, help='local account index')
parser.add_argument('operation', metavar='OPERATION', nargs='?', type=str, help="operation - must be 'deposit', 'withdraw' or 'balance'", default='balance')
parser.add_argument('quantity', metavar='QUANTITY', nargs='?', type=decimal.Decimal, help='quantity of ETH or tokens', default=0)
parser.add_argument('token', metavar='TOKEN', nargs='?', type=str, help='ETH or token to send')
args = parser.parse_args()

w3 = new_web3()

contract_definitions = get_contract_definitions(w3, 'mainnet')
USDC = get_token(w3, 'USDC', contract_definitions)
cUSDC = get_token(w3, 'cUSDC', contract_definitions)
WETH = get_token(w3, 'WETH', contract_definitions)
IRS = get_irs_agent(w3, contract_definitions)

tokens = dict((token.contract.address, token) for token in (WETH, USDC, cUSDC))

try:
    if args.account.startswith('0x') or len(args.account) >= 40:
        index = -1
        account = to_checksum_address(args.account)
    else:
        index = int(args.account)
        account = w3.eth.accounts[index]

    op = Operation[args.operation.upper()]

    if op != Operation.BALANCE:
        quantity = D(args.quantity)
        if not quantity:
            raise ValueError('missing quantity')
        if quantity < 0:
            raise ValueError('negative quantity')
    else:
        quantity = D(0)

    if op != Operation.BALANCE:
        token = {'usdc': USDC, 'cusdc': cUSDC, 'weth': WETH}[args.token.lower()]
    else:
        token = None

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
#irs_balance = IRS.functions.balanceOf()
print(f'{index:<2}    {account:<42}    {D(eth_balance, 18):>24.18f}    {weth_balance:>24.18f}    {usdc_balance:>24.6f}    {cusdc_balance:>24.8f}')
print()
print(f'IRS token      {tokens[IRS.ctoken].symbol:>24}')
print(f'IRS reserves   {D(IRS.contract.functions.reserves().call(), tokens[IRS.ctoken].decimals):>24}')
print(f'IRS depositors {IRS.contract.functions.depositors().call():>24}')
print(f'IRS balance    {D(IRS.contract.functions.balanceOf(account).call(), tokens[IRS.ctoken].decimals):>24}')
print()

if op == Operation.BALANCE:
    exit()

token_symbol = token.symbol
token_decimals = token.decimals
    
# Scale quantity for token's expected number of decimals
quantity *= 10**token_decimals
adj_quantity = int(quantity)
assert adj_quantity == quantity, f'token {token_symbol} has only {token_decimals} decimal(s)'

transaction_template = {'from': account}

# Check token approval if selling tokens
if op == Operation.DEPOSIT:
    adj_allowance = token.contract.functions.allowance(account, IRS.contract.address).call(transaction_template)
    if adj_allowance < adj_quantity:
        proceed = args.yes
        if not proceed:
            print(f'{token.symbol} token allowance for {account} is {adj_allowance} which is too low, increase (y/n) ?')
            reply = input()
            proceed = reply.strip().lower() == 'y'
        if proceed:
            transaction_hash = token.contract.functions.approve(IRS.contract.address, adj_quantity).transact(transaction_template)
            print(f'transaction hash: {to_hex(transaction_hash)}')
            result = w3.eth.wait_for_transaction_receipt(transaction_hash, timeout=120, poll_latency=0.1)
            # This sort of makes the transaction receipt more readable
            adj_result = dict(result)
            adj_result['logs'] = list(map(dict, adj_result['logs']))
            pprint(adj_result)
        else:
            exit()

if op == Operation.DEPOSIT:
    function = IRS.contract.functions.deposit(adj_quantity, token.contract.address)
elif op == Operation.WITHDRAW:
    function = IRS.contract.functions.withdraw(adj_quantity, token.contract.address)
else:
    raise RunTimeError(f'unexpected operation: {op}')

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
