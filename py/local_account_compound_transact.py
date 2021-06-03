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
    print(f'usage: {sys.argv[0]} [account] [mint|redeem] [quantity] [token]')
    exit(1)

try:
    arg_act, arg_op, arg_qty, arg_token = sys.argv[1:]
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
    quantity = decimal.Decimal(arg_qty)
    assert quantity > 0

    if arg_op.lower() == 'mint':
        side = -1
    elif arg_op.lower() == 'redeem':
        side = +1
    else:
        raise ValueError(f'invalid operation: {arg_op}')

    token = {'usdc': USDC, 'cusdc': cUSDC, 'weth': WETH}[arg_token.lower()]
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
print()

# Scale quantity for token's expected number of decimals
quantity *= 10**token.decimals
adj_quantity = int(quantity)
assert adj_quantity == quantity, f'token {token.symbol} has only {token.decimals} decimal(s)'

# Deadline for uniswap transaction completion or else it will revert when committed.
# doesn't seem to be needed for Compound
deadline = int(time.time()) + 30

#redeem = 1, mint = -1
#both redeem and mint only take 1 parameters
#redeeming looks at the cToken balance, minting will look at the USDC balance
if side > 0: 
    max_spend = max(0, cusdc_balance - 10**18) 
    value = 0
    function = cUSDC.contract.functions.redeem(adj_quantity)
elif side < 0:
    min_receive = 0
    value = 0
    function = cUSDC.contract.functions.mint(adj_quantity)

transaction_template = {'from': account, 'value': value}

# Check token approval if minting ctokens. However the approval for cUSDC tokens has to come from USDC contract
if side < 0:
    adj_allowance = USDC.contract.functions.allowance(account, cUSDC.contract.address).call()
    if adj_allowance < adj_quantity:
        print(f'{USDC.symbol} token allowance for {account} is {adj_allowance} which is too low, increase (y/n) ?')
        reply = input()
        if reply.strip().lower() == 'y':
            transaction_hash = USDC.contract.functions.approve(cUSDC.contract.address, adj_quantity).transact({'from': account})
            print(f'transaction hash: {transaction_hash}')
            result = w3.eth.wait_for_transaction_receipt(transaction_hash, timeout=120, poll_latency=0.1)
            # This sort of makes the transaction receipt more readable
            adj_result = dict(result)
            adj_result['logs'] = list(map(dict, adj_result['logs']))
            pprint(adj_result)
        else:
            exit()

#changed back to call. send didn't work
result = function.call(transaction_template)
print(f'transaction call result: {result}')

print('proceed (y/n) ?')
reply = input()
if reply.strip().lower() == 'y':
    transaction_hash = function.transact(transaction_template)
    print(f'transaction hash: {transaction_hash}')
    result = w3.eth.wait_for_transaction_receipt(transaction_hash, timeout=120, poll_latency=0.1)

    # This sort of makes the transaction receipt more readable
    adj_result = dict(result)
    adj_result['logs'] = list(map(dict, adj_result['logs']))
    pprint(adj_result)
