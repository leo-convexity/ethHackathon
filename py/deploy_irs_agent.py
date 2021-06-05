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
from web3.main import to_hex
from common import CONFIG, D, IRS_AGENT_CACHED_BUILD_FILENAME, IRS_AGENT_CONTRACT_ADDRESS_FILENAME, new_web3, get_contract_definitions, get_token

BUILD_FILE = CONFIG.IRS_PATH / 'build/contracts/IrsAgent.json'

parser = argparse.ArgumentParser(description='Deploy smart contract.')
parser.add_argument('-yes', dest='yes', action='store_true', help='do not ask and always proceed')
parser.add_argument('build', metavar='BUILD', nargs='?', type=Path, help='build file', default=BUILD_FILE)
args = parser.parse_args()

w3 = new_web3()

contract_definitions = get_contract_definitions(w3, 'mainnet')
USDC = get_token(w3, 'USDC', contract_definitions)
cUSDC = get_token(w3, 'cUSDC', contract_definitions)

try:
    with open(IRS_AGENT_CACHED_BUILD_FILENAME) as fd:
        cached_build = json.load(fd)
except FileNotFoundError:
    cached_build = None

try:
    with open(args.build) as fd:
        build = json.load(fd)
except FileNotFoundError:
    build = None

active_build = build
if active_build is None:
    active_build = cached_build

if active_build is None:
    print('either build file or cached build file must exist', file=sys.stderr)
    exit(1)

abi = active_build['abi']
bc = active_build['bytecode']

block_number = w3.eth.block_number

print()
print(f'# Build file: {args.build if build is not None else IRS_AGENT_CACHED_BUILD_FILENAME}')
print()
print('# Ethereum')
print(f'{"block_number":<24} {block_number:,d}')
print()

irs_agent = w3.eth.contract(abi=abi, bytecode=bc)
function = irs_agent.constructor(cUSDC.contract.address, block_number + 1000)
proceed = args.yes

if not proceed:
    print('proceed (y/n) ?')
    reply = input()
    proceed = reply.strip().lower() == 'y'

if proceed:
    tx_tmpl = {'from': w3.eth.accounts[10]}
    transaction_hash = function.transact(tx_tmpl)

    print(f'transaction hash: {to_hex(transaction_hash)}')
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

    os_fd, filename = tempfile.mkstemp(suffix='~', prefix=f'.{IRS_AGENT_CONTRACT_ADDRESS_FILENAME.name}.', text=True)
    with os.fdopen(os_fd, 'w') as fd:
        json.dump(data, fd, indent=None, separators=(',', ':'), sort_keys=True)

    os.replace(filename, IRS_AGENT_CONTRACT_ADDRESS_FILENAME)

    if active_build != cached_build:
        active_build_str = json.dumps(active_build, indent=None, separators=(',', ':'), sort_keys=True)
        cached_build_str = json.dumps(cached_build, indent=None, separators=(',', ':'), sort_keys=True)
        if active_build_str != cached_build_str:
            with open(IRS_AGENT_CACHED_BUILD_FILENAME, 'w') as fd:
                fd.write(active_build_str)
