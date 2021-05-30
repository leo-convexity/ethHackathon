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
	X local_account_uniswap_transact 4 buy 1000 USDC
	X local_account_balances
	X local_account_uniswap_transact 5 buy 500 USDC
	X local_account_balances
	X deploy_irs_agent ../sol/contracts/artefact/0_IrsAgent.abi.json ../sol/contracts/artefact/0_IrsAgent.bytecode.json
	X local_account_balances
	X local_account_irs_agent 4 deposit 500 USDC
	X local_account_irs_agent 4 balance
	X local_account_irs_agent 5 deposit 250 USDC
	X local_account_irs_agent 5 balance
	X local_account_irs_agent 4 withdraw 500 USDC
	X local_account_irs_agent 4 balance
	X local_account_irs_agent 5 withdraw 50 USDC
	X local_account_irs_agent 5 balance
	X local_account_balances
fi
