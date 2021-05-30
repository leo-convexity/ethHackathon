#!/usr/bin/env python3
'''
Iterates and print accounts on the Ethereum node.
For a local node (forked or otherwise) there should be 20 accounts with 10,000 ETH each.
'''
import json
import web3
import sys
import tempfile
import os
from pprint import pprint
from common import D, IRS_AGENT_CONTRACT_ADDRESS_FILENAME, new_web3, get_contract_definitions, get_token

def usage():
    print(f'usage: {sys.argv[0]} [abi file] [bytecode file]')
    exit(1)

try:
    arg_abi, arg_bc = sys.argv[1:]
except:
    usage()

w3 = new_web3('http://127.0.0.1:8545')

contract_definitions = get_contract_definitions(w3, 'mainnet')
USDC = get_token(w3, 'USDC', contract_definitions)
cUSDC = get_token(w3, 'cUSDC', contract_definitions)

try:
    abi = json.load(open(arg_abi))
    bc = bytes.fromhex(json.load(open(arg_bc))['object'])
except Exception as exc:
    print(exc)
    usage()

block_number = w3.eth.block_number

print()
print('# Ethereum')
print(f'{"block_number":<24} {block_number:,d}')
print()

irs_agent = w3.eth.contract(abi=abi, bytecode=bc)
function = irs_agent.constructor(cUSDC.contract.address)

print('proceed (y/n) ?')
reply = input()
if reply.strip().lower() == 'y':

    tx_tmpl = {'from': w3.eth.accounts[10]}
    transaction_hash = function.transact(tx_tmpl)

    print(f'transaction hash: {transaction_hash}')
    result = w3.eth.wait_for_transaction_receipt(transaction_hash, timeout=120, poll_latency=0.1)

    # This sort of makes the transaction receipt more readable
    adj_result = dict(result)
    adj_result['logs'] = list(map(dict, adj_result['logs']))
    pprint(adj_result)

    try:
        with open(IRS_AGENT_CONTRACT_ADDRESS_FILENAME, 'r') as fd:
            data = json.load(fd)
            assert isinstance(data, list)
    except FileNotFoundError:
        data = []

    data.insert(0, {
        'contract_address': result.contractAddress,
        'abi': abi,
    })

    os_fd, filename = tempfile.mkstemp(suffix='~', prefix=f'.{IRS_AGENT_CONTRACT_ADDRESS_FILENAME}.', text=True)
    with os.fdopen(os_fd, 'w') as fd:
        json.dump(data, fd, indent=None, separators=(',', ':'), sort_keys=True)

    os.replace(filename, IRS_AGENT_CONTRACT_ADDRESS_FILENAME)
