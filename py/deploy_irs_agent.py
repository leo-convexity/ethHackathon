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
import argparse
from pathlib import Path
from pprint import pprint
from common import CONFIG, D, IRS_AGENT_CONTRACT_ADDRESS_FILENAME, new_web3, get_contract_definitions, get_token

default_abi = CONFIG.SOL_PATH / 'contracts/artefact/0_IrsAgent.abi.json'
default_bc = CONFIG.SOL_PATH / 'contracts/artefact/0_IrsAgent.bytecode.json'

parser = argparse.ArgumentParser(description='Deploy smart contract.')
parser.add_argument('-yes', dest='yes', action='store_true', help='do not ask and always proceed')
parser.add_argument('abi', metavar='ABI', nargs='?', type=Path, help='abi file', default=default_abi)
parser.add_argument('bc', metavar='BYTECODE', nargs='?', type=Path, help='bytecode file', default=default_bc)
args = parser.parse_args()

w3 = new_web3()

contract_definitions = get_contract_definitions(w3, 'mainnet')
USDC = get_token(w3, 'USDC', contract_definitions)
cUSDC = get_token(w3, 'cUSDC', contract_definitions)

try:
    abi = json.load(open(args.abi))
    bc = bytes.fromhex(json.load(open(args.bc))['object'])
except Exception as exc:
    print(exc)
    parser.print_help()
    exit(1)

block_number = w3.eth.block_number

print()
print(f'#       ABI file: {args.abi}')
print(f'# Byte Code file: {args.bc}')
print()
print('# Ethereum')
print(f'{"block_number":<24} {block_number:,d}')
print()

irs_agent = w3.eth.contract(abi=abi, bytecode=bc)
function = irs_agent.constructor(cUSDC.contract.address, USDC.contract.address, block_number + 1000)
proceed = args.yes

if not proceed:
    print('proceed (y/n) ?')
    reply = input()
    proceed = reply.strip().lower() == 'y'

if proceed:
    tx_tmpl = {'from': w3.eth.accounts[10]}
    transaction_hash = function.transact(tx_tmpl)

    print(f'transaction hash: {web3.eth.to_hex(transaction_hash)}')
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
