#!/usr/bin/env python3
'''
Iterates and print accounts on the Ethereum node.
For a local node (forked or otherwise) there should be 20 accounts with 10,000 ETH each.
'''
import json
import time
import sys
import enum
from collections import namedtuple
from pprint import pprint
from common import D, IRS_AGENT_CONTRACT_ADDRESS_FILENAME, new_web3, get_contract_definitions, get_token, get_uniswap_router

class Operation(enum.Enum):
    DEPOSIT = 1
    WITHDRAW = 2
    BALANCE = 3

def usage():
    print(f'usage: {sys.argv[0]} [account] [deposit|withdraw|balance] [quantity] [token]')
    exit(1)

try:
    arg_act = sys.argv[1]
except:
    usage()

w3 = new_web3()

contract_definitions = get_contract_definitions(w3, 'mainnet')
USDC = get_token(w3, 'USDC', contract_definitions)
cUSDC = get_token(w3, 'cUSDC', contract_definitions)
WETH = get_token(w3, 'WETH', contract_definitions)
tokens = dict((token.contract.address, token) for token in (WETH, USDC, cUSDC))

try:
    index = int(arg_act)
    account = w3.eth.accounts[index]

    try:
        arg_op = sys.argv[2]
    except IndexError:
        op = Operation.BALANCE
    else:
        if arg_op.lower() == 'deposit':
            op = Operation.DEPOSIT
        elif arg_op.lower() == 'withdraw':
            op = Operation.WITHDRAW
        elif arg_op.lower() == 'balance':
            op = Operation.BALANCE
        else:
            raise ValueError(f'invalid operation: {arg_op}')

    try:
        arg_qty = sys.argv[3]
    except IndexError:
        if op != Operation.BALANCE:
            raise
        quantity = 0
    else:
        quantity = D(arg_qty)
        assert quantity >= 0 and op == Operation.BALANCE or quantity > 0

    try:
        arg_token = sys.argv[4]
    except IndexError:
        if op != Operation.BALANCE:
            raise
        token = None
    else:
        token = {'usdc': USDC, 'cusdc': cUSDC, 'weth': WETH}[arg_token.lower()]
except Exception as exc:
    print(exc)
    raise
    usage()

IRS_data = json.load(open(IRS_AGENT_CONTRACT_ADDRESS_FILENAME))[0]
IRS_type = namedtuple('IRS', 'contract token ctoken')
IRS_contract = w3.eth.contract(address=IRS_data['contract_address'], abi=IRS_data['abi'])
IRS_token = IRS_contract.functions.token().call()
IRS_ctoken = IRS_contract.functions.ctoken().call()
IRS = IRS_type(contract=IRS_contract, token=IRS_token, ctoken=IRS_ctoken)

#assert token is not None

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
    adj_allowance = token.contract.functions.allowance(account, IRS.contract.address).call()
    if adj_allowance < adj_quantity:
        print(f'{token.symbol} token allowance for {account} is {adj_allowance} which is too low, increase (y/n) ?')
        reply = input()
        if reply.strip().lower() == 'y':
            transaction_hash = token.contract.functions.approve(IRS.contract.address, adj_quantity).transact({'from': account})
            print(f'transaction hash: {transaction_hash}')
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
elif op == Operation.BALANCE:
    exit()
else:
    assert False
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
