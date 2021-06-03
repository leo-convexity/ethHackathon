#!/bin/bash
function X() {
	local P="$1"
	shift

	echo '#'
	echo "# Press return to run: $P $@"
	echo -n '#'
	read
	echo '----------------------------------------------------------------'
	"./${P}.py" "$@"
	echo '----------------------------------------------------------------'
	echo '#'
	echo '# Press return to continue'
	echo '#'
	read
}

if true; then
	X dump_compound_usdc_data
	X local_account_balances
	X local_account_uniswap_transact 1 buy 100000 USDC
	X local_account_balances
	X deploy_irs_agent ../sol/contracts/artefact/0_IrsAgent.abi.json ../sol/contracts/artefact/0_IrsAgent.bytecode.json
	X local_account_balances
	X local_account_irs_agent 1 deposit 50000 USDC
	X local_account_irs_agent 1 balance
	X dump_compound_usdc_data
	X local_account_irs_agent 1 withdraw 50000 USDC
	X local_account_irs_agent 1 balance
	X local_account_balances
fi
